import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import { checkPatientSummary } from "../services/patientClient.js";
import { checkDoctorPublic } from "../services/staffClient.js";
import { publishEventAsync } from "../events/amqp.js";

export const appointmentsRouter = Router();

function mapAppointmentRow(row: any) {
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

// REC-14: GET /api/appointments/availability MUST be before /api/appointments/:id
appointmentsRouter.get(
  "/api/appointments/availability",
  authenticateToken,
  requireRoles("RECEPTIONIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      res.status(422).json({
        timestamp: new Date().toISOString(),
        status: 422,
        error: "Unprocessable Entity",
        message: "Validation failed",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId,
        details: [
          ...(!doctorId ? [{ field: "doctorId", problem: "doctorId is required" }] : []),
          ...(!date ? [{ field: "date", problem: "date is required" }] : [])
        ]
      });
      return;
    }

    const dateStr = String(date);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      res.status(422).json({
        timestamp: new Date().toISOString(),
        status: 422,
        error: "Unprocessable Entity",
        message: "Validation failed",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId,
        details: [{ field: "date", problem: "date must be in YYYY-MM-DD format" }]
      });
      return;
    }

    // Day bounds UTC
    const dayStart = new Date(`${dateStr}T00:00:00Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    // Fetch doctor's active appointments for that day
    const apptsRes = await pool.query(
      `SELECT start_at, end_at FROM appointments
       WHERE doctor_id = $1
         AND status IN ('SCHEDULED', 'CHECKED_IN')
         AND start_at < $2 AND end_at > $3`,
      [doctorId, dayEnd.toISOString(), dayStart.toISOString()]
    );

    const activeAppts = apptsRes.rows.map((r) => ({
      start: new Date(r.start_at).getTime(),
      end: new Date(r.end_at).getTime()
    }));

    // 18 half-hour slots from 08:00 to 17:00 UTC
    const slots = [];
    for (let hour = 8; hour < 17; hour++) {
      for (const minute of [0, 30]) {
        const slotStart = new Date(Date.UTC(
          dayStart.getUTCFullYear(),
          dayStart.getUTCMonth(),
          dayStart.getUTCDate(),
          hour,
          minute,
          0
        ));
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        const slotStartTime = slotStart.getTime();
        const slotEndTime = slotEnd.getTime();

        const isOverlapping = activeAppts.some(
          (appt) => appt.start < slotEndTime && appt.end > slotStartTime
        );

        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
          available: !isOverlapping
        });
      }
    }

    res.json({
      doctorId,
      date: dateStr,
      slots
    });
  }
);

// GET /api/appointments
appointmentsRouter.get(
  "/api/appointments",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "DOCTOR", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    let doctorIdFilter = req.query.doctorId as string | undefined;
    let patientIdFilter = req.query.patientId as string | undefined;
    const dateFilter = req.query.date as string | undefined;
    const statusFilter = req.query.status as string | undefined;

    // REC-15 role visibility enforcement
    if (user.roles.includes("DOCTOR") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")) {
      doctorIdFilter = user.staffId || undefined;
    } else if (user.roles.includes("PATIENT") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")) {
      patientIdFilter = user.patientId || undefined;
    }

    const page = Math.max(0, parseInt(req.query.page as string || "0", 10));
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string || "20", 10)));
    const offset = page * size;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (doctorIdFilter) {
      whereClauses.push(`doctor_id = $${pIdx++}`);
      params.push(doctorIdFilter);
    }
    if (patientIdFilter) {
      whereClauses.push(`patient_id = $${pIdx++}`);
      params.push(patientIdFilter);
    }
    if (statusFilter) {
      whereClauses.push(`status = $${pIdx++}`);
      params.push(statusFilter);
    }
    if (dateFilter) {
      whereClauses.push(`DATE(start_at AT TIME ZONE 'UTC') = $${pIdx++}`);
      params.push(dateFilter);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await pool.query(`SELECT COUNT(*) FROM appointments ${whereSql}`, params);
    const totalElements = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalElements / size);

    const queryParams = [...params, size, offset];
    const dataRes = await pool.query(
      `SELECT * FROM appointments ${whereSql} ORDER BY start_at ASC LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      queryParams
    );

    res.json({
      content: dataRes.rows.map(mapAppointmentRow),
      page,
      size,
      totalElements,
      totalPages
    });
  }
);

// POST /api/appointments
appointmentsRouter.post(
  "/api/appointments",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { patientId, doctorId, startAt, endAt, reason } = req.body || {};

    const details: Array<{ field: string; problem: string }> = [];

    if (!patientId) details.push({ field: "patientId", problem: "patientId is required" });
    if (!doctorId) details.push({ field: "doctorId", problem: "doctorId is required" });
    if (!startAt) details.push({ field: "startAt", problem: "startAt is required" });
    if (!endAt) details.push({ field: "endAt", problem: "endAt is required" });
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      details.push({ field: "reason", problem: "reason is required" });
    } else if (reason.length > 255) {
      details.push({ field: "reason", problem: "reason must not exceed 255 characters" });
    }

    if (startAt && endAt) {
      const startTime = new Date(startAt).getTime();
      const endTime = new Date(endAt).getTime();

      if (isNaN(startTime)) {
        details.push({ field: "startAt", problem: "startAt must be a valid date-time" });
      } else if (startTime <= Date.now()) {
        // REC-2
        details.push({ field: "startAt", problem: "must be in the future" });
      }

      if (isNaN(endTime)) {
        details.push({ field: "endAt", problem: "endAt must be a valid date-time" });
      } else if (endTime <= startTime) {
        details.push({ field: "endAt", problem: "endAt must be after startAt" });
      } else {
        // REC-1
        const durMin = (endTime - startTime) / (1000 * 60);
        if (durMin < 10 || durMin > 120) {
          details.push({ field: "endAt", problem: "duration must be between 10 and 120 minutes" });
        }
      }
    }

    if (details.length > 0) {
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

    // REC-7: check doctor via Staff /public
    await checkDoctorPublic(doctorId, req.token, req.correlationId);

    // REC-5: check patient via Patient /summary
    let patientVerified = false;
    const patientCheck = await checkPatientSummary(patientId, req.token, req.correlationId);
    if (patientCheck.status === "NOT_FOUND") {
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
    } else if (patientCheck.status === "FOUND") {
      patientVerified = true;
    }

    // REC-3: check doctor overlap
    const overlapRes = await pool.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1
         AND status IN ('SCHEDULED', 'CHECKED_IN')
         AND start_at < $2 AND end_at > $3`,
      [doctorId, endAt, startAt]
    );

    if (overlapRes.rows.length > 0) {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Doctor already has an appointment at this time",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const id = crypto.randomUUID();
    const insertRes = await pool.query(
      `INSERT INTO appointments (id, patient_id, patient_verified, doctor_id, start_at, end_at, reason, status, cancel_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED', NULL, now(), now())
       RETURNING *`,
      [id, patientId, patientVerified, doctorId, startAt, endAt, reason]
    );

    const created = mapAppointmentRow(insertRes.rows[0]);

    // REC-8: publish appointment.created event
    publishEventAsync(
      "appointment.created",
      {
        appointmentId: id,
        patientId,
        doctorId,
        startAt: created.startAt,
        endAt: created.endAt
      },
      req.correlationId
    );

    res.status(201).header("Location", `/api/appointments/${id}`).json(created);
  }
);

// GET /api/appointments/:id
appointmentsRouter.get(
  "/api/appointments/:id",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "DOCTOR", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const resAppt = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);

    if (resAppt.rows.length === 0) {
      res.status(404).json({
        timestamp: new Date().toISOString(),
        status: 404,
        error: "Not Found",
        message: "Resource not found",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const row = resAppt.rows[0];
    const user = req.user!;

    // REC-15 role visibility
    if (user.roles.includes("DOCTOR") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")) {
      if (row.doctor_id !== user.staffId) {
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
    } else if (user.roles.includes("PATIENT") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")) {
      if (row.patient_id !== user.patientId) {
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
    }

    res.json(mapAppointmentRow(row));
  }
);

// PUT /api/appointments/:id
appointmentsRouter.put(
  "/api/appointments/:id",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { patientId, doctorId, startAt, endAt, reason } = req.body || {};

    const apptRes = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);
    if (apptRes.rows.length === 0) {
      res.status(404).json({
        timestamp: new Date().toISOString(),
        status: 404,
        error: "Not Found",
        message: "Resource not found",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const existing = apptRes.rows[0];
    // REC-4: Only SCHEDULED appointments can be updated
    if (existing.status !== "SCHEDULED") {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Only SCHEDULED appointments can be updated",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const details: Array<{ field: string; problem: string }> = [];
    if (!patientId) details.push({ field: "patientId", problem: "patientId is required" });
    if (!doctorId) details.push({ field: "doctorId", problem: "doctorId is required" });
    if (!startAt) details.push({ field: "startAt", problem: "startAt is required" });
    if (!endAt) details.push({ field: "endAt", problem: "endAt is required" });
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      details.push({ field: "reason", problem: "reason is required" });
    }

    if (startAt && endAt) {
      const startTime = new Date(startAt).getTime();
      const endTime = new Date(endAt).getTime();
      if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
        details.push({ field: "endAt", problem: "endAt must be after startAt" });
      } else {
        const durMin = (endTime - startTime) / (1000 * 60);
        if (durMin < 10 || durMin > 120) {
          details.push({ field: "endAt", problem: "duration must be between 10 and 120 minutes" });
        }
      }
    }

    if (details.length > 0) {
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

    // Overlap check excluding self
    const overlapRes = await pool.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1
         AND id != $2
         AND status IN ('SCHEDULED', 'CHECKED_IN')
         AND start_at < $3 AND end_at > $4`,
      [doctorId, id, endAt, startAt]
    );

    if (overlapRes.rows.length > 0) {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Doctor already has an appointment at this time",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE appointments
       SET patient_id = $1, doctor_id = $2, start_at = $3, end_at = $4, reason = $5, updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [patientId, doctorId, startAt, endAt, reason, id]
    );

    res.json(mapAppointmentRow(updateRes.rows[0]));
  }
);

// POST /api/appointments/:id/check-in
appointmentsRouter.post(
  "/api/appointments/:id/check-in",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const apptRes = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);

    if (apptRes.rows.length === 0) {
      res.status(404).json({
        timestamp: new Date().toISOString(),
        status: 404,
        error: "Not Found",
        message: "Resource not found",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const appt = apptRes.rows[0];
    if (appt.status !== "SCHEDULED") {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Appointment cannot be checked in",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE appointments SET status = 'CHECKED_IN', updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json(mapAppointmentRow(updateRes.rows[0]));
  }
);

// POST /api/appointments/:id/complete
appointmentsRouter.post(
  "/api/appointments/:id/complete",
  authenticateToken,
  requireRoles("DOCTOR", "RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const apptRes = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);

    if (apptRes.rows.length === 0) {
      res.status(404).json({
        timestamp: new Date().toISOString(),
        status: 404,
        error: "Not Found",
        message: "Resource not found",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const appt = apptRes.rows[0];
    if (appt.status !== "CHECKED_IN") {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Appointment cannot be completed",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE appointments SET status = 'COMPLETED', updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json(mapAppointmentRow(updateRes.rows[0]));
  }
);

// POST /api/appointments/:id/cancel
appointmentsRouter.post(
  "/api/appointments/:id/cancel",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const apptRes = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);

    if (apptRes.rows.length === 0) {
      res.status(404).json({
        timestamp: new Date().toISOString(),
        status: 404,
        error: "Not Found",
        message: "Resource not found",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const appt = apptRes.rows[0];
    if (appt.status === "COMPLETED" || appt.status === "CANCELLED") {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Cannot cancel appointment",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const reason = req.body?.reason ? String(req.body.reason).substring(0, 255) : null;

    const updateRes = await pool.query(
      `UPDATE appointments SET status = 'CANCELLED', cancel_reason = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [reason, id]
    );

    // REC-10: cancel pending reminders
    await pool.query(
      `UPDATE reminders SET status = 'CANCELLED' WHERE appointment_id = $1 AND status = 'PENDING'`,
      [id]
    );

    const cancelled = mapAppointmentRow(updateRes.rows[0]);

    // Publish appointment.cancelled event
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
