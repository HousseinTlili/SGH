import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles, requireDoctorWithStaffId } from "../auth/roles.js";
import { pool } from "../db/pool.js";
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
    const { id } = req.params;
    const client = await pool.connect();
    try {
      const consultRes = await client.query(
        "SELECT id FROM consultations WHERE id = $1",
        [id]
      );

      if (consultRes.rows.length === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Consultation not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const ordersRes = await client.query(
        "SELECT * FROM lab_orders WHERE consultation_id = $1 ORDER BY created_at ASC",
        [id]
      );

      const orders = [];
      for (const order of ordersRes.rows) {
        const testsRes = await client.query(
          "SELECT code, name FROM lab_order_tests WHERE lab_order_id = $1",
          [order.id]
        );

        orders.push({
          id: order.id,
          consultationId: order.consultation_id,
          patientId: order.patient_id,
          doctorId: order.doctor_id,
          priority: order.priority,
          tests: testsRes.rows.map((t) => ({ code: t.code, name: t.name })),
          status: order.status,
          createdAt: new Date(order.created_at).toISOString()
        });
      }

      res.status(200).json(orders);
    } finally {
      client.release();
    }
  }
);

// POST /api/consultations/:id/lab-orders (CON-6)
labRouter.post(
  "/api/consultations/:id/lab-orders",
  authenticateToken,
  requireDoctorWithStaffId,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      // 1. Check consultation exists
      const consultRes = await client.query(
        "SELECT patient_id, doctor_id FROM consultations WHERE id = $1",
        [id]
      );

      if (consultRes.rows.length === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Consultation not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      const consultation = consultRes.rows[0];

      // Must be own doctor
      if (consultation.doctor_id !== req.user!.staffId) {
        res.status(403).json({
          timestamp: new Date().toISOString(),
          status: 403,
          error: "Forbidden",
          message: "You can only order lab tests for your own consultations",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      // 2. Validate input
      const parseResult = LabOrderInputSchema.safeParse(req.body);
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

      const { priority, tests } = parseResult.data;
      const labOrderId = crypto.randomUUID();
      const now = new Date().toISOString();

      await client.query("BEGIN");

      await client.query(
        `INSERT INTO lab_orders (id, consultation_id, patient_id, doctor_id, priority, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6)`,
        [labOrderId, id, consultation.patient_id, req.user!.staffId, priority, now]
      );

      for (const t of tests) {
        await client.query(
          `INSERT INTO lab_order_tests (id, lab_order_id, code, name)
           VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), labOrderId, t.code, t.name]
        );
      }

      await client.query("COMMIT");

      // Publish event asynchronously after commit (CON-6)
      publishEventAsync(
        "lab.request.created",
        {
          labRequestId: labOrderId,
          consultationId: id,
          patientId: consultation.patient_id,
          doctorId: req.user!.staffId,
          priority,
          tests
        },
        req.correlationId
      );

      res.status(201).json({
        id: labOrderId,
        consultationId: id,
        patientId: consultation.patient_id,
        doctorId: req.user!.staffId,
        priority,
        tests,
        status: "REQUESTED",
        createdAt: now
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

// GET /api/consultations/:id/lab-results (CON-7)
labRouter.get(
  "/api/consultations/:id/lab-results",
  authenticateToken,
  requireRoles("DOCTOR", "NURSE", "ADMIN", "PATIENT"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      const consultRes = await client.query(
        "SELECT patient_id FROM consultations WHERE id = $1",
        [id]
      );

      if (consultRes.rows.length === 0) {
        res.status(404).json({
          timestamp: new Date().toISOString(),
          status: 404,
          error: "Not Found",
          message: "Consultation not found",
          path: req.originalUrl || req.url,
          correlationId: req.correlationId
        });
        return;
      }

      if (
        req.user?.roles.includes("PATIENT") &&
        consultRes.rows[0].patient_id !== req.user.patientId
      ) {
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

      const resultsRes = await client.query(
        "SELECT * FROM lab_result_copies WHERE consultation_id = $1 ORDER BY validated_at ASC",
        [id]
      );

      const copies = resultsRes.rows.map((row) => ({
        labRequestId: row.lab_request_id,
        consultationId: row.consultation_id,
        patientId: row.patient_id,
        results: row.results,
        validatedAt: new Date(row.validated_at).toISOString()
      }));

      res.status(200).json(copies);
    } finally {
      client.release();
    }
  }
);
