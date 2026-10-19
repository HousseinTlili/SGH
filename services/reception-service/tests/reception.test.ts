import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setDatabaseReady, pool } from "../src/db/pool.js";
import { setupTestDatabase, getToken } from "./helpers.js";
import { runPatientReverificationJob, runMockRemindersJob } from "../src/services/verificationJob.js";

describe("SGH Reception Service Tests", () => {
  let adminToken: string;
  let receptionToken: string;
  let doctor1Token: string;
  let doctor2Token: string;
  let patient1Token: string;
  let nurseToken: string;

  beforeAll(async () => {
    adminToken = await getToken("admin1");
    receptionToken = await getToken("reception1");
    doctor1Token = await getToken("doctor1");
    doctor2Token = await getToken("doctor2");
    patient1Token = await getToken("patient1");
    nurseToken = await getToken("nurse1");
  });

  beforeEach(async () => {
    await setupTestDatabase();
  });

  // ==========================================
  // Group 1: Health & Docs
  // ==========================================
  describe("Group 1: Health & Documentation Endpoints", () => {
    it("GET /health returns 200 with status UP without auth", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "UP" });
    });

    it("GET /openapi.json returns OpenAPI contract", async () => {
      const res = await request(app).get("/openapi.json");
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe("3.0.3");
      expect(res.body.info.title).toContain("Reception");
    });

    it("GET /docs returns Swagger UI page", async () => {
      const res = await request(app).get("/docs/");
      expect(res.status).toBe(200);
      expect(res.text).toContain("swagger");
    });
  });

  // ==========================================
  // Group 2: Stub endpoint
  // ==========================================
  describe("Group 2: Stub ping endpoint", () => {
    it("returns 401 without bearer token", async () => {
      const res = await request(app).get("/api/_stub/ping");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("returns 403 for non-ADMIN user (reception1)", async () => {
      const res = await request(app)
        .get("/api/_stub/ping")
        .set("Authorization", `Bearer ${receptionToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("returns 200 for ADMIN with service name and username", async () => {
      const res = await request(app)
        .get("/api/_stub/ping")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        service: "reception",
        user: "admin1"
      });
    });
  });

  // ==========================================
  // Group 3: Database unavailable (X-8)
  // ==========================================
  describe("Group 3: Resilience when Database unavailable (X-8)", () => {
    it("returns 503 for data endpoints while /health returns 200", async () => {
      setDatabaseReady(false);

      const healthRes = await request(app).get("/health");
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe("UP");

      const dataRes = await request(app)
        .get("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`);
      expect(dataRes.status).toBe(503);
      expect(dataRes.body.error).toBe("Service Unavailable");
      expect(dataRes.body.message).toBe("Database unavailable");
      expect(dataRes.body.correlationId).toBeDefined();

      setDatabaseReady(true);
    });
  });

  // ==========================================
  // Group 4: Booking validations (REC-1, REC-2)
  // ==========================================
  describe("Group 4: Booking validation rules (REC-1, REC-2)", () => {
    it("returns 422 if startAt is in the past (REC-2)", async () => {
      const pastStart = new Date(Date.now() - 3600000).toISOString();
      const pastEnd = new Date(Date.now() - 1800000).toISOString();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
          startAt: pastStart,
          endAt: pastEnd,
          reason: "Past visit"
        });

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "startAt", problem: "must be in the future" })
        ])
      );
    });

    it("returns 422 if duration is less than 10 minutes (REC-1)", async () => {
      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(new Date(start).getTime() + 5 * 60000).toISOString(); // 5 min

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
          startAt: start,
          endAt: end,
          reason: "Too short visit"
        });

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "endAt", problem: "duration must be between 10 and 120 minutes" })
        ])
      );
    });

    it("returns 422 if duration is more than 120 minutes (REC-1)", async () => {
      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(new Date(start).getTime() + 150 * 60000).toISOString(); // 150 min

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
          startAt: start,
          endAt: end,
          reason: "Too long visit"
        });

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "endAt", problem: "duration must be between 10 and 120 minutes" })
        ])
      );
    });

    it("returns 422 if endAt is before startAt", async () => {
      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(new Date(start).getTime() - 1000).toISOString();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
          startAt: start,
          endAt: end,
          reason: "Inverted times"
        });

      expect(res.status).toBe(422);
    });
  });

  // ==========================================
  // Group 5: Patient lookup & verification (REC-5, REC-6)
  // ==========================================
  describe("Group 5: Patient lookup and verification (REC-5, REC-6)", () => {
    it("books appointment with patientVerified flag and emits Location header", async () => {
      const start = new Date(Date.now() + 2 * 86400000).toISOString(); // 2 days in future
      const end = new Date(new Date(start).getTime() + 30 * 60000).toISOString();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
          startAt: start,
          endAt: end,
          reason: "Routine appointment"
        });

      expect(res.status).toBe(201);
      expect(res.header.location).toBe(`/api/appointments/${res.body.id}`);
      expect(res.body.status).toBe("SCHEDULED");
      expect(typeof res.body.patientVerified).toBe("boolean");
    });

    it("patient reverification job runs and queries unverified appointments (REC-6)", async () => {
      const count = await runPatientReverificationJob();
      expect(typeof count).toBe("number");
    });
  });

  // ==========================================
  // Group 6: Doctor overlap check (REC-3)
  // ==========================================
  describe("Group 6: Doctor overlap check (REC-3)", () => {
    it("returns 409 Conflict if doctor already has an appointment at this time", async () => {
      // Fetch seed appointment A1 for doctor S1
      const a1Res = await request(app)
        .get("/api/appointments/e5e5e5e5-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${receptionToken}`);
      expect(a1Res.status).toBe(200);

      const a1 = a1Res.body;

      // Try booking an overlapping appointment for same doctor S1
      const overlapStart = new Date(new Date(a1.startAt).getTime() + 10 * 60000).toISOString();
      const overlapEnd = new Date(new Date(a1.endAt).getTime() + 10 * 60000).toISOString();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000002",
          doctorId: a1.doctorId,
          startAt: overlapStart,
          endAt: overlapEnd,
          reason: "Overlapping appointment"
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
      expect(res.body.message).toBe("Doctor already has an appointment at this time");
    });

    it("allows booking an appointment at the same time for a different doctor", async () => {
      const a1Res = await request(app)
        .get("/api/appointments/e5e5e5e5-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${receptionToken}`);
      const a1 = a1Res.body;

      // Doctor S2 at same time as S1
      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000002",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000002",
          startAt: a1.startAt,
          endAt: a1.endAt,
          reason: "Different doctor same slot"
        });

      expect(res.status).toBe(201);
    });
  });

  // ==========================================
  // Group 7: Availability endpoint (REC-14)
  // ==========================================
  describe("Group 7: Availability endpoint (REC-14)", () => {
    it("returns 18 half-hour slots for a given doctor and date", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

      const res = await request(app)
        .get(`/api/appointments/availability?doctorId=b2b2b2b2-0000-4000-8000-000000000001&date=${tomorrow}`)
        .set("Authorization", `Bearer ${receptionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.doctorId).toBe("b2b2b2b2-0000-4000-8000-000000000001");
      expect(res.body.date).toBe(tomorrow);
      expect(res.body.slots).toHaveLength(18);

      // Verify slot interval format
      const firstSlot = res.body.slots[0];
      expect(firstSlot.startAt).toContain("T08:00:00.000Z");
      expect(firstSlot.endAt).toContain("T08:30:00.000Z");
      expect(typeof firstSlot.available).toBe("boolean");

      const lastSlot = res.body.slots[17];
      expect(lastSlot.startAt).toContain("T16:30:00.000Z");
      expect(lastSlot.endAt).toContain("T17:00:00.000Z");
    });

    it("returns 422 if doctorId or date is missing", async () => {
      const res = await request(app)
        .get("/api/appointments/availability")
        .set("Authorization", `Bearer ${receptionToken}`);
      expect(res.status).toBe(422);
    });
  });

  // ==========================================
  // Group 8: State transitions (REC-4)
  // ==========================================
  describe("Group 8: Appointment state transitions (REC-4)", () => {
    it("moves SCHEDULED -> CHECKED_IN (200)", async () => {
      const res = await request(app)
        .post("/api/appointments/e5e5e5e5-0000-4000-8000-000000000001/check-in")
        .set("Authorization", `Bearer ${receptionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CHECKED_IN");
    });

    it("returns 409 when attempting check-in on already CHECKED_IN appointment", async () => {
      const res = await request(app)
        .post("/api/appointments/e5e5e5e5-0000-4000-8000-000000000003/check-in")
        .set("Authorization", `Bearer ${receptionToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });

    it("moves CHECKED_IN -> COMPLETED (200)", async () => {
      const res = await request(app)
        .post("/api/appointments/e5e5e5e5-0000-4000-8000-000000000003/complete")
        .set("Authorization", `Bearer ${receptionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("COMPLETED");
    });

    it("returns 409 when attempting to cancel a COMPLETED appointment", async () => {
      const res = await request(app)
        .post("/api/appointments/e5e5e5e5-0000-4000-8000-000000000004/cancel")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ reason: "Cannot cancel completed" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
      expect(res.body.message).toBe("Cannot cancel appointment");
    });
  });

  // ==========================================
  // Group 9: Appointment edit (PUT)
  // ==========================================
  describe("Group 9: Edit appointment (PUT /api/appointments/:id)", () => {
    it("updates SCHEDULED appointment and returns 200", async () => {
      const a1 = (await request(app)
        .get("/api/appointments/e5e5e5e5-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${receptionToken}`)).body;

      const newStart = new Date(new Date(a1.startAt).getTime() + 30 * 60000).toISOString();
      const newEnd = new Date(new Date(a1.endAt).getTime() + 30 * 60000).toISOString();

      const res = await request(app)
        .put("/api/appointments/e5e5e5e5-0000-4000-8000-000000000001")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: a1.patientId,
          doctorId: a1.doctorId,
          startAt: newStart,
          endAt: newEnd,
          reason: "Updated reason"
        });

      expect(res.status).toBe(200);
      expect(res.body.reason).toBe("Updated reason");
    });

    it("returns 409 when editing non-SCHEDULED appointment", async () => {
      const a3 = (await request(app)
        .get("/api/appointments/e5e5e5e5-0000-4000-8000-000000000003")
        .set("Authorization", `Bearer ${receptionToken}`)).body;

      const res = await request(app)
        .put("/api/appointments/e5e5e5e5-0000-4000-8000-000000000003")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: a3.patientId,
          doctorId: a3.doctorId,
          startAt: a3.startAt,
          endAt: a3.endAt,
          reason: "Should fail"
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Only SCHEDULED appointments can be updated");
    });
  });

  // ==========================================
  // Group 10: Cancellation & reminders (REC-10)
  // ==========================================
  describe("Group 10: Appointment cancellation and reminders (REC-10)", () => {
    it("cancels appointment and updates pending reminders to CANCELLED", async () => {
      // Insert a pending reminder for A2
      await pool.query(`
        INSERT INTO reminders (id, appointment_id, remind_at, status)
        VALUES (gen_random_uuid(), 'e5e5e5e5-0000-4000-8000-000000000002', now() + interval '1 hour', 'PENDING')
      `);

      const res = await request(app)
        .post("/api/appointments/e5e5e5e5-0000-4000-8000-000000000002/cancel")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ reason: "Patient had a conflict" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
      expect(res.body.cancelReason).toBe("Patient had a conflict");

      // Verify reminder status in database
      const remRes = await pool.query(
        "SELECT status FROM reminders WHERE appointment_id = 'e5e5e5e5-0000-4000-8000-000000000002'"
      );
      expect(remRes.rows[0].status).toBe("CANCELLED");
    });
  });

  // ==========================================
  // Group 11: Invoice creation (REC-11, REC-13)
  // ==========================================
  describe("Group 11: Invoice creation and server-computed total (REC-11)", () => {
    it("creates an invoice with server-computed total (sum of qty * unitPrice)", async () => {
      const lines = [
        { description: "Consultation general", quantity: 2, unitPrice: 40.0 }, // 80.00
        { description: "ECG test", quantity: 1, unitPrice: 25.5 }             // 25.50
      ];

      const res = await request(app)
        .post("/api/invoices")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          appointmentId: "e5e5e5e5-0000-4000-8000-000000000001",
          lines,
          total: 999.99 // Sent total should be IGNORED
        });

      expect(res.status).toBe(201);
      expect(res.header.location).toBe(`/api/invoices/${res.body.id}`);
      expect(res.body.total).toBe(105.5);
      expect(res.body.currency).toBe("TND");
      expect(res.body.status).toBe("PENDING");
      expect(res.body.lines).toHaveLength(2);
    });

    it("returns 422 if invoice has no lines", async () => {
      const res = await request(app)
        .post("/api/invoices")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          lines: []
        });

      expect(res.status).toBe(422);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "lines" })
        ])
      );
    });
  });

  // ==========================================
  // Group 12: Invoice state transitions (REC-12)
  // ==========================================
  describe("Group 12: Invoice state transitions (REC-12)", () => {
    it("pays a PENDING invoice with CASH and sets status to PAID", async () => {
      const res = await request(app)
        .post("/api/invoices/e6e6e6e6-0000-4000-8000-000000000002/pay")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ method: "CASH" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("PAID");
      expect(res.body.paymentMethod).toBe("CASH");
      expect(res.body.paidAt).toBeDefined();
    });

    it("returns 409 when attempting to pay an already PAID invoice", async () => {
      const res = await request(app)
        .post("/api/invoices/e6e6e6e6-0000-4000-8000-000000000001/pay")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ method: "CARD" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Invoice is not in PENDING status");
    });

    it("cancels a PENDING invoice", async () => {
      // Create a pending invoice to cancel
      const createRes = await request(app)
        .post("/api/invoices")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          lines: [{ description: "Checkup", quantity: 1, unitPrice: 50.0 }]
        });

      const invId = createRes.body.id;

      const cancelRes = await request(app)
        .post(`/api/invoices/${invId}/cancel`)
        .set("Authorization", `Bearer ${receptionToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe("CANCELLED");
    });
  });

  // ==========================================
  // Group 13: Role visibility & RBAC (REC-15)
  // ==========================================
  describe("Group 13: Role-based access control & visibility (REC-15)", () => {
    it("DOCTOR sees only their own appointments in list", async () => {
      const res = await request(app)
        .get("/api/appointments")
        .set("Authorization", `Bearer ${doctor1Token}`);

      expect(res.status).toBe(200);
      // All returned appointments must belong to doctor1 (staffId b2b2b2b2-0000-4000-8000-000000000001)
      res.body.content.forEach((appt: any) => {
        expect(appt.doctorId).toBe("b2b2b2b2-0000-4000-8000-000000000001");
      });
    });

    it("DOCTOR gets 403 when trying to access another doctor's appointment", async () => {
      // A2 belongs to Doctor S2 (b2b2b2b2-0000-4000-8000-000000000002)
      const res = await request(app)
        .get("/api/appointments/e5e5e5e5-0000-4000-8000-000000000002")
        .set("Authorization", `Bearer ${doctor1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("PATIENT gets 403 when trying to access another patient's appointment", async () => {
      // A2 belongs to Patient P2 (a1a1a1a1-0000-4000-8000-000000000002), patient1 token is P1
      const res = await request(app)
        .get("/api/appointments/e5e5e5e5-0000-4000-8000-000000000002")
        .set("Authorization", `Bearer ${patient1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("NURSE gets 403 when trying to book an appointment", async () => {
      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(new Date(start).getTime() + 30 * 60000).toISOString();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${nurseToken}`)
        .send({
          patientId: "a1a1a1a1-0000-4000-8000-000000000001",
          doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
          startAt: start,
          endAt: end,
          reason: "Nurse booking should fail"
        });

      expect(res.status).toBe(403);
    });

    it("mock reminders job creates reminders for upcoming appointments", async () => {
      const count = await runMockRemindersJob();
      expect(typeof count).toBe("number");
    });
  });
});
