import { pool, getDatabaseReady } from "../db/pool.js";
import { getReceptionServiceToken } from "./authClient.js";
import { checkPatientSummary } from "./patientClient.js";
import { logger } from "../middleware/logger.js";

const JOB_INTERVAL_MS = 60_000;

/**
 * REC-6: appointments booked while the Patient service was down carry patientVerified = false.
 * The job has no caller token, so it uses the service account (D28). A 404 only logs a warning.
 */
export async function runPatientReverificationJob(): Promise<number> {
  let verifiedCount = 0;
  try {
    const pending = await pool.query(`
      SELECT id, patient_id
        FROM appointments
       WHERE patient_verified = false
         AND status IN ('SCHEDULED', 'CHECKED_IN')
       ORDER BY created_at
       LIMIT 50
    `);
    if (pending.rows.length === 0) return 0;

    const token = await getReceptionServiceToken();
    if (!token) {
      logger.warn("Re-verification skipped: could not obtain the service token");
      return 0;
    }

    for (const row of pending.rows) {
      const result = await checkPatientSummary(row.patient_id, token, "reverify-job");
      if (result === "FOUND") {
        await pool.query(
          "UPDATE appointments SET patient_verified = true, updated_at = now() WHERE id = $1",
          [row.id]
        );
        verifiedCount++;
      } else if (result === "NOT_FOUND") {
        logger.warn({ appointmentId: row.id, patientId: row.patient_id }, "Patient still unknown to the Patient service");
      }
    }
    if (verifiedCount > 0) {
      logger.info({ verifiedCount }, "Re-verification job confirmed patients");
    }
  } catch (err) {
    logger.error({ err }, "Error in patient re-verification job");
  }
  return verifiedCount;
}

/**
 * REC-9: for every SCHEDULED appointment starting within the next 24 hours that has no reminders yet,
 * create one SMS and one EMAIL reminder. Sending is mocked: one log line per reminder, then SENT.
 */
export async function runMockRemindersJob(): Promise<number> {
  let sent = 0;
  try {
    const due = await pool.query(`
      SELECT a.id, a.patient_id, a.start_at
        FROM appointments a
       WHERE a.status = 'SCHEDULED'
         AND a.start_at > now()
         AND a.start_at <= now() + interval '24 hours'
         AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.appointment_id = a.id)
       ORDER BY a.start_at
       LIMIT 50
    `);

    for (const appt of due.rows) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const channel of ["SMS", "EMAIL"]) {
          const created = await client.query(
            `INSERT INTO reminders (id, appointment_id, channel, send_at, sent_at, status, created_at)
             VALUES (gen_random_uuid(), $1, $2, now(), now(), 'SENT', now())
             ON CONFLICT (appointment_id, channel) DO NOTHING
             RETURNING id`,
            [appt.id, channel]
          );
          if (created.rowCount) {
            logger.info(
              `REMINDER channel=${channel} appointmentId=${appt.id} patientId=${appt.patient_id} startAt=${new Date(appt.start_at).toISOString()}`
            );
            sent++;
          }
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in reminders job");
  }
  return sent;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runBackgroundJobsOnce(): Promise<void> {
  // A run that is still going (slow peer) must not be overlapped by the next tick.
  if (running || !getDatabaseReady()) return;
  running = true;
  try {
    await runPatientReverificationJob();
    await runMockRemindersJob();
  } finally {
    running = false;
  }
}

/** Starts the 60-second loop; a failing dependency never stops it (jobs catch their own errors). */
export function startBackgroundJobs(): void {
  if (timer) return;
  timer = setInterval(() => void runBackgroundJobsOnce(), JOB_INTERVAL_MS);
  timer.unref();
}

export function stopBackgroundJobs(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
