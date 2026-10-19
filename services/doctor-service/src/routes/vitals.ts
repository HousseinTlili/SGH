import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import { pool } from "../db/pool.js";
import { badRequest, forbidden, isUuid, pageOf, parseOrThrow, parsePaging, validationFailed } from "../http/errors.js";

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
    if (!req.user!.staffId) throw forbidden("Token missing staffId claim");

    const data = parseOrThrow(VitalSignsInputSchema, req.body);
    if (data.consultationId) {
      const exists = await pool.query("SELECT 1 FROM consultations WHERE id = $1", [
        data.consultationId
      ]);
      if (exists.rowCount === 0) {
        throw validationFailed([{ field: "consultationId", problem: "Consultation not found" }]);
      }
    }
    const result = await pool.query(
      `INSERT INTO vital_signs (
         id, patient_id, consultation_id, recorded_by, temperature,
         heart_rate, systolic, diastolic, spo2, weight, recorded_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       RETURNING *`,
      [
        crypto.randomUUID(),
        data.patientId,
        data.consultationId || null,
        req.user!.staffId,
        data.temperature ?? null,
        data.heartRate ?? null,
        data.systolic ?? null,
        data.diastolic ?? null,
        data.spo2 ?? null,
        data.weight ?? null
      ]
    );
    res.status(201).json(formatVitalSigns(result.rows[0]));
  }
);

// GET /api/vitals
vitalsRouter.get(
  "/api/vitals",
  authenticateToken,
  requireRoles("NURSE", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const problems = (["patientId", "consultationId"] as const)
      .filter((f) => req.query[f] !== undefined && !isUuid(req.query[f]))
      .map((field) => ({ field, problem: `${field} must be a valid UUID` }));
    if (problems.length > 0) throw badRequest("Invalid query parameter", problems);

    const conditions: string[] = [];
    const values: unknown[] = [];
    for (const [param, column] of [
      ["patientId", "patient_id"],
      ["consultationId", "consultation_id"]
    ] as const) {
      if (req.query[param]) {
        values.push(req.query[param]);
        conditions.push(`${column} = $${values.length}`);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const paging = parsePaging(req.query);
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM vital_signs ${where}`,
      values
    );
    const data = await pool.query(
      `SELECT * FROM vital_signs ${where} ORDER BY recorded_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, paging.size, paging.offset]
    );
    res.status(200).json(pageOf(data.rows.map(formatVitalSigns), count.rows[0].total, paging));
  }
);
