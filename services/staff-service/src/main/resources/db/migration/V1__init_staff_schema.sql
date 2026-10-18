-- Schema for sgh_staff
CREATE TABLE IF NOT EXISTS staff_members (
    id UUID PRIMARY KEY,
    keycloak_user_id UUID NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    role VARCHAR(30) NOT NULL,
    specialty VARCHAR(80) NULL,
    department VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_email UNIQUE (email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email_lower ON staff_members (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_staff_active_role ON staff_members (active, role);
CREATE INDEX IF NOT EXISTS idx_staff_last_name ON staff_members (last_name);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(100) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
