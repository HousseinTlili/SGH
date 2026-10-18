-- Table: patients
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    blood_type VARCHAR(10),
    allergies TEXT,
    insurance_provider VARCHAR(100),
    insurance_number VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Case-insensitive duplicate check index (PAT-2)
CREATE INDEX IF NOT EXISTS idx_patients_name_dob ON patients (LOWER(first_name), LOWER(last_name), birth_date);
CREATE INDEX IF NOT EXISTS idx_patients_deleted ON patients (deleted);

-- Table: medical_file_entries
CREATE TABLE IF NOT EXISTS medical_file_entries (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    source_service VARCHAR(50) NOT NULL,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_file_patient ON medical_file_entries (patient_id, created_at DESC);

-- Table: processed_events (shared standard X-5)
CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
