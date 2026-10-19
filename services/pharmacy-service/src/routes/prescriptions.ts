import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool, withTransaction } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import {
  badRequest,
  conflict,
  forbidden,
  isUuid,
  notFound,
  pageOf,
  parseOrThrow,
  parsePaging,
  uuidParam,
  validationFailed,
  ErrorDetail
} from "../http/errors.js";
import { publishEventAsync } from "../events/amqp.js";
import { verifyPrescriptionWithConsultation } from "../services/consultationClient.js";

export const prescriptionsRouter = Router();

const STATUSES = ["ISSUED", "PARTIALLY_DISPENSED", "DISPENSED"] as const;

const DispenseRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        itemIndex: z.number().int().min(0),
        drugId: z.string().uuid(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1)
    .max(50)
});

type Queryable = Pick<PoolClient, "query">;

interface PrescriptionRow {
  id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  status: (typeof STATUSES)[number];
  created_at: Date;
}

/** Loads the given prescription copies with their items in two queries, keeping the order of `rows`. */
async function withItems(db: Queryable, rows: PrescriptionRow[]) {
  if (rows.length === 0) return [];
  const items = await db.query(
    `SELECT prescription_id, item_index, drug_name, dosage, frequency, duration, dispensed
       FROM prescription_items
      WHERE prescription_id = ANY($1::uuid[])
      ORDER BY item_index ASC`,
    [rows.map((r) => r.id)]
  );
  return rows.map((rx) => ({
    id: rx.id,
    consultationId: rx.consultation_id,
    patientId: rx.patient_id,
    doctorId: rx.doctor_id,
    status: rx.status,
    items: items.rows
      .filter((it) => it.prescription_id === rx.id)
      .map((it) => ({
        index: it.item_index,
        drugName: it.drug_name,
        dosage: it.dosage,
        frequency: it.frequency,
        duration: it.duration,
        dispensed: it.dispensed === true
      })),
    createdAt: new Date(rx.created_at).toISOString()
  }));
}

async function fetchPrescription(db: Queryable, id: string) {
  const rx = await db.query<PrescriptionRow>("SELECT * FROM prescription_copies WHERE id = $1", [id]);
  return (await withItems(db, rx.rows))[0] ?? null;
}

// GET /api/prescriptions : open ones (ISSUED, PARTIALLY_DISPENSED) first, then oldest first (D31: status may be a list)
prescriptionsRouter.get(
  "/api/prescriptions",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const problems: ErrorDetail[] = [];
    const where: string[] = [];
    const params: unknown[] = [];

    if (typeof req.query.status === "string" && req.query.status.trim() !== "") {
      const statuses = req.query.status.split(",").map((s) => s.trim()).filter(Boolean);
      const unknown = statuses.filter((s) => !(STATUSES as readonly string[]).includes(s));
      if (unknown.length > 0) {
        problems.push({ field: "status", problem: `unknown status ${unknown.join(", ")}` });
      } else if (statuses.length > 0) {
        params.push(statuses);
        where.push(`status = ANY($${params.length}::text[])`);
      }
    }
    if (req.query.patientId !== undefined && req.query.patientId !== "") {
      if (!isUuid(req.query.patientId)) {
        problems.push({ field: "patientId", problem: "patientId must be a valid UUID" });
      } else {
        params.push(req.query.patientId);
        where.push(`patient_id = $${params.length}`);
      }
    }
    if (problems.length > 0) throw badRequest("Invalid query parameter", problems);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const paging = parsePaging(req.query);
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM prescription_copies ${whereSql}`, params);
    const page = await pool.query<PrescriptionRow>(
      `SELECT * FROM prescription_copies ${whereSql}
        ORDER BY CASE WHEN status IN ('ISSUED', 'PARTIALLY_DISPENSED') THEN 0 ELSE 1 END ASC,
                 created_at ASC, id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, paging.size, paging.offset]
    );
    res.status(200).json(pageOf(await withItems(pool, page.rows), count.rows[0].total, paging));
  }
);

// GET /api/prescriptions/:id
prescriptionsRouter.get(
  "/api/prescriptions/:id",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const rx = await fetchPrescription(pool, uuidParam(req.params.id as string));
    if (!rx) throw notFound("Prescription not found");
    res.status(200).json(rx);
  }
);

// GET /api/prescriptions/:id/dispensings
prescriptionsRouter.get(
  "/api/prescriptions/:id/dispensings",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const exists = await pool.query("SELECT 1 FROM prescription_copies WHERE id = $1", [id]);
    if (exists.rowCount === 0) throw notFound("Prescription not found");

    const dispensings = await pool.query(
      "SELECT id, prescription_id, pharmacist_id, dispensed_at FROM dispensings WHERE prescription_id = $1 ORDER BY dispensed_at ASC, id ASC",
      [id]
    );
    const lines = await pool.query(
      `SELECT dispensing_id, item_index, drug_id, quantity FROM dispensing_lines
        WHERE dispensing_id = ANY($1::uuid[]) ORDER BY item_index ASC`,
      [dispensings.rows.map((d) => d.id)]
    );
    res.status(200).json(
      dispensings.rows.map((d) => ({
        id: d.id,
        prescriptionId: d.prescription_id,
        pharmacistId: d.pharmacist_id,
        lines: lines.rows
          .filter((l) => l.dispensing_id === d.id)
          .map((l) => ({ itemIndex: l.item_index, drugId: l.drug_id, quantity: l.quantity })),
        dispensedAt: new Date(d.dispensed_at).toISOString()
      }))
    );
  }
);

// POST /api/prescriptions/:id/dispense (PHA-3 to PHA-7)
prescriptionsRouter.post(
  "/api/prescriptions/:id/dispense",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const pharmacistId = req.user!.staffId;
    // The dispensing record names the pharmacist; there is no sensible default for a token without one.
    if (!pharmacistId) throw forbidden("PHARMACIST token missing staffId claim");

    const { lines } = parseOrThrow(DispenseRequestSchema, req.body ?? {});
    const seen = new Set<number>();
    for (const line of lines) {
      if (seen.has(line.itemIndex)) {
        throw validationFailed([{ field: "lines", problem: `itemIndex ${line.itemIndex} appears more than once` }]);
      }
      seen.add(line.itemIndex);
    }

    // Cheap early answers before anything is locked.
    const early = await pool.query("SELECT status, consultation_id FROM prescription_copies WHERE id = $1", [id]);
    if (early.rows.length === 0) throw notFound("Prescription not found");
    if (early.rows[0].status === "DISPENSED") throw conflict("Prescription is already fully dispensed");

    // PHA-7, outside any transaction so a slow Consultation service holds no database connection.
    const source = await verifyPrescriptionWithConsultation(
      early.rows[0].consultation_id,
      id,
      req.token,
      req.correlationId
    );
    if (source.reachable && !source.exists) {
      throw conflict("Prescription is missing from the Consultation service");
    }

    const dispensedAt = new Date().toISOString();
    const status = await withTransaction(async (client) => {
      // Serialises dispensings of the same prescription: the checks below then see the state the
      // previous request left, so one item can never be dispensed twice.
      const locked = await client.query(
        "SELECT status FROM prescription_copies WHERE id = $1 FOR UPDATE",
        [id]
      );
      if (locked.rows.length === 0) throw notFound("Prescription not found");
      if (locked.rows[0].status === "DISPENSED") throw conflict("Prescription is already fully dispensed");

      const items = await client.query(
        "SELECT item_index, dispensed FROM prescription_items WHERE prescription_id = $1",
        [id]
      );
      const dispensedByIndex = new Map<number, boolean>(items.rows.map((r) => [r.item_index, r.dispensed === true]));

      // PHA-4: validate every line before changing anything. Invalid input (422) comes before state conflicts (409).
      const problems: ErrorDetail[] = [];
      for (const line of lines) {
        if (!dispensedByIndex.has(line.itemIndex)) {
          problems.push({ field: "lines.itemIndex", problem: `Item index ${line.itemIndex} does not exist on this prescription` });
        }
      }

      // Drug rows are locked in a fixed order, so two dispensings that share drugs cannot deadlock.
      const wanted = new Map<string, number>();
      for (const line of lines) wanted.set(line.drugId, (wanted.get(line.drugId) ?? 0) + line.quantity);
      const drugs = await client.query(
        "SELECT id, name, stock FROM drugs WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [[...wanted.keys()]]
      );
      const stockById = new Map<string, { name: string; stock: number }>(
        drugs.rows.map((d) => [d.id, { name: d.name, stock: d.stock }])
      );
      for (const drugId of wanted.keys()) {
        if (!stockById.has(drugId)) problems.push({ field: "lines.drugId", problem: `Drug ${drugId} not found` });
      }
      if (problems.length > 0) throw validationFailed(problems);

      for (const line of lines) {
        if (dispensedByIndex.get(line.itemIndex) === true) {
          throw conflict(`Item at index ${line.itemIndex} has already been dispensed`);
        }
      }
      for (const [drugId, quantity] of wanted) {
        const drug = stockById.get(drugId)!;
        if (drug.stock < quantity) throw conflict(`Insufficient stock for drug ${drug.name}`);
      }

      for (const [drugId, quantity] of wanted) {
        await client.query("UPDATE drugs SET stock = stock - $1, updated_at = now() WHERE id = $2", [quantity, drugId]);
      }

      const dispensingId = crypto.randomUUID();
      await client.query(
        "INSERT INTO dispensings (id, prescription_id, pharmacist_id, dispensed_at) VALUES ($1, $2, $3, $4)",
        [dispensingId, id, pharmacistId, dispensedAt]
      );
      for (const line of lines) {
        await client.query(
          "INSERT INTO dispensing_lines (id, dispensing_id, item_index, drug_id, quantity) VALUES ($1, $2, $3, $4, $5)",
          [crypto.randomUUID(), dispensingId, line.itemIndex, line.drugId, line.quantity]
        );
        await client.query(
          "UPDATE prescription_items SET dispensed = true WHERE prescription_id = $1 AND item_index = $2",
          [id, line.itemIndex]
        );
      }

      // PHA-5
      const open = await client.query(
        "SELECT 1 FROM prescription_items WHERE prescription_id = $1 AND dispensed = false LIMIT 1",
        [id]
      );
      const newStatus = open.rowCount === 0 ? "DISPENSED" : "PARTIALLY_DISPENSED";
      await client.query("UPDATE prescription_copies SET status = $1, updated_at = now() WHERE id = $2", [newStatus, id]);
      return newStatus;
    });

    // PHA-6: after the commit, never delaying or failing the response.
    publishEventAsync("prescription.dispensed", { prescriptionId: id, pharmacistId, status, dispensedAt }, req.correlationId);

    res.status(200).json(await fetchPrescription(pool, id));
  }
);
