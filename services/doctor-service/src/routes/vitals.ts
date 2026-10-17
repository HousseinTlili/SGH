import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import { pool } from "../db/pool.js";

export const vitalsRouter = Router();

function formatVitalSigns(row: any) {
  return {
    id: row.id,
    patientId: row.patient_id,
    consultationId: row.consultation_id || null,
    recordedBy: row.recorded_by,
    temperature: row.temperature !== null ? parseFloat(row.temperature) : undefined,
    heartRate: row.heart_rate !== null ? row.heart_rate : undefined,
    systolic: row.systolic !== null ? row.systolic : undefined,
    diastolic: row.diastolic !== null ? row.diastolic : undefined,
    spo2: row.spo2 !== null ? row.spo2 : undefined,
    weight: row.weight !== null ? parseFloat(row.weight) : undefined,
    recordedAt: new Date(row.recorded_at).toISOString()
  };
}

const VitalSignsInputSchema = z
  .object({
    patientId: z.string().uuid("patientId must be a valid UUID"),
    consultationId: z.string().uuid().nullable().optional(),
    temperature: z.number().min(30.0).max(45.0).optional(),
    heartRate: z.number().int().min(20).max(250).optional(),
    systolic: z.number().int().min(50).max(260).optional(),
    diastolic: z.number().int().min(30).max(160).optional(),
    spo2: z.number().int().min(50).max(100).optional(),
    weight: z.number().min(0.5).max(400.0).optional()
  })
  .superRefine((data, ctx) => {
    const hasMeasurement =
      data.temperature !== undefined ||
      data.heartRate !== undefined ||
      data.systolic !== undefined ||
      data.diastolic !== undefined ||
      data.spo2 !== undefined ||
      data.weight !== undefined;

    if (!hasMeasurement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["measurements"],
        message: "At least one measurement is required"
      });
    }

    if (
      data.systolic !== undefined &&
      data.diastolic !== undefined &&
      data.diastolic >= data.systolic
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diastolic"],
        message: "must be lower than systolic"
      });
    }
  });

// POST /api/vitals (CON-8)
vitalsRouter.post(
  "/api/vitals",
  authenticateToken,
  requireRoles("NURSE", "DOCTOR"),
  async (req: Request, res: Response) => {
    if (!req.user?.staffId) {
      res.status(403).json({
        timestamp: new Date().toISOString(),
        status: 403,
        error: "Forbidden",
        message: "Token missing staffId claim",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const parseResult = VitalSignsInputSchema.safeParse(req.body);
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

    const data = parseResult.data;
    const id = crypto.randomUUID();
    const recordedBy = req.user.staffId;
    const now = new Date().toISOString();

    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO vital_signs (
          id, patient_id, consultation_id, recorded_by, temperature,
          heart_rate, systolic, diastolic, spo2, weight, recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const result = await client.query(query, [
        id,
        data.patientId,
        data.consultationId || null,
        recordedBy,
        data.temperature ?? null,
        data.heartRate ?? null,
        data.systolic ?? null,
        data.diastolic ?? null,
        data.spo2 ?? null,
        data.weight ?? null,
        now
      ]);

      res.status(201).json(formatVitalSigns(result.rows[0]));
    } finally {
      client.release();
    }
  }
);

// GET /api/vitals
vitalsRouter.get(
  "/api/vitals",
  authenticateToken,
  requireRoles("NURSE", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const patientId = req.query.patientId as string | undefined;
    const consultationId = req.query.consultationId as string | undefined;

    const page = Math.max(0, parseInt((req.query.page as string) || "0", 10));
    const size = Math.min(
      100,
      Math.max(1, parseInt((req.query.size as string) || "20", 10))
    );
    const offset = page * size;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (patientId) {
      conditions.push(`patient_id = $${idx++}`);
      values.push(patientId);
    }
    if (consultationId) {
      conditions.push(`consultation_id = $${idx++}`);
      values.push(consultationId);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) AS total FROM vital_signs ${whereClause}`;
    const dataQuery = `SELECT * FROM vital_signs ${whereClause} ORDER BY recorded_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const client = await pool.connect();
    try {
      const countRes = await client.query(countQuery, values);
      const totalElements = parseInt(countRes.rows[0].total, 10);
      const totalPages = Math.ceil(totalElements / size);

      const dataRes = await client.query(dataQuery, [...values, size, offset]);
      const content = dataRes.rows.map(formatVitalSigns);

      res.status(200).json({
        content,
        page,
        size,
        totalElements,
        totalPages
      });
    } finally {
      client.release();
    }
  }
);
