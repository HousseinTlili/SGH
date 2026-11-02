-- pharmacy-service initial schema (database sgh_pharmacy).
-- IF NOT EXISTS lets the runner adopt a database created before migrations were versioned.

CREATE TABLE IF NOT EXISTS drugs (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    form VARCHAR(30) NOT NULL,
    strength VARCHAR(40) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    reorder_threshold INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_drugs_name_strength 
    ON drugs (LOWER(TRIM(name)), LOWER(TRIM(strength)));

  CREATE TABLE IF NOT EXISTS prescription_copies (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY,
    prescription_id UUID NOT NULL REFERENCES prescription_copies(id) ON DELETE CASCADE,
    item_index INT NOT NULL,
    drug_name VARCHAR(120) NOT NULL,
    dosage VARCHAR(60) NOT NULL,
    frequency VARCHAR(60) NOT NULL,
    duration VARCHAR(60) NOT NULL,
    dispensed BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (prescription_id, item_index)
  );

  CREATE TABLE IF NOT EXISTS dispensings (
    id UUID PRIMARY KEY,
    prescription_id UUID NOT NULL REFERENCES prescription_copies(id) ON DELETE CASCADE,
    pharmacist_id UUID NOT NULL,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS dispensing_lines (
    id UUID PRIMARY KEY,
    dispensing_id UUID NOT NULL REFERENCES dispensings(id) ON DELETE CASCADE,
    item_index INT NOT NULL,
    drug_id UUID NOT NULL REFERENCES drugs(id),
    quantity INT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
