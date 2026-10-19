import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";

export const invoicesRouter = Router();

function mapInvoiceRow(row: any) {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id || null,
    lines: typeof row.lines === "string" ? JSON.parse(row.lines) : row.lines,
    total: parseFloat(row.total),
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method || null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  };
}

// GET /api/invoices
invoicesRouter.get(
  "/api/invoices",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    let patientIdFilter = req.query.patientId as string | undefined;
    const statusFilter = req.query.status as string | undefined;

    // REC-15 role visibility: PATIENT forced to own patientId
    if (user.roles.includes("PATIENT") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")) {
      patientIdFilter = user.patientId || undefined;
    }

    const page = Math.max(0, parseInt(req.query.page as string || "0", 10));
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string || "20", 10)));
    const offset = page * size;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (patientIdFilter) {
      whereClauses.push(`patient_id = $${pIdx++}`);
      params.push(patientIdFilter);
    }
    if (statusFilter) {
      whereClauses.push(`status = $${pIdx++}`);
      params.push(statusFilter);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await pool.query(`SELECT COUNT(*) FROM invoices ${whereSql}`, params);
    const totalElements = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalElements / size);

    const queryParams = [...params, size, offset];
    const dataRes = await pool.query(
      `SELECT * FROM invoices ${whereSql} ORDER BY created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      queryParams
    );

    res.json({
      content: dataRes.rows.map(mapInvoiceRow),
      page,
      size,
      totalElements,
      totalPages
    });
  }
);

// POST /api/invoices
invoicesRouter.post(
  "/api/invoices",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { patientId, appointmentId, lines } = req.body || {};

    const details: Array<{ field: string; problem: string }> = [];

    if (!patientId) {
      details.push({ field: "patientId", problem: "patientId is required" });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      details.push({ field: "lines", problem: "at least 1 line is required" });
    } else if (lines.length > 30) {
      details.push({ field: "lines", problem: "maximum 30 lines allowed" });
    } else {
      lines.forEach((line, index) => {
        if (!line.description || typeof line.description !== "string" || line.description.length > 150) {
          details.push({ field: `lines[${index}].description`, problem: "description must be between 1 and 150 characters" });
        }
        if (typeof line.quantity !== "number" || line.quantity < 1 || !Number.isInteger(line.quantity)) {
          details.push({ field: `lines[${index}].quantity`, problem: "quantity must be an integer >= 1" });
        }
        if (typeof line.unitPrice !== "number" || line.unitPrice < 0) {
          details.push({ field: `lines[${index}].unitPrice`, problem: "unitPrice must be >= 0" });
        }
      });
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

    // Server-computed total (REC-11)
    const total = lines.reduce(
      (sum: number, line: any) => sum + line.quantity * line.unitPrice,
      0
    );
    const roundedTotal = Math.round(total * 100) / 100;

    const id = crypto.randomUUID();
    const insertRes = await pool.query(
      `INSERT INTO invoices (id, patient_id, appointment_id, lines, total, currency, status, payment_method, paid_at, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'TND', 'PENDING', NULL, NULL, now())
       RETURNING *`,
      [id, patientId, appointmentId || null, JSON.stringify(lines), roundedTotal]
    );

    const created = mapInvoiceRow(insertRes.rows[0]);
    res.status(201).header("Location", `/api/invoices/${id}`).json(created);
  }
);

// GET /api/invoices/:id
invoicesRouter.get(
  "/api/invoices/:id",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const invRes = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);

    if (invRes.rows.length === 0) {
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

    const row = invRes.rows[0];
    const user = req.user!;

    // REC-15 role visibility
    if (user.roles.includes("PATIENT") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")) {
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

    res.json(mapInvoiceRow(row));
  }
);

// POST /api/invoices/:id/pay
invoicesRouter.post(
  "/api/invoices/:id/pay",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { method } = req.body || {};

    if (!method || (method !== "CASH" && method !== "CARD")) {
      res.status(422).json({
        timestamp: new Date().toISOString(),
        status: 422,
        error: "Unprocessable Entity",
        message: "Validation failed",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId,
        details: [{ field: "method", problem: "method must be CASH or CARD" }]
      });
      return;
    }

    const invRes = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (invRes.rows.length === 0) {
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

    const invoice = invRes.rows[0];
    if (invoice.status !== "PENDING") {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Invoice is not in PENDING status",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE invoices SET status = 'PAID', payment_method = $1, paid_at = now() WHERE id = $2 RETURNING *`,
      [method, id]
    );

    res.json(mapInvoiceRow(updateRes.rows[0]));
  }
);

// POST /api/invoices/:id/cancel
invoicesRouter.post(
  "/api/invoices/:id/cancel",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const invRes = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);

    if (invRes.rows.length === 0) {
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

    const invoice = invRes.rows[0];
    if (invoice.status !== "PENDING") {
      res.status(409).json({
        timestamp: new Date().toISOString(),
        status: 409,
        error: "Conflict",
        message: "Invoice is not in PENDING status",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE invoices SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json(mapInvoiceRow(updateRes.rows[0]));
  }
);
