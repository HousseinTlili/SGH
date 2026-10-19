import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles, requireDoctorWithStaffId } from "../auth/roles.js";
import { pool } from "../db/pool.js";
import {
  conflict,
  forbidden,
  notFound,
  pageOf,
  parseOrThrow,
  parsePaging,
  uuidParam,
  validationFailed
} from "../http/errors.js";
import { fetchPatientSummary } from "../services/patientClient.js";

export const consultationsRouter = Router();

interface ConsultationRow {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_snapshot: unknown;
  doctor_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: "DRAFT" | "SIGNED";
  signed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function formatConsultation(row: ConsultationRow) {
  return {
    id: row.id,
    appointmentId: row.appointment_id || null,
    patientId: row.patient_id,
    patientSnapshot: row.patient_snapshot || null,
    doctorId: row.doctor_id,
    subjective: row.subjective || null,
    objective: row.objective || null,
    assessment: row.assessment || null,
    plan: row.plan || null,
    status: row.status,
    signedAt: row.signed_at ? new Date(row.signed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

const ListQuerySchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID").optional(),
  doctorId: z.string().uuid("doctorId must be a valid UUID").optional(),
  status: z.enum(["DRAFT", "SIGNED"]).optional()
});

// GET /api/consultations (CON-9)
consultationsRouter.get(
  "/api/consultations",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const filters = parseOrThrow(ListQuerySchema, {
      patientId: req.query.patientId,
      doctorId: req.query.doctorId,
      status: req.query.status
    });

    let { patientId } = filters;
    if (req.user!.roles.includes("PATIENT")) {
      if (patientId && patientId !== req.user!.patientId) {
        throw forbidden("Patients may only access their own consultations");
      }
      patientId = req.user!.patientId ?? undefined;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];
    if (patientId) {
      values.push(patientId);
      conditions.push(`patient_id = $${values.length}`);
    }
    if (filters.doctorId) {
      values.push(filters.doctorId);
      conditions.push(`doctor_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const paging = parsePaging(req.query);
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM consultations ${where}`,
      values
    );
    const data = await pool.query<ConsultationRow>(
      `SELECT * FROM consultations ${where} ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, paging.size, paging.offset]
    );

    res
      .status(200)
      .json(pageOf(data.rows.map(formatConsultation), count.rows[0].total, paging));
  }
);

const CreateConsultationSchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID"),
  appointmentId: z.string().uuid().nullable().optional(),
  subjective: z.string().max(4000).nullable().optional(),
  objective: z.string().max(4000).nullable().optional(),
  assessment: z.string().max(4000).nullable().optional(),
  plan: z.string().max(4000).nullable().optional()
});

// POST /api/consultations (CON-1, CON-2)
consultationsRouter.post(
  "/api/consultations",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const body = parseOrThrow(CreateConsultationSchema, req.body);

    const patientLookup = await fetchPatientSummary(
      body.patientId,
      req.token,
      req.correlationId
    );
    if ("notFound" in patientLookup) {
      throw validationFailed([{ field: "patientId", problem: "Patient not found" }]);
    }
    const patientSnapshot = "success" in patientLookup ? patientLookup.snapshot : null;

    const id = crypto.randomUUID();
    const result = await pool.query<ConsultationRow>(
      `INSERT INTO consultations (
         id, appointment_id, patient_id, patient_snapshot, doctor_id,
         subjective, objective, assessment, plan, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT', now(), now())
       RETURNING *`,
      [
        id,
        body.appointmentId || null,
        body.patientId,
        patientSnapshot ? JSON.stringify(patientSnapshot) : null,
        req.user!.staffId,
        body.subjective || null,
        body.objective || null,
        body.assessment || null,
        body.plan || null
      ]
    );

    res.setHeader("Location", `/api/consultations/${id}`);
    res.status(201).json(formatConsultation(result.rows[0]));
  }
);

// GET /api/consultations/:id
consultationsRouter.get(
  "/api/consultations/:id",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string, "Consultation");
    const result = await pool.query<ConsultationRow>(
      "SELECT * FROM consultations WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) throw notFound("Consultation not found");

    const consultation = result.rows[0];
    if (
      req.user!.roles.includes("PATIENT") &&
      consultation.patient_id !== req.user!.patientId
    ) {
      throw forbidden();
    }
    res.status(200).json(formatConsultation(consultation));
  }
);

const UpdateConsultationSchema = z.object({
  subjective: z.string().max(4000).nullable().optional(),
  objective: z.string().max(4000).nullable().optional(),
  assessment: z.string().max(4000).nullable().optional(),
  plan: z.string().max(4000).nullable().optional()
});

// PUT /api/consultations/:id (CON-3, D30)
consultationsRouter.put(
  "/api/consultations/:id",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string, "Consultation");
    const found = await pool.query<ConsultationRow>(
      "SELECT * FROM consultations WHERE id = $1",
      [id]
    );
    if (found.rows.length === 0) throw notFound("Consultation not found");

    const existing = found.rows[0];
    if (existing.doctor_id !== req.user!.staffId) {
      throw forbidden("You can only edit your own consultations");
    }
    if (existing.status === "SIGNED") {
      throw conflict("This consultation is already signed");
    }

    const updates = parseOrThrow(UpdateConsultationSchema, req.body);
    // Partial update: a field that is absent keeps its value, an explicit null clears it.
    const pick = <K extends keyof typeof updates>(key: K) =>
      updates[key] !== undefined ? updates[key] : existing[key];

    // The status guard in the WHERE clause closes the race with a concurrent sign.
    const updated = await pool.query<ConsultationRow>(
      `UPDATE consultations
          SET subjective = $1, objective = $2, assessment = $3, plan = $4, updated_at = now()
        WHERE id = $5 AND status = 'DRAFT'
        RETURNING *`,
      [pick("subjective"), pick("objective"), pick("assessment"), pick("plan"), id]
    );
    if (updated.rows.length === 0) throw conflict("This consultation is already signed");

    res.status(200).json(formatConsultation(updated.rows[0]));
  }
);

// POST /api/consultations/:id/sign (CON-4)
consultationsRouter.post(
  "/api/consultations/:id/sign",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string, "Consultation");
    const found = await pool.query<ConsultationRow>(
      "SELECT * FROM consultations WHERE id = $1",
      [id]
    );
    if (found.rows.length === 0) throw notFound("Consultation not found");

    const existing = found.rows[0];
    if (existing.doctor_id !== req.user!.staffId) {
      throw forbidden("You can only sign your own consultations");
    }
    if (existing.status === "SIGNED") {
      throw conflict("This consultation is already signed");
    }

    const problems = (["assessment", "plan"] as const)
      .filter((field) => !existing[field] || existing[field]!.trim() === "")
      .map((field) => ({ field, problem: "must not be blank" }));
    if (problems.length > 0) throw validationFailed(problems);

    const signed = await pool.query<ConsultationRow>(
      `UPDATE consultations
          SET status = 'SIGNED', signed_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'DRAFT'
        RETURNING *`,
      [id]
    );
    if (signed.rows.length === 0) throw conflict("This consultation is already signed");

    res.status(200).json(formatConsultation(signed.rows[0]));
  }
);
