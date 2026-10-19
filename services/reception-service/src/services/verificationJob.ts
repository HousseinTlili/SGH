import { pool } from "../db/pool.js";
import { getReceptionServiceToken } from "./authClient.js";
import { checkPatientSummary } from "./patientClient.js";
import { logger } from "../middleware/logger.js";

export async function runPatientReverificationJob(): Promise<number> {
  let verifiedCount = 0;
  try {
    const res = await pool.query(`
      SELECT id, patient_id
      FROM appointments
      WHERE patient_verified = false
        AND status IN ('SCHEDULED', 'CHECKED_IN')
      LIMIT 50
    `);

    if (res.rows.length === 0) {
      return 0;
    }

    const token = await getReceptionServiceToken();
    if (!token) {
      logger.warn("Re-verification job skipped: could not obtain service token");
      return 0;
    }

    for (const row of res.rows) {
      const check = await checkPatientSummary(row.patient_id, token, "reverify-job");
      if (check.status === "FOUND") {
        await pool.query(
          "UPDATE appointments SET patient_verified = true, updated_at = now() WHERE id = $1",
          [row.id]
        );
        verifiedCount++;
      }
    }

    if (verifiedCount > 0) {
      logger.info({ verifiedCount }, "Re-verification job updated patientVerified status");
    }
  } catch (err) {
    logger.error({ err }, "Error in patient re-verification job");
  }
  return verifiedCount;
}

export async function runMockRemindersJob(): Promise<number> {
  let createdCount = 0;
  try {
    // Find SCHEDULED appointments for tomorrow that don't have a reminder
    const res = await pool.query(`
      SELECT a.id, a.start_at
      FROM appointments a
      LEFT JOIN reminders r ON r.appointment_id = a.id
      WHERE a.status = 'SCHEDULED'
        AND r.id IS NULL
        AND a.start_at > now()
        AND a.start_at <= now() + interval '48 hours'
      LIMIT 50
    `);

    for (const row of res.rows) {
      const remindAt = new Date(new Date(row.start_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
      await pool.query(`
        INSERT INTO reminders (id, appointment_id, remind_at, status, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'PENDING', now())
        ON CONFLICT DO NOTHING
      `, [row.id, remindAt]);
      createdCount++;
    }
  } catch (err) {
    logger.error({ err }, "Error in mock reminders job");
  }
  return createdCount;
}
