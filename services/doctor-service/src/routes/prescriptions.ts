import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles, requireDoctorWithStaffId } from "../auth/roles.js";
import { pool, withTransaction } from "../db/pool.js";
import { forbidden, notFound, parseOrThrow, uuidParam } from "../http/errors.js";
import { publishEventAsync } from "../events/amqp.js";

export const prescriptionsRouter = Router();

const PrescriptionItemInputSchema = z.object({
  drugName: z.string().min(1).max(120),
  dosage: z.string().min(1).max(60),
  frequency: z.string().min(1).max(60),
  duration: z.string().min(1).max(60)
});

const PrescriptionInputSchema = z.object({
  items: z.array(PrescriptionItemInputSchema).min(1).max(20)
});

// GET /api/consultations/:id/prescriptions (CON-10)
prescriptionsRouter.get(
  "/api/consultations/:id/prescriptions",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PHARMACIST", "PATIENT"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string, "Consultation");
    const consultation = await pool.query(
      "SELECT patient_id FROM consultations WHERE id = $1",
      [id]
    );
    if (consultation.rows.length === 0) throw notFound("Consultation not found");

    if (
      req.user!.roles.includes("PATIENT") &&
      consultation.rows[0].patient_id !== req.user!.patientId
    ) {
      throw forbidden();
    }

    const prescriptions = await pool.query(
      "SELECT * FROM prescriptions WHERE consultation_id = $1 ORDER BY created_at ASC",
      [id]
    );
    const items = await pool.query(
      `SELECT prescription_id, drug_name, dosage, frequency, duration
         FROM prescription_items
        WHERE prescription_id = ANY($1::uuid[])
        ORDER BY item_order ASC`,
      [prescriptions.rows.map((rx) => rx.id)]
    );

    res.status(200).json(
      prescriptions.rows.map((rx) => ({
        id: rx.id,
        consultationId: rx.consultation_id,
        patientId: rx.patient_id,
        doctorId: rx.doctor_id,
        items: items.rows
          .filter((it) => it.prescription_id === rx.id)
          .map((it) => ({
            drugName: it.drug_name,
            dosage: it.dosage,
            frequency: it.frequency,
            duration: it.duration
          })),
        status: rx.status,
        createdAt: new Date(rx.created_at).toISOString()
      }))
    );
  }
);

// POST /api/consultations/:id/prescriptions (CON-5)
prescriptionsRouter.post(
  "/api/consultations/:id/prescriptions",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string, "Consultation");
    const consultation = await pool.query(
      "SELECT patient_id, doctor_id FROM consultations WHERE id = $1",
      [id]
    );
    if (consultation.rows.length === 0) throw notFound("Consultation not found");

    const { patient_id: patientId, doctor_id: ownerId } = consultation.rows[0];
    const doctorId = req.user!.staffId!;
    if (ownerId !== doctorId) {
      throw forbidden("You can only prescribe for your own consultations");
    }

    const { items } = parseOrThrow(PrescriptionInputSchema, req.body);
    const prescriptionId = crypto.randomUUID();
    const createdAt = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO prescriptions (id, consultation_id, patient_id, doctor_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'ISSUED', now())
         RETURNING created_at`,
        [prescriptionId, id, patientId, doctorId]
      );
      for (const [order, item] of items.entries()) {
        await client.query(
          `INSERT INTO prescription_items (id, prescription_id, drug_name, dosage, frequency, duration, item_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            crypto.randomUUID(),
            prescriptionId,
            item.drugName,
            item.dosage,
            item.frequency,
            item.duration,
            order
          ]
        );
      }
      return new Date(inserted.rows[0].created_at).toISOString();
    });

    // After commit, never delaying or failing the HTTP response (X-5 / publish rule).
    publishEventAsync(
      "prescription.created",
      { prescriptionId, consultationId: id, patientId, doctorId, items },
      req.correlationId
    );

    res.status(201).json({
      id: prescriptionId,
      consultationId: id,
      patientId,
      doctorId,
      items,
      status: "ISSUED",
      createdAt
    });
  }
);
