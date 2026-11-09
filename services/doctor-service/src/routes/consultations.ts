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
  parseQueryOrThrow,
  uuidParam,
  validationFailed
} from "../http/errors.js";
import { fetchPatientSummary } from "../services/patientClient.js";
import { fetchDoctorSpecialty } from "../services/staffClient.js";

export const consultationsRouter = Router();

interface ConsultationRow {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_snapshot: unknown;
  doctor_id: string;
  doctor_specialty: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: "DRAFT" | "SIGNED";
  signed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface AttachmentRow {
  id: string;
  consultation_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  data: string;
  caption: string | null;
  uploaded_by: string;
  uploaded_at: Date;
}

function formatConsultation(row: ConsultationRow) {
  return {
    id: row.id,
    appointmentId: row.appointment_id || null,
    patientId: row.patient_id,
    patientSnapshot: row.patient_snapshot || null,
    doctorId: row.doctor_id,
    doctorSpecialty: row.doctor_specialty || null,
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

function formatAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size),
    data: row.data,
    caption: row.caption || null,
    uploadedBy: row.uploaded_by,
    uploadedAt: new Date(row.uploaded_at).toISOString()
  };
}

const CreateAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().nonnegative().max(15 * 1024 * 1024),
  data: z.string().min(1),
  caption: z.string().max(1000).nullable().optional()
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID").optional(),
  doctorId: z.string().uuid("doctorId must be a valid UUID").optional(),
  specialty: z.string().optional(),
  status: z.enum(["DRAFT", "SIGNED"]).optional()
});

// GET /api/consultations (CON-9)
consultationsRouter.get(
  "/api/consultations",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const filters = parseQueryOrThrow(ListQuerySchema, {
      patientId: req.query.patientId,
      doctorId: req.query.doctorId,
      specialty: req.query.specialty,
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
    if (filters.specialty) {
      values.push(`%${filters.specialty}%`);
      conditions.push(`doctor_specialty ILIKE $${values.length}`);
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
  doctorSpecialty: z.string().max(80).nullable().optional(),
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

    let doctorSpecialty = body.doctorSpecialty || null;
    if (!doctorSpecialty && req.user?.staffId) {
      doctorSpecialty = await fetchDoctorSpecialty(
        req.user.staffId,
        req.token,
        req.correlationId
      );
    }

    const id = crypto.randomUUID();
    const result = await pool.query<ConsultationRow>(
      `INSERT INTO consultations (
         id, appointment_id, patient_id, patient_snapshot, doctor_id, doctor_specialty,
         subjective, objective, assessment, plan, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', now(), now())
       RETURNING *`,
      [
        id,
        body.appointmentId || null,
        body.patientId,
        patientSnapshot ? JSON.stringify(patientSnapshot) : null,
        req.user!.staffId,
        doctorSpecialty,
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
    const id = uuidParam(req.params.id as string);
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
    const id = uuidParam(req.params.id as string);
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
    const id = uuidParam(req.params.id as string);
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

// GET /api/consultations/:id/attachments
consultationsRouter.get(
  "/api/consultations/:id/attachments",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const consultationId = uuidParam(req.params.id as string);
    const consult = await pool.query<ConsultationRow>(
      "SELECT * FROM consultations WHERE id = $1",
      [consultationId]
    );
    if (consult.rows.length === 0) throw notFound("Consultation not found");

    if (
      req.user!.roles.includes("PATIENT") &&
      consult.rows[0].patient_id !== req.user!.patientId
    ) {
      throw forbidden("Access denied to another patient's attachments");
    }

    const result = await pool.query<AttachmentRow>(
      `SELECT * FROM consultation_attachments WHERE consultation_id = $1 ORDER BY uploaded_at ASC`,
      [consultationId]
    );
    res.status(200).json(result.rows.map(formatAttachment));
  }
);

// POST /api/consultations/:id/attachments
consultationsRouter.post(
  "/api/consultations/:id/attachments",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE"),
  async (req: Request, res: Response) => {
    const consultationId = uuidParam(req.params.id as string);
    const consult = await pool.query<ConsultationRow>(
      "SELECT * FROM consultations WHERE id = $1",
      [consultationId]
    );
    if (consult.rows.length === 0) throw notFound("Consultation not found");

    const existing = consult.rows[0];
    if (req.user!.roles.includes("DOCTOR") && existing.doctor_id !== req.user!.staffId) {
      throw forbidden("You can only upload attachments to your own consultations");
    }

    const body = parseOrThrow(CreateAttachmentSchema, req.body);
    const attachmentId = crypto.randomUUID();
    const uploadedBy = req.user!.staffId || req.user!.username;

    const inserted = await pool.query<AttachmentRow>(
      `INSERT INTO consultation_attachments (
         id, consultation_id, file_name, file_type, file_size, data, caption, uploaded_by, uploaded_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING *`,
      [
        attachmentId,
        consultationId,
        body.fileName,
        body.fileType,
        body.fileSize,
        body.data,
        body.caption || null,
        uploadedBy
      ]
    );

    res.setHeader("Location", `/api/consultations/${consultationId}/attachments/${attachmentId}`);
    res.status(201).json(formatAttachment(inserted.rows[0]));
  }
);

// DELETE /api/consultations/:id/attachments/:attachmentId
consultationsRouter.delete(
  "/api/consultations/:id/attachments/:attachmentId",
  authenticateToken,
  requireRoles("DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const consultationId = uuidParam(req.params.id as string);
    const attachmentId = uuidParam(req.params.attachmentId as string);

    const consult = await pool.query<ConsultationRow>(
      "SELECT * FROM consultations WHERE id = $1",
      [consultationId]
    );
    if (consult.rows.length === 0) throw notFound("Consultation not found");

    if (consult.rows[0].status === "SIGNED" && !req.user!.roles.includes("ADMIN")) {
      throw conflict("Cannot delete attachments from a signed consultation");
    }

    const del = await pool.query(
      "DELETE FROM consultation_attachments WHERE id = $1 AND consultation_id = $2 RETURNING id",
      [attachmentId, consultationId]
    );
    if (del.rows.length === 0) throw notFound("Attachment not found");

    res.status(204).send();
  }
);
