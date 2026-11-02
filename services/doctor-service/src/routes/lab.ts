import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles, requireDoctorWithStaffId } from "../auth/roles.js";
import { pool, withTransaction } from "../db/pool.js";
import { forbidden, notFound, parseOrThrow, uuidParam } from "../http/errors.js";
import { publishEventAsync } from "../events/amqp.js";

export const labRouter = Router();

const LabTestRefSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100)
});

const LabOrderInputSchema = z
  .object({
    priority: z.enum(["ROUTINE", "URGENT"]),
    tests: z.array(LabTestRefSchema).min(1).max(10)
  })
  .superRefine((data, ctx) => {
    const codes = data.tests.map((t) => t.code);
    const unique = new Set(codes);
    if (unique.size !== codes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tests"],
        message: "Test codes must be unique"
      });
    }
  });

// GET /api/consultations/:id/lab-orders
labRouter.get(
  "/api/consultations/:id/lab-orders",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const consultation = await pool.query("SELECT id FROM consultations WHERE id = $1", [id]);
    if (consultation.rows.length === 0) throw notFound("Consultation not found");

    const orders = await pool.query(
      "SELECT * FROM lab_orders WHERE consultation_id = $1 ORDER BY created_at ASC",
      [id]
    );
    const tests = await pool.query(
      `SELECT lab_order_id, code, name FROM lab_order_tests
        WHERE lab_order_id = ANY($1::uuid[])`,
      [orders.rows.map((o) => o.id)]
    );

    res.status(200).json(
      orders.rows.map((order) => ({
        id: order.id,
        consultationId: order.consultation_id,
        patientId: order.patient_id,
        doctorId: order.doctor_id,
        priority: order.priority,
        tests: tests.rows
          .filter((t) => t.lab_order_id === order.id)
          .map((t) => ({ code: t.code, name: t.name })),
        status: order.status,
        createdAt: new Date(order.created_at).toISOString()
      }))
    );
  }
);

// POST /api/consultations/:id/lab-orders (CON-6)
labRouter.post(
  "/api/consultations/:id/lab-orders",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const consultation = await pool.query(
      "SELECT patient_id, doctor_id FROM consultations WHERE id = $1",
      [id]
    );
    if (consultation.rows.length === 0) throw notFound("Consultation not found");

    const { patient_id: patientId, doctor_id: ownerId } = consultation.rows[0];
    const doctorId = req.user!.staffId!;
    if (ownerId !== doctorId) {
      throw forbidden("You can only order lab tests for your own consultations");
    }

    const { priority, tests } = parseOrThrow(LabOrderInputSchema, req.body);
    const labOrderId = crypto.randomUUID();
    const createdAt = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO lab_orders (id, consultation_id, patient_id, doctor_id, priority, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'REQUESTED', now())
         RETURNING created_at`,
        [labOrderId, id, patientId, doctorId, priority]
      );
      for (const test of tests) {
        await client.query(
          `INSERT INTO lab_order_tests (id, lab_order_id, code, name) VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), labOrderId, test.code, test.name]
        );
      }
      return new Date(inserted.rows[0].created_at).toISOString();
    });

    publishEventAsync(
      "lab.request.created",
      { labRequestId: labOrderId, consultationId: id, patientId, doctorId, priority, tests },
      req.correlationId
    );

    res.status(201).json({
      id: labOrderId,
      consultationId: id,
      patientId,
      doctorId,
      priority,
      tests,
      status: "REQUESTED",
      createdAt
    });
  }
);

// GET /api/consultations/:id/lab-results (CON-7)
labRouter.get(
  "/api/consultations/:id/lab-results",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const id = uuidParam(req.params.id as string);
    const consultation = await pool.query(
      "SELECT patient_id FROM consultations WHERE id = $1",
      [id]
    );
    if (consultation.rows.length === 0) throw notFound("Consultation not found");

    if (
      req.user!.roles.includes("PATIENT") &&
      consultation.rows[0].patient_id !== req.user!.patientId
    ) {
      throw forbidden();
    }

    const copies = await pool.query(
      "SELECT * FROM lab_result_copies WHERE consultation_id = $1 ORDER BY validated_at ASC",
      [id]
    );
    res.status(200).json(
      copies.rows.map((row) => ({
        labRequestId: row.lab_request_id,
        consultationId: row.consultation_id,
        patientId: row.patient_id,
        results: row.results,
        validatedAt: new Date(row.validated_at).toISOString()
      }))
    );
  }
);
