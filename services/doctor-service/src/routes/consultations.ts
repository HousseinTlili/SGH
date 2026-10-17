import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles, requireDoctorWithStaffId } from "../auth/roles.js";
import { pool } from "../db/pool.js";
import { fetchPatientSummary } from "../services/patientClient.js";

export const consultationsRouter = Router();

function formatConsultation(row: any) {
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

// GET /api/consultations
consultationsRouter.get(
  "/api/consultations",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const isPatient = req.user?.roles.includes("PATIENT");
    let patientId = req.query.patientId as string | undefined;

    if (isPatient) {
      if (patientId && patientId !== req.user?.patientId) {
        res.status(403).json({
          timestamp: new Date().toISOString(),
          status: 403,
          error: "Forbidden",
          message: "Patients may only access their own consultations",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }
      patientId = req.user?.patientId || undefined;
    }

    const doctorId = req.query.doctorId as string | undefined;
    const status = req.query.status as string | undefined;

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
    if (doctorId) {
      conditions.push(`doctor_id = $${idx++}`);
      values.push(doctorId);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) AS total FROM consultations ${whereClause}`;
    const dataQuery = `SELECT * FROM consultations ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const client = await pool.connect();
    try {
      const countRes = await client.query(countQuery, values);
      const totalElements = parseInt(countRes.rows[0].total, 10);
      const totalPages = Math.ceil(totalElements / size);

      const dataRes = await client.query(dataQuery, [...values, size, offset]);
      const content = dataRes.rows.map(formatConsultation);

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

const CreateConsultationSchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID"),
  appointmentId: z.string().uuid().nullable().optional(),
  subjective: z.string().max(4000).nullable().optional(),
  objective: z.string().max(4000).nullable().optional(),
  assessment: z.string().max(4000).nullable().optional(),
  plan: z.string().max(4000).nullable().optional()
});

// POST /api/consultations
consultationsRouter.post(
  "/api/consultations",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const parseResult = CreateConsultationSchema.safeParse(req.body);
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

    const { patientId, appointmentId, subjective, objective, assessment, plan } =
      parseResult.data;

    // Call Patient service (CON-1, CON-2)
    const patientLookup = await fetchPatientSummary(
      patientId,
      req.token,
      req.correlationId
    );

    if ("notFound" in patientLookup && patientLookup.notFound) {
      res.status(422).json({
        timestamp: new Date().toISOString(),
        status: 422,
        error: "Unprocessable Entity",
        message: "Validation failed",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId,
        details: [{ field: "patientId", problem: "Patient not found" }]
      });
      return;
    }

    const patientSnapshot =
      "snapshot" in patientLookup && patientLookup.snapshot
        ? patientLookup.snapshot
        : null;

    const id = crypto.randomUUID();
    const doctorId = req.user!.staffId!;
    const now = new Date().toISOString();

    const client = await pool.connect();
    try {
      const insertQuery = `
        INSERT INTO consultations (
          id, appointment_id, patient_id, patient_snapshot, doctor_id,
          subjective, objective, assessment, plan, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT', $10, $10)
        RETURNING *
      `;
      const result = await client.query(insertQuery, [
        id,
        appointmentId || null,
        patientId,
        patientSnapshot ? JSON.stringify(patientSnapshot) : null,
        doctorId,
        subjective || null,
        objective || null,
        assessment || null,
        plan || null,
        now
      ]);

      const created = formatConsultation(result.rows[0]);
      res.setHeader("Location", `/api/consultations/${id}`);
      res.status(201).json(created);
    } finally {
      client.release();
    }
  }
);

// GET /api/consultations/:id
consultationsRouter.get(
  "/api/consultations/:id",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM consultations WHERE id = $1",
        [id]
      );
      if (result.rows.length === 0) {
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

      const consultation = result.rows[0];
      if (
        req.user?.roles.includes("PATIENT") &&
        consultation.patient_id !== req.user.patientId
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

      res.status(200).json(formatConsultation(consultation));
    } finally {
      client.release();
    }
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
    const { id } = req.params;
    const client = await pool.connect();
    try {
      const findRes = await client.query(
        "SELECT * FROM consultations WHERE id = $1",
        [id]
      );

      if (findRes.rows.length === 0) {
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

      const existing = findRes.rows[0];

      // Must be own doctor
      if (existing.doctor_id !== req.user!.staffId) {
        res.status(403).json({
          timestamp: new Date().toISOString(),
          status: 403,
          error: "Forbidden",
          message: "You can only edit your own consultations",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // Check not SIGNED (CON-3)
      if (existing.status === "SIGNED") {
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "This consultation is already signed",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const parseResult = UpdateConsultationSchema.safeParse(req.body);
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

      const updates = parseResult.data;
      const subjective =
        updates.subjective !== undefined ? updates.subjective : existing.subjective;
      const objective =
        updates.objective !== undefined ? updates.objective : existing.objective;
      const assessment =
        updates.assessment !== undefined ? updates.assessment : existing.assessment;
      const plan = updates.plan !== undefined ? updates.plan : existing.plan;
      const now = new Date().toISOString();

      const updateRes = await client.query(
        `UPDATE consultations SET
          subjective = $1, objective = $2, assessment = $3, plan = $4, updated_at = $5
         WHERE id = $6 RETURNING *`,
        [subjective, objective, assessment, plan, now, id]
      );

      res.status(200).json(formatConsultation(updateRes.rows[0]));
    } finally {
      client.release();
    }
  }
);

// POST /api/consultations/:id/sign (CON-4)
consultationsRouter.post(
  "/api/consultations/:id/sign",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      const findRes = await client.query(
        "SELECT * FROM consultations WHERE id = $1",
        [id]
      );

      if (findRes.rows.length === 0) {
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

      const existing = findRes.rows[0];

      // Must be own doctor
      if (existing.doctor_id !== req.user!.staffId) {
        res.status(403).json({
          timestamp: new Date().toISOString(),
          status: 403,
          error: "Forbidden",
          message: "You can only sign your own consultations",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // Already signed
      if (existing.status === "SIGNED") {
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "This consultation is already signed",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // Assessment and plan must not be blank
      const errors: Array<{ field: string; problem: string }> = [];
      if (!existing.assessment || existing.assessment.trim() === "") {
        errors.push({ field: "assessment", problem: "must not be blank" });
      }
      if (!existing.plan || existing.plan.trim() === "") {
        errors.push({ field: "plan", problem: "must not be blank" });
      }

      if (errors.length > 0) {
        res.status(422).json({
          timestamp: new Date().toISOString(),
          status: 422,
          error: "Unprocessable Entity",
          message: "Validation failed",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId,
          details: errors
        });
        return;
      }

      const now = new Date().toISOString();
      const updateRes = await client.query(
        `UPDATE consultations SET status = 'SIGNED', signed_at = $1, updated_at = $1
         WHERE id = $2 RETURNING *`,
        [now, id]
      );

      res.status(200).json(formatConsultation(updateRes.rows[0]));
    } finally {
      client.release();
    }
  }
);
