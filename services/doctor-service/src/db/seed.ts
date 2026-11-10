import { pool } from "./pool.js";

export async function runSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Consultation C1
    await client.query(
      `INSERT INTO consultations (
        id, appointment_id, patient_id, patient_snapshot, doctor_id, doctor_specialty,
        subjective, objective, assessment, plan, status, signed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET doctor_specialty = EXCLUDED.doctor_specialty`,
      [
        "f7f7f7f7-0000-4000-8000-000000000001",
        "e5e5e5e5-0000-4000-8000-000000000004",
        "a1a1a1a1-0000-4000-8000-000000000005",
        JSON.stringify({ fullName: "Hatem Dridi", birthDate: "1965-05-18" }),
        "b2b2b2b2-0000-4000-8000-000000000002",
        "General practice",
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
        id, appointment_id, patient_id, patient_snapshot, doctor_id, doctor_specialty,
        subjective, objective, assessment, plan, status, signed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET doctor_specialty = EXCLUDED.doctor_specialty`,
      [
        "f7f7f7f7-0000-4000-8000-000000000002",
        "e5e5e5e5-0000-4000-8000-000000000003",
        "a1a1a1a1-0000-4000-8000-000000000003",
        JSON.stringify({ fullName: "Nizar Khelifi", birthDate: "1978-11-02" }),
        "b2b2b2b2-0000-4000-8000-000000000001",
        "Cardiology",
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

    // 8. Sample Clinical Attachment (Cardiology ECG)
    const sampleEcgSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240"><rect width="100%" height="100%" fill="%230f172a"/><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="%23334155" stroke-width="0.8"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grid)"/><path d="M 10 120 L 50 120 L 60 110 L 70 120 L 90 120 L 95 140 L 105 30 L 115 160 L 125 120 L 150 120 L 170 100 L 190 120 L 250 120 L 260 110 L 270 120 L 290 120 L 295 140 L 305 30 L 315 160 L 325 120 L 350 120 L 370 100 L 390 120 L 450 120 L 455 140 L 465 30 L 475 160 L 485 120 L 510 120 L 530 100 L 550 120 L 590 120" fill="none" stroke="%2338bdf8" stroke-width="2.5"/><text x="20" y="30" fill="%23e2e8f0" font-family="monospace" font-size="13" font-weight="bold">LEAD II - 25mm/s 10mm/mV (HR: 76 bpm)</text></svg>`;

    await client.query(
      `INSERT INTO consultation_attachments (
        id, consultation_id, file_name, file_type, file_size, data, caption, uploaded_by, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (id) DO NOTHING`,
      [
        "fbfbfb00-0000-4000-8000-000000000001",
        "f7f7f7f7-0000-4000-8000-000000000002",
        "cardiac-lead2-rhythm.svg",
        "image/svg+xml",
        sampleEcgSvg.length,
        sampleEcgSvg,
        "Lead II Telemetry strip indicating regular sinus rhythm at 76 bpm",
        "b2b2b2b2-0000-4000-8000-000000000001"
      ]
    );

    // 9. Historical Consultations & Longitudinal Vitals for Standard Patients (1 to 8)
    await client.query(`
      INSERT INTO consultations (
        id, patient_id, doctor_id, doctor_specialty, subjective, objective, assessment, plan, status, signed_at, created_at, updated_at
      ) VALUES 
      (
        'c1010101-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000004', 'b2b2b2b2-0000-4000-8000-000000000001', 'Cardiology',
        'Patient reports episodes of rapid heart rate and mild morning headaches over past 3 weeks.',
        'BP 142/92 mmHg, HR 88 bpm. Heart sounds regular S1/S2 present, no murmurs.',
        'Stage 1 essential hypertension with sinus tachycardia.',
        '1. Initiate Ramipril 5mg PO daily\n2. Low-sodium diet\n3. Ordered baseline ECG and lipid profile.',
        'SIGNED', '2026-10-10T11:45:00Z', '2026-10-10T10:30:00Z', '2026-10-10T11:45:00Z'
      ),
      (
        'c1010101-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000004', 'b2b2b2b2-0000-4000-8000-000000000001', 'Cardiology',
        'Follow-up visit. Headache resolved, palpitation frequency reduced from daily to once weekly.',
        'BP 130/84 mmHg, HR 78 bpm. Bilateral lung bases clear, peripheral pulses intact.',
        'Hypertension well controlled on current ACE inhibitor regimen. Palpitations stabilized.',
        '1. Maintain Ramipril 5mg daily\n2. Order 24h Holter monitor\n3. Repeat blood pressure evaluation in 10 days.',
        'SIGNED', '2026-10-30T10:15:00Z', '2026-10-30T09:30:00Z', '2026-10-30T10:15:00Z'
      ),
      (
        'c1010101-0000-4000-8000-000000000031', 'a1a1a1a1-0000-4000-8000-000000000003', 'b2b2b2b2-0000-4000-8000-000000000001', 'Cardiology',
        'Patient reports occasional chest tightness when walking up stairs.',
        'BP 140/90 mmHg, HR 84 bpm, SpO2 98%. Heart sounds regular, no S3/S4.',
        'Mild exertion-induced angina pectoris, suspect stable coronary disease.',
        '1. Rest and nitroglycerin PRN\n2. Schedule stress echocardiogram\n3. Start Atorvastatin 20mg and Aspirin 100mg daily.',
        'SIGNED', '2026-10-22T11:00:00Z', '2026-10-22T10:15:00Z', '2026-10-22T11:00:00Z'
      ),
      (
        'c1010101-0000-4000-8000-000000000061', 'a1a1a1a1-0000-4000-8000-000000000006', 'b2b2b2b2-0000-4000-8000-000000000001', 'Cardiology',
        'Routine prenatal cardiac check. Reports mild fatigue in the afternoon.',
        'BP 115/75 mmHg, HR 80 bpm, heart regular, no signs of gestational hypertension.',
        'Normal hemodynamic adaptation to pregnancy. No cardiovascular contraindications.',
        'Maintain prenatal hydration and iron supplements. Review in third trimester.',
        'SIGNED', '2026-10-15T14:30:00Z', '2026-10-15T14:00:00Z', '2026-10-15T14:30:00Z'
      ),
      (
        'c1010101-0000-4000-8000-000000000071', 'a1a1a1a1-0000-4000-8000-000000000007', 'b2b2b2b2-0000-4000-8000-000000000002', 'General practice',
        'Pre-employment medical examination. Reports excellent general health.',
        'BP 122/78 mmHg, HR 68 bpm, BMI 23.4. Vision, hearing, and musculoskeletal exams normal.',
        'Healthy young adult. Medically fit for employment.',
        'Issued medical fitness certificate. Routine annual check recommended.',
        'SIGNED', '2026-10-28T09:00:00Z', '2026-10-28T08:30:00Z', '2026-10-28T09:00:00Z'
      ),
      (
        'c1010101-0000-4000-8000-000000000081', 'a1a1a1a1-0000-4000-8000-000000000008', 'b2b2b2b2-0000-4000-8000-000000000001', 'Cardiology',
        'Referred for cardiac evaluation due to family history of early coronary artery disease.',
        'BP 125/80 mmHg, HR 72 bpm. S1/S2 normal, carotid bruits absent, peripheral pulses crisp.',
        'Elevated cardiovascular risk profile by family history; asymptomatic with normal baseline exam.',
        '1. Lipid panel and fasting glucose\n2. Exercise treadmill stress test\n3. Dietary optimization.',
        'SIGNED', '2026-10-20T16:00:00Z', '2026-10-20T15:20:00Z', '2026-10-20T16:00:00Z'
      )
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
