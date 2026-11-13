-- Opaque token for Smart Allergy Passport QR codes (no clinical data in the QR payload).
ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS passport_token UUID;

UPDATE patients
SET passport_token = gen_random_uuid()
WHERE passport_token IS NULL;

ALTER TABLE patients
    ALTER COLUMN passport_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_passport_token
    ON patients (passport_token);
