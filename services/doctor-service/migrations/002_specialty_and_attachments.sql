-- Migration 002: Add doctor specialty to consultations and create consultation_attachments table

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_specialty VARCHAR(80);

-- Backfill existing seed consultations with known doctor specialties
UPDATE consultations
SET doctor_specialty = 'Cardiology'
WHERE doctor_id = 'b2b2b2b2-0000-4000-8000-000000000001' AND doctor_specialty IS NULL;

UPDATE consultations
SET doctor_specialty = 'General practice'
WHERE doctor_id = 'b2b2b2b2-0000-4000-8000-000000000002' AND doctor_specialty IS NULL;

CREATE TABLE IF NOT EXISTS consultation_attachments (
  id UUID PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  data TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_consultation_id ON consultation_attachments(consultation_id);
