import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";

export const drugsRouter = Router();

const DRUG_FORMS = [
  "TABLET",
  "CAPSULE",
  "SYRUP",
  "INJECTION",
  "CREAM",
  "DROPS",
  "INHALER"
] as const;

const DrugInputSchema = z.object({
  name: z.string().min(1).max(120),
  form: z.enum(DRUG_FORMS),
  strength: z.string().max(40),
  unit: z.string().max(30),
  stock: z.number().int().min(0),
  reorderThreshold: z.number().int().min(0)
});

const StockAdjustmentSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((val) => val !== 0, { message: "delta must be non-zero" }),
  reason: z.string().min(1).max(200)
});

function mapDrug(row: any) {
  return {
    id: row.id,
    name: row.name,
    form: row.form,
    strength: row.strength,
    unit: row.unit,
    stock: parseInt(row.stock, 10),
    reorderThreshold: parseInt(row.reorder_threshold, 10),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

// GET /api/drugs (PHA-1)
drugsRouter.get(
  "/api/drugs",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : null;
    const page = Math.max(0, parseInt((req.query.page as string) || "0", 10));
    const size = Math.min(100, Math.max(1, parseInt((req.query.size as string) || "20", 10)));
    const offset = page * size;

    const client = await pool.connect();
    try {
      let countQuery = "SELECT COUNT(*) FROM drugs";
      let dataQuery = "SELECT * FROM drugs";
      const params: any[] = [];

      if (search) {
        countQuery += " WHERE LOWER(name) LIKE LOWER($1)";
        dataQuery += " WHERE LOWER(name) LIKE LOWER($1)";
        params.push(`%${search}%`);
      }

      dataQuery += ` ORDER BY name ASC, id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

      const countRes = await client.query(countQuery, params);
      const totalElements = parseInt(countRes.rows[0].count, 10);
      const totalPages = Math.ceil(totalElements / size);

      const dataRes = await client.query(dataQuery, [...params, size, offset]);
      const content = dataRes.rows.map(mapDrug);

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

// GET /api/stock/alerts (PHA-8) - Declared before /api/drugs/:id
drugsRouter.get(
  "/api/stock/alerts",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM drugs WHERE stock <= reorder_threshold ORDER BY name ASC, id ASC"
      );
      res.status(200).json(result.rows.map(mapDrug));
    } finally {
      client.release();
    }
  }
);

// POST /api/drugs (PHA-2)
drugsRouter.post(
  "/api/drugs",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const parseResult = DrugInputSchema.safeParse(req.body);
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

    const { name, form, strength, unit, stock, reorderThreshold } = parseResult.data;
    const client = await pool.connect();
    try {
      // Check for duplicate name + strength (case-insensitive)
      const existing = await client.query(
        "SELECT 1 FROM drugs WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND LOWER(TRIM(strength)) = LOWER(TRIM($2))",
        [name, strength]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "A drug with this name and strength already exists",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const insertRes = await client.query(
        `INSERT INTO drugs (id, name, form, strength, unit, stock, reorder_threshold, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING *`,
        [id, name, form, strength, unit, stock, reorderThreshold, now]
      );

      const drug = mapDrug(insertRes.rows[0]);
      res.setHeader("Location", `/api/drugs/${id}`);
      res.status(201).json(drug);
    } finally {
      client.release();
    }
  }
);

// PUT /api/drugs/:id (PHA-2 / spec: stock value is ignored)
drugsRouter.put(
  "/api/drugs/:id",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const parseResult = DrugInputSchema.safeParse(req.body);
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

    const { name, form, strength, unit, reorderThreshold } = parseResult.data;
    const client = await pool.connect();
    try {
      const existing = await client.query("SELECT * FROM drugs WHERE id = $1", [id]);
      if (existing.rowCount === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Drug not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // Check conflict with other drugs (name + strength)
      const conflict = await client.query(
        "SELECT 1 FROM drugs WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND LOWER(TRIM(strength)) = LOWER(TRIM($2)) AND id != $3",
        [name, strength, id]
      );

      if (conflict.rowCount && conflict.rowCount > 0) {
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "A drug with this name and strength already exists",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // Update without changing stock
      const updateRes = await client.query(
        `UPDATE drugs 
         SET name = $1, form = $2, strength = $3, unit = $4, reorder_threshold = $5, updated_at = now()
         WHERE id = $6
         RETURNING *`,
        [name, form, strength, unit, reorderThreshold, id]
      );

      res.status(200).json(mapDrug(updateRes.rows[0]));
    } finally {
      client.release();
    }
  }
);

// POST /api/drugs/:id/stock (PHA-3)
drugsRouter.post(
  "/api/drugs/:id/stock",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const parseResult = StockAdjustmentSchema.safeParse(req.body);
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

    const { delta } = parseResult.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const drugRes = await client.query(
        "SELECT * FROM drugs WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (drugRes.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Drug not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const currentStock = parseInt(drugRes.rows[0].stock, 10);
      const newStock = currentStock + delta;

      if (newStock < 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          timestamp: new Date().toISOString(),
          status: 409,
          error: "Conflict",
          message: "Stock cannot be negative",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const updateRes = await client.query(
        "UPDATE drugs SET stock = $1, updated_at = now() WHERE id = $2 RETURNING *",
        [newStock, id]
      );

      await client.query("COMMIT");
      res.status(200).json(mapDrug(updateRes.rows[0]));
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);
