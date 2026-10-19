-- REC-9: one SMS and one EMAIL reminder per appointment, mock-sent by the job (sent_at, status SENT).
--
-- The earlier job wrote a single reminder that was never sent and left it PENDING. Such a row would
-- make the new job think the appointment already has its reminders, so they are removed here and
-- the job recreates and sends them. (Only rows of the old shape can exist at this point.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'reminders' AND column_name = 'remind_at') THEN
    DELETE FROM reminders WHERE status = 'PENDING';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'reminders' AND column_name = 'remind_at') THEN
    ALTER TABLE reminders RENAME COLUMN remind_at TO send_at;
  END IF;
END $$;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS channel VARCHAR(10) NOT NULL DEFAULT 'SMS';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Idempotency for the job: at most one reminder per appointment and channel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminders_appointment_channel ON reminders (appointment_id, channel);
