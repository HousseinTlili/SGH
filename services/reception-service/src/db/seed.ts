import { pool } from "./pool.js";

export async function runSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Relative dates anchored to today at midnight UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    const a1Start = new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000).toISOString();
    const a1End = new Date(tomorrow.getTime() + 9.5 * 60 * 60 * 1000).toISOString();

    const a2Start = new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000).toISOString();
    const a2End = new Date(tomorrow.getTime() + 10.5 * 60 * 60 * 1000).toISOString();

    const a3Start = new Date(today.getTime() + 8.5 * 60 * 60 * 1000).toISOString();
    const a3End = new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString();

    const a4Start = new Date(twoDaysAgo.getTime() + 11 * 60 * 60 * 1000).toISOString();
    const a4End = new Date(twoDaysAgo.getTime() + 11.5 * 60 * 60 * 1000).toISOString();

    const a5Start = new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000).toISOString();
    const a5End = new Date(tomorrow.getTime() + 14.5 * 60 * 60 * 1000).toISOString();

    // Appointments (A1 - A5)
    await client.query(`
      INSERT INTO appointments (id, patient_id, patient_verified, doctor_id, start_at, end_at, reason, status, cancel_reason, created_at, updated_at)
      VALUES
        ('e5e5e5e5-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', true, 'b2b2b2b2-0000-4000-8000-000000000001', $1, $2, 'Cardiology follow-up', 'SCHEDULED', NULL, now(), now()),
        ('e5e5e5e5-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000002', true, 'b2b2b2b2-0000-4000-8000-000000000002', $3, $4, 'General check-up', 'SCHEDULED', NULL, now(), now()),
        ('e5e5e5e5-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000003', true, 'b2b2b2b2-0000-4000-8000-000000000001', $5, $6, 'Chest discomfort', 'CHECKED_IN', NULL, now(), now()),
        ('e5e5e5e5-0000-4000-8000-000000000004', 'a1a1a1a1-0000-4000-8000-000000000005', true, 'b2b2b2b2-0000-4000-8000-000000000002', $7, $8, 'Persistent cough', 'COMPLETED', NULL, now(), now()),
        ('e5e5e5e5-0000-4000-8000-000000000005', 'a1a1a1a1-0000-4000-8000-000000000006', false, 'b2b2b2b2-0000-4000-8000-000000000001', $9, $10, 'Routine checkup', 'SCHEDULED', NULL, now(), now())
      ON CONFLICT (id) DO NOTHING;
    `, [a1Start, a1End, a2Start, a2End, a3Start, a3End, a4Start, a4End, a5Start, a5End]);

    // Invoices (INV1, INV2)
    const inv1Lines = JSON.stringify([
      { description: "General consultation", quantity: 1, unitPrice: 50.0 },
      { description: "Blood tests (HGB, WBC)", quantity: 1, unitPrice: 30.0 }
    ]);
    const inv2Lines = JSON.stringify([
      { description: "Cardiology consultation", quantity: 1, unitPrice: 70.0 }
    ]);

    const inv1PaidAt = new Date(twoDaysAgo.getTime() + 11.75 * 60 * 60 * 1000).toISOString();
    const inv1CreatedAt = new Date(twoDaysAgo.getTime() + 11.58 * 60 * 60 * 1000).toISOString();
    const inv2CreatedAt = new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString();

    await client.query(`
      INSERT INTO invoices (id, patient_id, appointment_id, lines, total, currency, status, payment_method, paid_at, created_at)
      VALUES
        ('e6e6e6e6-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000005', 'e5e5e5e5-0000-4000-8000-000000000004', $1::jsonb, 80.00, 'TND', 'PAID', 'CASH', $2, $3),
        ('e6e6e6e6-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000003', 'e5e5e5e5-0000-4000-8000-000000000003', $4::jsonb, 70.00, 'TND', 'PENDING', NULL, NULL, $5)
      ON CONFLICT (id) DO NOTHING;
    `, [inv1Lines, inv1PaidAt, inv1CreatedAt, inv2Lines, inv2CreatedAt]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
