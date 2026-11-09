import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });
pool.on('error', () => {});

let ready = false;
export const isDbReady = () => ready;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'INFO';
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (read);
CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function initDb(): Promise<void> {
  for (;;) {
    try {
      await pool.query(SCHEMA);
      ready = true;
      console.log('Base de donnees prete');
      return;
    } catch {
      console.log('Base indisponible, nouvel essai dans 5 s...');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
