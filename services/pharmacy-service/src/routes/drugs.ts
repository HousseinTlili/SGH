import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";
import {
  conflict,
  notFound,
  pageOf,
  parseOrThrow,
  parsePaging,
  uuidParam
} from "../http/errors.js";

export const drugsRouter = Router();

const DRUG_FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "DROPS", "INHALER"] as const;

const DrugInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  form: z.enum(DRUG_FORMS),
  strength: z.string().trim().min(1).max(40),
  unit: z.string().trim().min(1).max(30),
  stock: z.number().int().min(0),
  reorderThreshold: z.number().int().min(0)
});

const StockAdjustmentSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0, { message: "delta must be non-zero" }),
  reason: z.string().trim().min(1).max(200)
});

interface DrugRow {
  id: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  stock: number;
  reorder_threshold: number;
  created_at: Date;
  updated_at: Date;
}

function mapDrug(row: DrugRow) {
  return {
    id: row.id,
    name: row.name,
    form: row.form,
    strength: row.strength,
    unit: row.unit,
    stock: row.stock,
    reorderThreshold: row.reorder_threshold,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

const DUPLICATE = "A drug with the same name and strength already exists";

/** Runs a write that may hit the unique (name, strength) index; PHA-2 answers 409 even when two requests race. */
async function orDuplicate<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err: any) {
    if (err?.code === "23505") throw conflict(DUPLICATE);
    throw err;
  }
}

// GET /api/drugs
drugsRouter.get(
  "/api/drugs",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (req: Request, res: Response) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const paging = parsePaging(req.query);

    // The search is a plain "contains": %, _ and \ typed by the user are matched literally.
    const params: unknown[] = [];
    let where = "";
    if (search) {
      params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
      where = "WHERE name ILIKE $1";
    }

    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM drugs ${where}`, params);
    const data = await pool.query<DrugRow>(
      `SELECT * FROM drugs ${where} ORDER BY name ASC, strength ASC, id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, paging.size, paging.offset]
    );
    res.status(200).json(pageOf(data.rows.map(mapDrug), count.rows[0].total, paging));
  }
);

// GET /api/stock/alerts (PHA-8). Declared before the /api/drugs/:id routes.
drugsRouter.get(
  "/api/stock/alerts",
  authenticateToken,
  requireRoles("PHARMACIST", "DOCTOR", "ADMIN"),
  async (_req: Request, res: Response) => {
    const result = await pool.query<DrugRow>(
      "SELECT * FROM drugs WHERE stock <= reorder_threshold ORDER BY name ASC, id ASC"
    );
    res.status(200).json(result.rows.map(mapDrug));
  }
);

// POST /api/drugs
drugsRouter.post(
  "/api/drugs",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const input = parseOrThrow(DrugInputSchema, req.body ?? {});
    const id = crypto.randomUUID();
    const created = await orDuplicate(() =>
      pool.query<DrugRow>(
        `INSERT INTO drugs (id, name, form, strength, unit, stock, reorder_threshold, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
         RETURNING *`,
        [id, input.name, input.form, input.strength, input.unit, input.stock, input.reorderThreshold]
      )
    );
    res.status(201).header("Location", `/api/drugs/${id}`).json(mapDrug(created.rows[0]));
  }
);

// PUT /api/drugs/:id (the stock in the body is ignored: use the stock endpoint)
drugsRouter.put(
  "/api/drugs/:id",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const existing = await pool.query("SELECT 1 FROM drugs WHERE id = $1", [id]);
    if (existing.rowCount === 0) throw notFound("Drug not found");

    const input = parseOrThrow(DrugInputSchema, req.body ?? {});
    const updated = await orDuplicate(() =>
      pool.query<DrugRow>(
        `UPDATE drugs
            SET name = $1, form = $2, strength = $3, unit = $4, reorder_threshold = $5, updated_at = now()
          WHERE id = $6
          RETURNING *`,
        [input.name, input.form, input.strength, input.unit, input.reorderThreshold, id]
      )
    );
    res.status(200).json(mapDrug(updated.rows[0]));
  }
);

// POST /api/drugs/:id/stock (PHA-3). One conditional UPDATE: the stock can never go below zero,
// not even with concurrent adjustments or dispensings.
drugsRouter.post(
  "/api/drugs/:id/stock",
  authenticateToken,
  requireRoles("PHARMACIST"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const { delta } = parseOrThrow(StockAdjustmentSchema, req.body ?? {});

    const updated = await pool.query<DrugRow>(
      `UPDATE drugs SET stock = stock + $1, updated_at = now()
        WHERE id = $2 AND stock + $1 >= 0
        RETURNING *`,
      [delta, id]
    );
    if (updated.rows.length > 0) {
      res.status(200).json(mapDrug(updated.rows[0]));
      return;
    }

    const exists = await pool.query("SELECT 1 FROM drugs WHERE id = $1", [id]);
    if (exists.rowCount === 0) throw notFound("Drug not found");
    throw conflict("Stock cannot go below zero");
  }
);
