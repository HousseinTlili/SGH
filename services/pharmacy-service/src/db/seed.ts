import crypto from "crypto";
import { pool } from "./pool.js";
import { logger } from "../middleware/logger.js";

interface DrugSeed {
  id: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  stock: number;
  reorderThreshold: number;
}

const SEED_DRUGS: DrugSeed[] = [
  {
    id: "d4d4d4d4-0000-4000-8000-000000000001",
    name: "Paracetamol",
    form: "TABLET",
    strength: "500 mg",
    unit: "tablet",
    stock: 500,
    reorderThreshold: 100
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000002",
    name: "Ibuprofen",
    form: "TABLET",
    strength: "400 mg",
    unit: "tablet",
    stock: 300,
    reorderThreshold: 80
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000003",
    name: "Amoxicillin",
    form: "CAPSULE",
    strength: "500 mg",
    unit: "capsule",
    stock: 55,
    reorderThreshold: 60
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000004",
    name: "Omeprazole",
    form: "CAPSULE",
    strength: "20 mg",
    unit: "capsule",
    stock: 150,
    reorderThreshold: 50
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000005",
    name: "Metformin",
    form: "TABLET",
    strength: "850 mg",
    unit: "tablet",
    stock: 400,
    reorderThreshold: 100
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000006",
    name: "Amlodipine",
    form: "TABLET",
    strength: "5 mg",
    unit: "tablet",
    stock: 250,
    reorderThreshold: 70
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000007",
    name: "Atorvastatin",
    form: "TABLET",
    strength: "20 mg",
    unit: "tablet",
    stock: 180,
    reorderThreshold: 60
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000008",
    name: "Salbutamol",
    form: "INHALER",
    strength: "100 mcg/dose",
    unit: "inhaler",
    stock: 120,
    reorderThreshold: 30
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000009",
    name: "Cetirizine",
    form: "TABLET",
    strength: "10 mg",
    unit: "tablet",
    stock: 220,
    reorderThreshold: 50
  },
  {
    id: "d4d4d4d4-0000-4000-8000-000000000010",
    name: "Insulin glargine",
    form: "INJECTION",
    strength: "100 IU/ml",
    unit: "vial",
    stock: 40,
    reorderThreshold: 20
  }
];

export async function runSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Seed drugs
    for (const drug of SEED_DRUGS) {
      await client.query(
        `INSERT INTO drugs (id, name, form, strength, unit, stock, reorder_threshold, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-10-12T08:00:00Z', '2026-10-12T08:00:00Z')
         ON CONFLICT (id) DO NOTHING`,
        [
          drug.id,
          drug.name,
          drug.form,
          drug.strength,
          drug.unit,
          drug.stock,
          drug.reorderThreshold
        ]
      );
    }

    // 2. Seed Prescription R1
    const r1Id = "f8f8f8f8-0000-4000-8000-000000000001";
    const r1ConsultationId = "f7f7f7f7-0000-4000-8000-000000000001";
    const r1PatientId = "a1a1a1a1-0000-4000-8000-000000000005";
    const r1DoctorId = "b2b2b2b2-0000-4000-8000-000000000002";
    const r1CreatedAt = "2026-10-10T11:35:00Z";

    const rxExists = await client.query(
      "SELECT 1 FROM prescription_copies WHERE id = $1",
      [r1Id]
    );

    if (rxExists.rowCount === 0) {
      await client.query(
        `INSERT INTO prescription_copies (id, consultation_id, patient_id, doctor_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ISSUED', $5, $5)`,
        [r1Id, r1ConsultationId, r1PatientId, r1DoctorId, r1CreatedAt]
      );

      // Item 0: Paracetamol 500 mg
      await client.query(
        `INSERT INTO prescription_items (id, prescription_id, item_index, drug_name, dosage, frequency, duration, dispensed)
         VALUES ($1, $2, 0, 'Paracetamol 500 mg', '1 tablet', '3 per day', '5 days', false)`,
        [crypto.randomUUID(), r1Id]
      );

      // Item 1: Cetirizine 10 mg
      await client.query(
        `INSERT INTO prescription_items (id, prescription_id, item_index, drug_name, dosage, frequency, duration, dispensed)
         VALUES ($1, $2, 1, 'Cetirizine 10 mg', '1 tablet', '1 per day', '7 days', false)`,
        [crypto.randomUUID(), r1Id]
      );
    }

    await client.query("COMMIT");
    logger.info("Pharmacy database seeding completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
