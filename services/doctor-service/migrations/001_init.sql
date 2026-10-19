-- doctor-service initial schema (database sgh_consultation).
-- IF NOT EXISTS lets the runner adopt a database created before migrations were versioned.

CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY,
    appointment_id UUID,
    patient_id UUID NOT NULL,
    patient_snapshot JSONB,
    doctor_id UUID NOT NULL,
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS vital_signs (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    recorded_by UUID NOT NULL,
    temperature NUMERIC(4, 1),
    heart_rate INT,
    systolic INT,
    diastolic INT,
    spo2 INT,
    weight NUMERIC(5, 1),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY,
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    drug_name VARCHAR(120) NOT NULL,
    dosage VARCHAR(60) NOT NULL,
    frequency VARCHAR(60) NOT NULL,
    duration VARCHAR(60) NOT NULL,
    item_order INT NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS lab_order_tests (
    id UUID PRIMARY KEY,
    lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lab_result_copies (
    lab_request_id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    validated_by UUID NOT NULL,
    validated_at TIMESTAMPTZ NOT NULL,
    results JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
