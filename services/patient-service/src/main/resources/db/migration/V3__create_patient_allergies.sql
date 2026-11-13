CREATE TABLE patient_allergies (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    allergen VARCHAR(255) NOT NULL,
    category VARCHAR(30),
    observed_reaction VARCHAR(500),
    reaction_date DATE,
    reaction_severity VARCHAR(20),
    clinical_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'DECLARED',
    criticality VARCHAR(30) NOT NULL DEFAULT 'UNABLE_TO_ASSESS',
    recorded_by_username VARCHAR(100) NOT NULL,
    recorded_by_role VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_allergy_category CHECK (
        category IS NULL OR category IN ('MEDICATION', 'FOOD', 'ENVIRONMENT', 'BIOLOGIC', 'OTHER')
    ),
    CONSTRAINT chk_reaction_severity CHECK (
        reaction_severity IS NULL OR reaction_severity IN ('MILD', 'MODERATE', 'SEVERE')
    ),
    CONSTRAINT chk_allergy_clinical_status CHECK (
        clinical_status IN ('ACTIVE', 'INACTIVE', 'RESOLVED')
    ),
    CONSTRAINT chk_allergy_verification_status CHECK (
        verification_status IN ('DECLARED', 'UNCONFIRMED', 'CONFIRMED', 'REFUTED')
    ),
    CONSTRAINT chk_allergy_criticality CHECK (
        criticality IN ('LOW', 'HIGH', 'UNABLE_TO_ASSESS')
    )
);

CREATE INDEX idx_patient_allergies_patient
    ON patient_allergies (patient_id, created_at DESC);
CREATE INDEX idx_patient_allergies_active
    ON patient_allergies (patient_id, clinical_status, verification_status);

CREATE TABLE patient_allergy_history (
    id UUID PRIMARY KEY,
    allergy_id UUID NOT NULL REFERENCES patient_allergies(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    action VARCHAR(20) NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB NOT NULL,
    changed_by_username VARCHAR(100) NOT NULL,
    changed_by_role VARCHAR(30) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_allergy_history_action CHECK (
        action IN ('CREATE', 'UPDATE', 'CONFIRM', 'REFUTE')
    )
);

CREATE INDEX idx_allergy_history_allergy
    ON patient_allergy_history (allergy_id, changed_at DESC);

-- Preserve every existing free-text allergy without deriving clinical facts.
-- The patient id is reused as a deterministic id in this separate table so
-- rerunning a repaired migration cannot duplicate the imported record.
INSERT INTO patient_allergies (
    id, patient_id, allergen, category, observed_reaction, reaction_date,
    reaction_severity, clinical_status, verification_status, criticality,
    recorded_by_username, recorded_by_role, created_at, updated_at, version
)
SELECT
    p.id, p.id, TRIM(p.allergies), NULL, NULL, NULL,
    NULL, 'ACTIVE', 'DECLARED', 'UNABLE_TO_ASSESS',
    'flyway-v3', 'SYSTEM', p.created_at, p.updated_at, 0
FROM patients p
WHERE p.allergies IS NOT NULL AND TRIM(p.allergies) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO patient_allergy_history (
    id, allergy_id, patient_id, action, before_snapshot, after_snapshot,
    changed_by_username, changed_by_role, correlation_id, changed_at
)
SELECT
    pa.id,
    pa.id,
    pa.patient_id,
    'CREATE',
    NULL,
    jsonb_build_object(
        'id', pa.id,
        'patientId', pa.patient_id,
        'allergen', pa.allergen,
        'clinicalStatus', pa.clinical_status,
        'verificationStatus', pa.verification_status,
        'criticality', pa.criticality,
        'version', pa.version
    ),
    'flyway-v3',
    'SYSTEM',
    'migration-v3',
    pa.created_at
FROM patient_allergies pa
WHERE pa.recorded_by_username = 'flyway-v3'
ON CONFLICT (id) DO NOTHING;
