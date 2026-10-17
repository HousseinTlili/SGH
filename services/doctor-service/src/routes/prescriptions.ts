import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles, requireDoctorWithStaffId } from "../auth/roles.js";
import { pool } from "../db/pool.js";
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

// GET /api/consultations/:id/prescriptions
prescriptionsRouter.get(
  "/api/consultations/:id/prescriptions",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PHARMACIST", "PATIENT"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      // 1. Check consultation exists
      const consultRes = await client.query(
        "SELECT patient_id FROM consultations WHERE id = $1",
        [id]
      );

      if (consultRes.rows.length === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Consultation not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // If PATIENT, must be own consultation
      if (
        req.user?.roles.includes("PATIENT") &&
        consultRes.rows[0].patient_id !== req.user.patientId
      ) {
        res.status(403).json({
          timestamp: new Date().toISOString(),
          status: 403,
          error: "Forbidden",
          message: "Your role is not allowed to do this",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // 2. Fetch prescriptions
      const rxRes = await client.query(
        "SELECT * FROM prescriptions WHERE consultation_id = $1 ORDER BY created_at ASC",
        [id]
      );

      const prescriptions = [];
      for (const rx of rxRes.rows) {
        const itemsRes = await client.query(
          "SELECT drug_name, dosage, frequency, duration FROM prescription_items WHERE prescription_id = $1 ORDER BY item_order ASC",
          [rx.id]
        );

        prescriptions.push({
          id: rx.id,
          consultationId: rx.consultation_id,
          patientId: rx.patient_id,
          doctorId: rx.doctor_id,
          items: itemsRes.rows.map((it) => ({
            drugName: it.drug_name,
            dosage: it.dosage,
            frequency: it.frequency,
            duration: it.duration
          })),
          status: rx.status,
          createdAt: new Date(rx.created_at).toISOString()
        });
      }

      res.status(200).json(prescriptions);
    } finally {
      client.release();
    }
  }
);

// POST /api/consultations/:id/prescriptions (CON-5)
prescriptionsRouter.post(
  "/api/consultations/:id/prescriptions",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      // 1. Check consultation exists
      const consultRes = await client.query(
        "SELECT patient_id, doctor_id, status FROM consultations WHERE id = $1",
        [id]
      );

      if (consultRes.rows.length === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Consultation not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const consultation = consultRes.rows[0];

      // Must be own doctor
      if (consultation.doctor_id !== req.user!.staffId) {
        res.status(403).json({
          timestamp: new Date().toISOString(),
          status: 403,
          error: "Forbidden",
          message: "You can only prescribe for your own consultations",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // 2. Validate input
      const parseResult = PrescriptionInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((err) => ({
          field: err.path.join("."),
          problem: err.message
        }));
        res.status(422).json({
          timestamp: new Date().toISOString(),
          status: 422,
          error: "Unprocessable Entity",
          message: "Validation failed",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId,
          details
        });
        return;
      }

      const { items } = parseResult.data;
      const prescriptionId = crypto.randomUUID();
      const now = new Date().toISOString();

      await client.query("BEGIN");

      // Insert prescription
      await client.query(
        `INSERT INTO prescriptions (id, consultation_id, patient_id, doctor_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'ISSUED', $5)`,
        [prescriptionId, id, consultation.patient_id, req.user!.staffId, now]
      );

      // Insert items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
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
            i
          ]
        );
      }

      await client.query("COMMIT");

      // Publish event asynchronously after commit
      publishEventAsync(
        "prescription.created",
        {
          prescriptionId,
          consultationId: id,
          patientId: consultation.patient_id,
          doctorId: req.user!.staffId,
          items
        },
        req.correlationId
      );

      res.status(201).json({
        id: prescriptionId,
        consultationId: id,
        patientId: consultation.patient_id,
        doctorId: req.user!.staffId,
        items,
        status: "ISSUED",
        createdAt: now
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);
