import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool, withTransaction } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import {
  conflict,
  forbidden,
  notFound,
  pageOf,
  parseOrThrow,
  parsePaging,
  parseQueryOrThrow,
  uuidParam,
  validationFailed,
  ErrorDetail
} from "../http/errors.js";
import { checkPatientSummary } from "../services/patientClient.js";
import { checkDoctorPublic } from "../services/staffClient.js";
import { publishEventAsync } from "../events/amqp.js";
import type { AuthUser } from "../auth/jwt.js";

export const appointmentsRouter = Router();

const OVERLAP_STATUSES = "('SCHEDULED', 'CHECKED_IN')";
const MIN_MINUTES = 10;
const MAX_MINUTES = 120;

interface AppointmentRow {
  id: string;
  patient_id: string;
  patient_verified: boolean;
  doctor_id: string;
  start_at: Date;
  end_at: Date;
  reason: string;
  status: "SCHEDULED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED";
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapAppointmentRow(row: AppointmentRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientVerified: row.patient_verified,
    doctorId: row.doctor_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    reason: row.reason,
    status: row.status,
    cancelReason: row.cancel_reason,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

/** REC-15: the role that limits what the caller may see, or null for full visibility. */
function visibilityOf(user: AuthUser): "DOCTOR" | "PATIENT" | null {
  if (user.roles.includes("ADMIN") || user.roles.includes("RECEPTIONIST")) return null;
  if (user.roles.includes("DOCTOR")) return "DOCTOR";
  if (user.roles.includes("PATIENT")) return "PATIENT";
  return null;
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "must be a real calendar date");

// ---------------------------------------------------------------------------
// Availability (REC-14). Declared before /:id so "availability" is not read as an id.
// ---------------------------------------------------------------------------

const AvailabilityQuerySchema = z.object({
  doctorId: z.string().uuid("doctorId must be a valid UUID"),
  date: dateOnly
});

appointmentsRouter.get(
  "/api/appointments/availability",
  authenticateToken,
  requireRoles("RECEPTIONIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const missing: ErrorDetail[] = (["doctorId", "date"] as const)
      .filter((f) => req.query[f] === undefined || req.query[f] === "")
      .map((field) => ({ field, problem: `${field} is required` }));
    if (missing.length > 0) throw validationFailed(missing);

    const { doctorId, date } = parseQueryOrThrow(AvailabilityQuerySchema, {
      doctorId: req.query.doctorId,
      date: req.query.date
    });

    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const busy = await pool.query(
      `SELECT start_at, end_at FROM appointments
        WHERE doctor_id = $1 AND status IN ${OVERLAP_STATUSES}
          AND start_at < $2 AND end_at > $3`,
      [doctorId, dayEnd.toISOString(), dayStart.toISOString()]
    );
    const taken = busy.rows.map((r) => ({
      start: new Date(r.start_at).getTime(),
      end: new Date(r.end_at).getTime()
    }));

    // 18 half-hour slots from 08:00 to 17:00 UTC.
    const slots = [];
    for (let minutes = 8 * 60; minutes < 17 * 60; minutes += 30) {
      const start = dayStart.getTime() + minutes * 60_000;
      const end = start + 30 * 60_000;
      slots.push({
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        available: !taken.some((t) => t.start < end && t.end > start)
      });
    }
    res.json({ doctorId, date, slots });
  }
);

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

const ListQuerySchema = z.object({
  doctorId: z.string().uuid("doctorId must be a valid UUID").optional(),
  patientId: z.string().uuid("patientId must be a valid UUID").optional(),
  date: dateOnly.optional(),
  status: z.enum(["SCHEDULED", "CHECKED_IN", "COMPLETED", "CANCELLED"]).optional()
});

appointmentsRouter.get(
  "/api/appointments",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "DOCTOR", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const filters = parseQueryOrThrow(ListQuerySchema, {
      doctorId: req.query.doctorId,
      patientId: req.query.patientId,
      date: req.query.date,
      status: req.query.status
    });

    // REC-15: DOCTOR sees only own appointments, PATIENT only theirs.
    const limited = visibilityOf(user);
    if (limited === "DOCTOR") {
      if (!user.staffId) throw forbidden("DOCTOR token missing staffId claim");
      filters.doctorId = user.staffId;
    } else if (limited === "PATIENT") {
      if (!user.patientId) throw forbidden("PATIENT token missing patientId claim");
      filters.patientId = user.patientId;
    }

    const where: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      where.push(sql.replace("?", `$${values.length}`));
    };
    if (filters.doctorId) add("doctor_id = ?", filters.doctorId);
    if (filters.patientId) add("patient_id = ?", filters.patientId);
    if (filters.status) add("status = ?", filters.status);
    if (filters.date) add("(start_at AT TIME ZONE 'UTC')::date = ?::date", filters.date);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const paging = parsePaging(req.query);
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM appointments ${whereSql}`, values);
    const data = await pool.query<AppointmentRow>(
      `SELECT * FROM appointments ${whereSql} ORDER BY start_at ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, paging.size, paging.offset]
    );
    res.json(pageOf(data.rows.map(mapAppointmentRow), count.rows[0].total, paging));
  }
);

// ---------------------------------------------------------------------------
// Create / update (REC-1, REC-2, REC-3, REC-5, REC-7, REC-8)
// ---------------------------------------------------------------------------

const instant = (field: string) =>
  z
    .string({ required_error: `${field} is required` })
    .refine((v) => !Number.isNaN(Date.parse(v)) && /T/.test(v), `${field} must be a valid date-time`);

const AppointmentInputSchema = z
  .object({
    patientId: z.string({ required_error: "patientId is required" }).uuid("patientId must be a valid UUID"),
    doctorId: z.string({ required_error: "doctorId is required" }).uuid("doctorId must be a valid UUID"),
    startAt: instant("startAt"),
    endAt: instant("endAt"),
    reason: z
      .string({ required_error: "reason is required" })
      .trim()
      .min(1, "reason is required")
      .max(255, "reason must not exceed 255 characters")
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startAt);
    const end = Date.parse(data.endAt);
    if (Number.isNaN(start) || Number.isNaN(end)) return;
    if (end <= start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "endAt must be after startAt" });
      return;
    }
    const minutes = (end - start) / 60_000;
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: `duration must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes`
      });
    }
  });

type AppointmentInput = z.infer<typeof AppointmentInputSchema>;

function mustStartInFuture(startAt: string): void {
  // REC-2
  if (Date.parse(startAt) <= Date.now()) {
    throw validationFailed([{ field: "startAt", problem: "must be in the future" }]);
  }
}

/**
 * REC-3. Two requests for the same doctor must not both pass the overlap check before either
 * inserts, so the check and the write run under a per-doctor transaction lock.
 */
async function lockDoctor(client: PoolClient, doctorId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 83002))", [doctorId]);
}

async function doctorHasOverlap(
  client: PoolClient,
  doctorId: string,
  startAt: string,
  endAt: string,
  exceptId?: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM appointments
      WHERE doctor_id = $1 AND status IN ${OVERLAP_STATUSES}
        AND start_at < $3 AND end_at > $2
        AND ($4::uuid IS NULL OR id <> $4::uuid)
      LIMIT 1`,
    [doctorId, startAt, endAt, exceptId ?? null]
  );
  return (result.rowCount ?? 0) > 0;
}

appointmentsRouter.post(
  "/api/appointments",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const input: AppointmentInput = parseOrThrow(AppointmentInputSchema, req.body ?? {});
    mustStartInFuture(input.startAt);

    // REC-7: unknown doctor -> 422; Staff unreachable -> the check is skipped.
    const doctor = await checkDoctorPublic(input.doctorId, req.token, req.correlationId);
    if (doctor === "NOT_FOUND") {
      throw validationFailed([{ field: "doctorId", problem: "Doctor not found" }]);
    }

    // REC-5: unknown patient -> 422; Patient unreachable -> accepted with patientVerified = false.
    const patient = await checkPatientSummary(input.patientId, req.token, req.correlationId);
    if (patient === "NOT_FOUND") {
      throw validationFailed([{ field: "patientId", problem: "Patient not found" }]);
    }

    const id = crypto.randomUUID();
    const created = await withTransaction(async (client) => {
      await lockDoctor(client, input.doctorId);
      if (await doctorHasOverlap(client, input.doctorId, input.startAt, input.endAt)) {
        throw conflict("Doctor already has an appointment at this time");
      }
      const inserted = await client.query<AppointmentRow>(
        `INSERT INTO appointments
           (id, patient_id, patient_verified, doctor_id, start_at, end_at, reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED', now(), now())
         RETURNING *`,
        [id, input.patientId, patient === "FOUND", input.doctorId, input.startAt, input.endAt, input.reason]
      );
      return mapAppointmentRow(inserted.rows[0]);
    });

    // REC-8: after the commit, never delaying the response.
    publishEventAsync(
      "appointment.created",
      {
        appointmentId: id,
        patientId: created.patientId,
        doctorId: created.doctorId,
        startAt: created.startAt,
        endAt: created.endAt
      },
      req.correlationId
    );

    res.status(201).header("Location", `/api/appointments/${id}`).json(created);
  }
);

appointmentsRouter.put(
  "/api/appointments/:id",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const found = await pool.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1", [id]);
    if (found.rows.length === 0) throw notFound("Appointment not found");
    const existing = found.rows[0];

    // REC-4: only SCHEDULED appointments can be edited.
    if (existing.status !== "SCHEDULED") throw conflict("Only SCHEDULED appointments can be updated");

    const input: AppointmentInput = parseOrThrow(AppointmentInputSchema, req.body ?? {});
    // REC-2 applies to moving an appointment, not to editing the reason of one that already started.
    if (Date.parse(input.startAt) !== new Date(existing.start_at).getTime()) {
      mustStartInFuture(input.startAt);
    }

    const updated = await withTransaction(async (client) => {
      await lockDoctor(client, input.doctorId);
      if (await doctorHasOverlap(client, input.doctorId, input.startAt, input.endAt, id)) {
        throw conflict("Doctor already has an appointment at this time");
      }
      const result = await client.query<AppointmentRow>(
        `UPDATE appointments
            SET patient_id = $1, doctor_id = $2, start_at = $3, end_at = $4, reason = $5, updated_at = now()
          WHERE id = $6 AND status = 'SCHEDULED'
          RETURNING *`,
        [input.patientId, input.doctorId, input.startAt, input.endAt, input.reason, id]
      );
      // The appointment changed state between the read above and this write.
      if (result.rows.length === 0) throw conflict("Only SCHEDULED appointments can be updated");
      return result.rows[0];
    });
    res.json(mapAppointmentRow(updated));
  }
);

// ---------------------------------------------------------------------------
// Get one
// ---------------------------------------------------------------------------

appointmentsRouter.get(
  "/api/appointments/:id",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "DOCTOR", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const found = await pool.query<AppointmentRow>("SELECT * FROM appointments WHERE id = $1", [id]);
    if (found.rows.length === 0) throw notFound("Appointment not found");

    const row = found.rows[0];
    const user = req.user!;
    const limited = visibilityOf(user);
    if (limited === "DOCTOR" && row.doctor_id !== user.staffId) throw forbidden();
    if (limited === "PATIENT" && row.patient_id !== user.patientId) throw forbidden();

    res.json(mapAppointmentRow(row));
  }
);

// ---------------------------------------------------------------------------
// State changes (REC-4, REC-10)
// ---------------------------------------------------------------------------

/**
 * Moves an appointment from one of `from` to `to` in one conditional UPDATE, so two concurrent
 * requests cannot both succeed (for example a double check-in).
 */
async function transition(
  client: PoolClient | typeof pool,
  id: string,
  from: string[],
  to: string,
  conflictMessage: string,
  cancelReason: string | null = null
): Promise<AppointmentRow> {
  const result = await client.query<AppointmentRow>(
    `UPDATE appointments
        SET status = $1, cancel_reason = COALESCE($2, cancel_reason), updated_at = now()
      WHERE id = $3 AND status = ANY($4::text[])
      RETURNING *`,
    [to, cancelReason, id, from]
  );
  if (result.rows.length > 0) return result.rows[0];

  const exists = await client.query("SELECT 1 FROM appointments WHERE id = $1", [id]);
  if (exists.rowCount === 0) throw notFound("Appointment not found");
  throw conflict(conflictMessage);
}

appointmentsRouter.post(
  "/api/appointments/:id/check-in",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const row = await transition(pool, id, ["SCHEDULED"], "CHECKED_IN", "Appointment cannot be checked in");
    res.json(mapAppointmentRow(row));
  }
);

appointmentsRouter.post(
  "/api/appointments/:id/complete",
  authenticateToken,
  requireRoles("DOCTOR", "RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const row = await transition(pool, id, ["CHECKED_IN"], "COMPLETED", "Appointment cannot be completed");
    res.json(mapAppointmentRow(row));
  }
);

const CancelBodySchema = z
  .object({ reason: z.string().max(255, "reason must not exceed 255 characters").nullable().optional() })
  .passthrough();

appointmentsRouter.post(
  "/api/appointments/:id/cancel",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const body = parseOrThrow(CancelBodySchema, req.body ?? {});

    const cancelled = await withTransaction(async (client) => {
      const row = await transition(
        client,
        id,
        ["SCHEDULED", "CHECKED_IN"],
        "CANCELLED",
        "Cannot cancel appointment",
        body.reason ?? null
      );
      // REC-10: pending reminders die with the appointment.
      await client.query(
        "UPDATE reminders SET status = 'CANCELLED' WHERE appointment_id = $1 AND status = 'PENDING'",
        [id]
      );
      return mapAppointmentRow(row);
    });

    publishEventAsync(
      "appointment.cancelled",
      {
        appointmentId: id,
        patientId: cancelled.patientId,
        doctorId: cancelled.doctorId,
        startAt: cancelled.startAt,
        endAt: cancelled.endAt
      },
      req.correlationId
    );
    res.json(cancelled);
  }
);
