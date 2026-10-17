import { pool } from "./pool.js";

export async function runSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Consultation C1
    await client.query(
      `INSERT INTO consultations (
        id, appointment_id, patient_id, patient_snapshot, doctor_id,
        subjective, objective, assessment, plan, status, signed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING`,
      [
        "f7f7f7f7-0000-4000-8000-000000000001",
        "e5e5e5e5-0000-4000-8000-000000000004",
        "a1a1a1a1-0000-4000-8000-000000000005",
        JSON.stringify({ fullName: "Hatem Dridi", birthDate: "1965-05-18" }),
        "b2b2b2b2-0000-4000-8000-000000000002",
        "Persistent cough for two weeks",
        "Temperature 37.2, lungs clear on auscultation",
        "Likely viral bronchitis",
        "Rest, fluids, review if no improvement after one week",
        "SIGNED",
        "2026-10-10T11:40:00Z",
        "2026-10-10T11:05:00Z",
        "2026-10-10T11:40:00Z"
      ]
    );

    // 2. Consultation C2
    await client.query(
      `INSERT INTO consultations (
        id, appointment_id, patient_id, patient_snapshot, doctor_id,
        subjective, objective, assessment, plan, status, signed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING`,
      [
        "f7f7f7f7-0000-4000-8000-000000000002",
        "e5e5e5e5-0000-4000-8000-000000000003",
        "a1a1a1a1-0000-4000-8000-000000000003",
        JSON.stringify({ fullName: "Nizar Khelifi", birthDate: "1978-11-02" }),
        "b2b2b2b2-0000-4000-8000-000000000001",
        "Chest discomfort since yesterday",
        null,
        null,
        null,
        "DRAFT",
        null,
        "2026-10-12T08:30:00Z",
        "2026-10-12T08:30:00Z"
      ]
    );

    // 3. Vital Signs V1
    await client.query(
      `INSERT INTO vital_signs (
        id, patient_id, consultation_id, recorded_by, temperature,
        heart_rate, systolic, diastolic, spo2, weight, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING`,
      [
        "fafafafa-0000-4000-8000-000000000001",
        "a1a1a1a1-0000-4000-8000-000000000005",
        "f7f7f7f7-0000-4000-8000-000000000001",
        "b2b2b2b2-0000-4000-8000-000000000003",
        37.2,
        78,
        128,
        82,
        98,
        82.5,
        "2026-10-10T10:45:00Z"
      ]
    );

    // 4. Vital Signs V2
    await client.query(
      `INSERT INTO vital_signs (
        id, patient_id, consultation_id, recorded_by, temperature,
        heart_rate, systolic, diastolic, spo2, weight, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING`,
      [
        "fafafafa-0000-4000-8000-000000000002",
        "a1a1a1a1-0000-4000-8000-000000000003",
        "f7f7f7f7-0000-4000-8000-000000000002",
        "b2b2b2b2-0000-4000-8000-000000000003",
        36.8,
        96,
        145,
        92,
        97,
        90.0,
        "2026-10-12T08:15:00Z"
      ]
    );

    // 5. Prescription R1
    await client.query(
      `INSERT INTO prescriptions (
        id, consultation_id, patient_id, doctor_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING`,
      [
        "f8f8f8f8-0000-4000-8000-000000000001",
        "f7f7f7f7-0000-4000-8000-000000000001",
        "a1a1a1a1-0000-4000-8000-000000000005",
        "b2b2b2b2-0000-4000-8000-000000000002",
        "ISSUED",
        "2026-10-10T11:35:00Z"
      ]
    );

    // Prescription R1 items
    await client.query(
      `INSERT INTO prescription_items (
        id, prescription_id, drug_name, dosage, frequency, duration, item_order
      ) VALUES 
      ('f8f8f8f8-0000-4000-8000-000000000011', 'f8f8f8f8-0000-4000-8000-000000000001', 'Paracetamol 500 mg', '1 tablet', '3 per day', '5 days', 0),
      ('f8f8f8f8-0000-4000-8000-000000000012', 'f8f8f8f8-0000-4000-8000-000000000001', 'Cetirizine 10 mg', '1 tablet', '1 per day', '7 days', 1)
      ON CONFLICT (id) DO NOTHING`
    );

    // 6. Lab Order L1 (VALIDATED)
    await client.query(
      `INSERT INTO lab_orders (
        id, consultation_id, patient_id, doctor_id, priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING`,
      [
        "f9f9f9f9-0000-4000-8000-000000000001",
        "f7f7f7f7-0000-4000-8000-000000000001",
        "a1a1a1a1-0000-4000-8000-000000000005",
        "b2b2b2b2-0000-4000-8000-000000000002",
        "ROUTINE",
        "VALIDATED",
        "2026-10-10T11:30:00Z"
      ]
    );

    // Lab Order L1 tests
    await client.query(
      `INSERT INTO lab_order_tests (
        id, lab_order_id, code, name
      ) VALUES 
      ('f9f9f9f9-0000-4000-8000-000000000011', 'f9f9f9f9-0000-4000-8000-000000000001', 'HGB', 'Hemoglobin'),
      ('f9f9f9f9-0000-4000-8000-000000000012', 'f9f9f9f9-0000-4000-8000-000000000001', 'WBC', 'White blood cells')
      ON CONFLICT (id) DO NOTHING`
    );

    // Lab Result Copy for L1
    await client.query(
      `INSERT INTO lab_result_copies (
        lab_request_id, consultation_id, patient_id, validated_by, validated_at, results
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (lab_request_id) DO NOTHING`,
      [
        "f9f9f9f9-0000-4000-8000-000000000001",
        "f7f7f7f7-0000-4000-8000-000000000001",
        "a1a1a1a1-0000-4000-8000-000000000005",
        "b2b2b2b2-0000-4000-8000-000000000004",
        "2026-10-10T15:00:00Z",
        JSON.stringify([
          {
            testCode: "HGB",
            value: 14.2,
            unit: "g/dL",
            referenceRange: "12.0-17.0",
            flag: "NORMAL"
          },
          {
            testCode: "WBC",
            value: 12.5,
            unit: "10^9/L",
            referenceRange: "4.0-11.0",
            flag: "HIGH"
          }
        ])
      ]
    );

    // 7. Lab Order L2 (REQUESTED)
    await client.query(
      `INSERT INTO lab_orders (
        id, consultation_id, patient_id, doctor_id, priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING`,
      [
        "f9f9f9f9-0000-4000-8000-000000000002",
        "f7f7f7f7-0000-4000-8000-000000000002",
        "a1a1a1a1-0000-4000-8000-000000000003",
        "b2b2b2b2-0000-4000-8000-000000000001",
        "URGENT",
        "REQUESTED",
        "2026-10-12T08:50:00Z"
      ]
    );

    // Lab Order L2 tests
    await client.query(
      `INSERT INTO lab_order_tests (
        id, lab_order_id, code, name
      ) VALUES 
      ('f9f9f9f9-0000-4000-8000-000000000021', 'f9f9f9f9-0000-4000-8000-000000000002', 'K', 'Potassium'),
      ('f9f9f9f9-0000-4000-8000-000000000022', 'f9f9f9f9-0000-4000-8000-000000000002', 'CRE', 'Creatinine')
      ON CONFLICT (id) DO NOTHING`
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
