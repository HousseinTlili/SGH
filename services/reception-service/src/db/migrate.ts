import { pool } from "./pool.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY,
        patient_id UUID NOT NULL,
        patient_verified BOOLEAN NOT NULL DEFAULT false,
        doctor_id UUID NOT NULL,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        reason VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
        cancel_reason VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time
        ON appointments (doctor_id, start_at, end_at);

      CREATE TABLE IF NOT EXISTS reminders (
        id UUID PRIMARY KEY,
        appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        remind_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY,
        patient_id UUID NOT NULL,
        appointment_id UUID,
        lines JSONB NOT NULL,
        total NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'TND',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        payment_method VARCHAR(10),
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS processed_events (
        event_id UUID PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
