import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import { publishPrescriptionDispensedAsync } from "../events/amqp.js";
import { verifyPrescriptionWithConsultation } from "../services/consultationClient.js";

export const prescriptionsRouter = Router();

const DispenseLineSchema = z.object({
  itemIndex: z.number().int().min(0),
  drugId: z.string().uuid(),
  quantity: z.number().int().min(1)
});

const DispenseRequestSchema = z.object({
  lines: z.array(DispenseLineSchema).min(1)
});

// Helper to fetch full prescription details
async function fetchFullPrescription(client: any, id: string) {
  const rxRes = await client.query(
    "SELECT * FROM prescription_copies WHERE id = $1",
    [id]
  );
  if (rxRes.rowCount === 0) return null;

  const rx = rxRes.rows[0];
  const itemsRes = await client.query(
    "SELECT item_index, drug_name, dosage, frequency, duration, dispensed FROM prescription_items WHERE prescription_id = $1 ORDER BY item_index ASC",
    [id]
  );

  return {
    id: rx.id,
    consultationId: rx.consultation_id,
    patientId: rx.patient_id,
    doctorId: rx.doctor_id,
    status: rx.status,
    items: itemsRes.rows.map((it: any) => ({
      index: parseInt(it.item_index, 10),
      drugName: it.drug_name,
      dosage: it.dosage,
      frequency: it.frequency,
      duration: it.duration,
      dispensed: it.dispensed === true
    })),
    createdAt: new Date(rx.created_at).toISOString()
  };
}

// GET /api/prescriptions (queue: ISSUED and PARTIALLY_DISPENSED first, then oldest)
prescriptionsRouter.get(
  "/api/prescriptions",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const rawStatus = typeof req.query.status === "string" ? req.query.status.trim() : null;
    const patientId = typeof req.query.patientId === "string" ? req.query.patientId.trim() : null;
    const page = Math.max(0, parseInt((req.query.page as string) || "0", 10));
    const size = Math.min(100, Math.max(1, parseInt((req.query.size as string) || "20", 10)));
    const offset = page * size;

    const client = await pool.connect();
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      // Status filter supports comma-separated list (D31)
      if (rawStatus) {
        const statuses = rawStatus
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (statuses.length > 0) {
          params.push(statuses);
          whereClauses.push(`status = ANY($${params.length})`);
        }
      }

      if (patientId) {
        params.push(patientId);
        whereClauses.push(`patient_id = $${params.length}`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countRes = await client.query(
        `SELECT COUNT(*) FROM prescription_copies ${whereSql}`,
        params
      );
      const totalElements = parseInt(countRes.rows[0].count, 10);
      const totalPages = Math.ceil(totalElements / size);

      // Order: ISSUED and PARTIALLY_DISPENSED first (0), then DISPENSED (1), then created_at ASC
      const dataQuery = `
        SELECT id FROM prescription_copies 
        ${whereSql}
        ORDER BY 
          CASE WHEN status IN ('ISSUED', 'PARTIALLY_DISPENSED') THEN 0 ELSE 1 END ASC,
          created_at ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const idRes = await client.query(dataQuery, [...params, size, offset]);
      const content = [];

      for (const row of idRes.rows) {
        const full = await fetchFullPrescription(client, row.id);
        if (full) {
          content.push(full);
        }
      }

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

// GET /api/prescriptions/:id
prescriptionsRouter.get(
  "/api/prescriptions/:id",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const client = await pool.connect();
    try {
      const rx = await fetchFullPrescription(client, id);
      if (!rx) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Prescription not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      res.status(200).json(rx);
    } finally {
      client.release();
    }
  }
);

// GET /api/prescriptions/:id/dispensings
prescriptionsRouter.get(
  "/api/prescriptions/:id/dispensings",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const client = await pool.connect();
    try {
      // 1. Check prescription exists
      const rxCheck = await client.query(
        "SELECT 1 FROM prescription_copies WHERE id = $1",
        [id]
      );
      if (rxCheck.rowCount === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Prescription not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // 2. Fetch dispensings, oldest first
      const dispRes = await client.query(
        "SELECT id, prescription_id, pharmacist_id, dispensed_at FROM dispensings WHERE prescription_id = $1 ORDER BY dispensed_at ASC",
        [id]
      );

      const dispensings = [];
      for (const d of dispRes.rows) {
        const linesRes = await client.query(
          "SELECT item_index, drug_id, quantity FROM dispensing_lines WHERE dispensing_id = $1 ORDER BY item_index ASC",
          [d.id]
        );

        dispensings.push({
          id: d.id,
          prescriptionId: d.prescription_id,
          pharmacistId: d.pharmacist_id,
          lines: linesRes.rows.map((l: any) => ({
            itemIndex: parseInt(l.item_index, 10),
            drugId: l.drug_id,
            quantity: parseInt(l.quantity, 10)
          })),
          dispensedAt: new Date(d.dispensed_at).toISOString()
        });
      }

      res.status(200).json(dispensings);
    } finally {
      client.release();
    }
  }
);

// POST /api/prescriptions/:id/dispense (PHA-3 to PHA-7)
prescriptionsRouter.post(
  "/api/prescriptions/:id/dispense",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    // 1. Validate request body
    const parseResult = DispenseRequestSchema.safeParse(req.body);
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

    const { lines } = parseResult.data;
    const client = await pool.connect();
    try {
      // 2. Check prescription exists
      const rxRes = await client.query(
        "SELECT * FROM prescription_copies WHERE id = $1",
        [id]
      );

      if (rxRes.rowCount === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Prescription not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const rx = rxRes.rows[0];

      // 3. Check already fully dispensed
      if (rx.status === "DISPENSED") {
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "Prescription is already fully dispensed",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // 4. Consultation check (PHA-7)
      const consultVerify = await verifyPrescriptionWithConsultation(
        rx.consultation_id,
        id,
        req.token,
        req.correlationId
      );

      if (consultVerify.reachable && !consultVerify.exists) {
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "Prescription is missing from Consultation service",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // 5. Check item indices and dispensed state locally
      const itemsRes = await client.query(
        "SELECT item_index, dispensed FROM prescription_items WHERE prescription_id = $1",
        [id]
      );
      const itemMap = new Map<number, boolean>();
      for (const it of itemsRes.rows) {
        itemMap.set(parseInt(it.item_index, 10), it.dispensed === true);
      }

      for (const line of lines) {
        if (!itemMap.has(line.itemIndex)) {
          res.status(422).json({
            timestamp: new Date().toISOString(),
            status: 422,
            error: "Unprocessable Entity",
            message: "Validation failed",
            path: req.originalUrl || req.url,
            correlationId: req.correlationId,
            details: [
              {
                field: "lines.itemIndex",
                problem: `Item index ${line.itemIndex} does not exist on this prescription`
              }
            ]
          });
          return;
        }

        if (itemMap.get(line.itemIndex) === true) {
          res.status(409).json({
            timestamp: new Date().toISOString(),
            status: 409,
            error: "Conflict",
            message: `Item at index ${line.itemIndex} has already been dispensed`,
            path: req.originalUrl || req.url,
            correlationId: req.correlationId
          });
          return;
        }
      }

      // Check duplicate itemIndex in the request lines
      const seenItemIndices = new Set<number>();
      for (const line of lines) {
        if (seenItemIndices.has(line.itemIndex)) {
          res.status(409).json({
            timestamp: new Date().toISOString(),
            status: 409,
            error: "Conflict",
            message: `Duplicate itemIndex ${line.itemIndex} in dispense request`,
            path: req.originalUrl || req.url,
            correlationId: req.correlationId
          });
          return;
        }
        seenItemIndices.add(line.itemIndex);
      }

      // 6. Begin transaction with row locking for drug stock check and update
      await client.query("BEGIN");

      // Aggregate required quantity per drugId
      const drugQuantities = new Map<string, number>();
      for (const line of lines) {
        const cur = drugQuantities.get(line.drugId) || 0;
        drugQuantities.set(line.drugId, cur + line.quantity);
      }

      // Verify each drug exists and has sufficient stock
      for (const [drugId, requiredQty] of drugQuantities.entries()) {
        const drugRes = await client.query(
          "SELECT id, name, stock FROM drugs WHERE id = $1 FOR UPDATE",
          [drugId]
        );

        if (drugRes.rowCount === 0) {
          await client.query("ROLLBACK");
          res.status(422).json({
            timestamp: new Date().toISOString(),
            status: 422,
            error: "Unprocessable Entity",
            message: "Validation failed",
            path: req.originalUrl || req.url,
            correlationId: req.correlationId,
            details: [
              {
                field: "lines.drugId",
                problem: `Drug ${drugId} not found`
              }
            ]
          });
          return;
        }

        const currentStock = parseInt(drugRes.rows[0].stock, 10);
        if (currentStock < requiredQty) {
          await client.query("ROLLBACK");
          res.status(409).json({
            timestamp: new Date().toISOString(),
            status: 409,
            error: "Conflict",
            message: `Insufficient stock for drug ${drugRes.rows[0].name}`,
            path: req.originalUrl || req.url,
            correlationId: req.correlationId
          });
          return;
        }
      }

      // Decrement stock for drugs
      for (const [drugId, requiredQty] of drugQuantities.entries()) {
        await client.query(
          "UPDATE drugs SET stock = stock - $1, updated_at = now() WHERE id = $2",
          [requiredQty, drugId]
        );
      }

      // Pharmacist id from token staffId or fallback
      const pharmacistId =
        req.user?.staffId ||
        "b2b2b2b2-0000-4000-8000-000000000005"; // default S5 Ines Chaabane
      const dispensingId = crypto.randomUUID();
      const dispensedAt = new Date().toISOString();

      // Record dispensing
      await client.query(
        "INSERT INTO dispensings (id, prescription_id, pharmacist_id, dispensed_at) VALUES ($1, $2, $3, $4)",
        [dispensingId, id, pharmacistId, dispensedAt]
      );

      // Record dispensing lines and mark items dispensed
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

      // Check if all items are dispensed
      const remainingRes = await client.query(
        "SELECT COUNT(*) FROM prescription_items WHERE prescription_id = $1 AND dispensed = false",
        [id]
      );
      const remainingCount = parseInt(remainingRes.rows[0].count, 10);
      const newStatus = remainingCount === 0 ? "DISPENSED" : "PARTIALLY_DISPENSED";

      await client.query(
        "UPDATE prescription_copies SET status = $1, updated_at = now() WHERE id = $2",
        [newStatus, id]
      );

      await client.query("COMMIT");

      // 7. Publish event asynchronously after commit (PHA-6)
      publishPrescriptionDispensedAsync(
        {
          prescriptionId: id,
          pharmacistId,
          status: newStatus,
          dispensedAt
        },
        req.correlationId
      );

      // 8. Return updated prescription
      const updatedRx = await fetchFullPrescription(client, id);
      res.status(200).json(updatedRx);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);
