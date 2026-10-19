import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
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
  uuidParam
} from "../http/errors.js";

export const invoicesRouter = Router();

interface InvoiceRow {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  lines: unknown;
  total: string;
  currency: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  payment_method: "CASH" | "CARD" | null;
  paid_at: Date | null;
  created_at: Date;
}

function mapInvoiceRow(row: InvoiceRow) {
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

/** REC-15: a user who is only a PATIENT sees only their own invoices. */
function isPatientOnly(user: NonNullable<Request["user"]>): boolean {
  return (
    user.roles.includes("PATIENT") && !user.roles.includes("ADMIN") && !user.roles.includes("RECEPTIONIST")
  );
}

const ListQuerySchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID").optional(),
  status: z.enum(["PENDING", "PAID", "CANCELLED"]).optional()
});

invoicesRouter.get(
  "/api/invoices",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const filters = parseQueryOrThrow(ListQuerySchema, {
      patientId: req.query.patientId,
      status: req.query.status
    });
    if (isPatientOnly(user)) {
      if (!user.patientId) throw forbidden("PATIENT token missing patientId claim");
      filters.patientId = user.patientId;
    }

    const where: string[] = [];
    const values: unknown[] = [];
    if (filters.patientId) {
      values.push(filters.patientId);
      where.push(`patient_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const paging = parsePaging(req.query);
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM invoices ${whereSql}`, values);
    const data = await pool.query<InvoiceRow>(
      `SELECT * FROM invoices ${whereSql} ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, paging.size, paging.offset]
    );
    res.json(pageOf(data.rows.map(mapInvoiceRow), count.rows[0].total, paging));
  }
);

const InvoiceLineSchema = z.object({
  description: z.string().trim().min(1, "description must be between 1 and 150 characters").max(150, "description must be between 1 and 150 characters"),
  quantity: z.number().int("quantity must be an integer >= 1").min(1, "quantity must be an integer >= 1"),
  unitPrice: z
    .number()
    .min(0, "unitPrice must be >= 0")
    .refine((v) => Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "unitPrice must have at most 2 decimals")
});

// `total` is deliberately absent: a client-sent total is ignored (REC-11).
const InvoiceInputSchema = z.object({
  patientId: z.string({ required_error: "patientId is required" }).uuid("patientId must be a valid UUID"),
  appointmentId: z.string().uuid("appointmentId must be a valid UUID").nullable().optional(),
  lines: z
    .array(InvoiceLineSchema, { required_error: "at least 1 line is required" })
    .min(1, "at least 1 line is required")
    .max(30, "maximum 30 lines allowed")
});

invoicesRouter.post(
  "/api/invoices",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const input = parseOrThrow(InvoiceInputSchema, req.body ?? {});

    // REC-11: server-computed total, in whole cents so no floating point drift reaches the invoice.
    const cents = input.lines.reduce((sum, l) => sum + l.quantity * Math.round(l.unitPrice * 100), 0);

    const id = crypto.randomUUID();
    const inserted = await pool.query<InvoiceRow>(
      `INSERT INTO invoices (id, patient_id, appointment_id, lines, total, currency, status, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'TND', 'PENDING', now())
       RETURNING *`,
      [id, input.patientId, input.appointmentId ?? null, JSON.stringify(input.lines), (cents / 100).toFixed(2)]
    );
    res.status(201).header("Location", `/api/invoices/${id}`).json(mapInvoiceRow(inserted.rows[0]));
  }
);

invoicesRouter.get(
  "/api/invoices/:id",
  authenticateToken,
  requireRoles("RECEPTIONIST", "ADMIN", "PATIENT"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const found = await pool.query<InvoiceRow>("SELECT * FROM invoices WHERE id = $1", [id]);
    if (found.rows.length === 0) throw notFound("Invoice not found");

    const row = found.rows[0];
    if (isPatientOnly(req.user!) && row.patient_id !== req.user!.patientId) throw forbidden();
    res.json(mapInvoiceRow(row));
  }
);

const PayBodySchema = z.object({
  method: z.enum(["CASH", "CARD"], { errorMap: () => ({ message: "method must be CASH or CARD" }) })
});

/** REC-12: PENDING -> PAID / CANCELLED in one conditional UPDATE, so concurrent requests cannot both win. */
async function settle(id: string, assignments: string, values: unknown[]): Promise<InvoiceRow> {
  const result = await pool.query<InvoiceRow>(
    `UPDATE invoices SET ${assignments} WHERE id = $${values.length + 1} AND status = 'PENDING' RETURNING *`,
    [...values, id]
  );
  if (result.rows.length > 0) return result.rows[0];

  const exists = await pool.query("SELECT 1 FROM invoices WHERE id = $1", [id]);
  if (exists.rowCount === 0) throw notFound("Invoice not found");
  throw conflict("Invoice is not in PENDING status");
}

invoicesRouter.post(
  "/api/invoices/:id/pay",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    // REC-13: payment is mocked; only the method is accepted, never card data.
    const { method } = parseOrThrow(PayBodySchema, req.body ?? {});
    const row = await settle(id, "status = 'PAID', payment_method = $1, paid_at = now()", [method]);
    res.json(mapInvoiceRow(row));
  }
);

invoicesRouter.post(
  "/api/invoices/:id/cancel",
  authenticateToken,
  requireRoles("RECEPTIONIST"),
  async (req: Request, res: Response): Promise<void> => {
    const id = uuidParam(req.params.id as string);
    const row = await settle(id, "status = 'CANCELLED'", []);
    res.json(mapInvoiceRow(row));
  }
);
