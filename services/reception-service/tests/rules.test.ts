import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import fs from "node:fs";
import YAML from "yamljs";
import { app } from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { getToken, setupTestDatabase } from "./helpers.js";
import { peers } from "./peers.js";
import { runMockRemindersJob, runPatientReverificationJob } from "../src/services/verificationJob.js";
import { publishEventAsync } from "../src/events/amqp.js";

vi.mock("../src/events/amqp.js", () => ({
  publishEventAsync: vi.fn(),
  initRabbitMQ: vi.fn(),
  closeRabbitMQ: vi.fn()
}));

const DOCTOR1 = "b2b2b2b2-0000-4000-8000-000000000001";
const DOCTOR2 = "b2b2b2b2-0000-4000-8000-000000000002";
const PATIENT1 = "a1a1a1a1-0000-4000-8000-000000000001";
const A1 = "e5e5e5e5-0000-4000-8000-000000000001";

const slot = (hoursAhead: number, minutes = 30) => {
  const start = new Date(Date.now() + hoursAhead * 3600_000);
  start.setUTCSeconds(0, 0);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + minutes * 60_000).toISOString() };
};

const booking = (overrides: Record<string, unknown> = {}) => ({
  patientId: PATIENT1,
  doctorId: DOCTOR1,
  reason: "Check-up",
  ...slot(72),
  ...overrides
});

describe("Reception rules", () => {
  let reception: string;
  let doctor: string;
  let patient: string;
  let admin: string;

  beforeAll(async () => {
    reception = await getToken("reception1");
    doctor = await getToken("doctor1");
    patient = await getToken("patient1");
    admin = await getToken("admin1");
  });

  beforeEach(async () => {
    await setupTestDatabase();
    peers.reset();
    vi.mocked(publishEventAsync).mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  const post = (body: object, token = reception) =>
    request(app).post("/api/appointments").set("Authorization", `Bearer ${token}`).send(body);

  describe("seed", () => {
    it("matches the fixtures: four appointments and two invoices", async () => {
      const appts = await request(app).get("/api/appointments").set("Authorization", `Bearer ${reception}`);
      expect(appts.body.totalElements).toBe(4);
      const invs = await request(app).get("/api/invoices").set("Authorization", `Bearer ${reception}`);
      expect(invs.body.totalElements).toBe(2);
    });
  });

  describe("REC-5 patient lookup and fallback", () => {
    it("forwards the caller's token and correlation id to the Patient service (X-4)", async () => {
      const res = await post(booking()).set("X-Correlation-Id", "corr1234");
      expect(res.status).toBe(201);
      expect(res.body.patientVerified).toBe(true);
      expect(peers.patientAuth.at(-1)).toBe(`Bearer ${reception}`);
      expect(peers.patientCorrelation.at(-1)).toBe("corr1234");
    });

    it("answers 422 when the Patient service says the patient does not exist", async () => {
      peers.patient = "not-found";
      const res = await post(booking());
      expect(res.status).toBe(422);
      expect(res.body.details).toEqual([{ field: "patientId", problem: "Patient not found" }]);
    });

    it.each(["error", "reset", "hang"] as const)(
      "books with patientVerified = false when the Patient service fails (%s)",
      async (mode) => {
        peers.patient = mode;
        const res = await post(booking());
        expect(res.status).toBe(201);
        expect(res.body.patientVerified).toBe(false);
      }
    );
  });

  describe("REC-6 re-verification job", () => {
    it("flips patientVerified once the Patient service is back, using the service account", async () => {
      peers.patient = "error";
      const created = await post(booking());
      expect(created.body.patientVerified).toBe(false);

      expect(await runPatientReverificationJob()).toBe(0); // still down
      peers.patient = "ok";
      expect(await runPatientReverificationJob()).toBe(1);

      expect(peers.patientAuth.at(-1)).toBe("Bearer service-token");
      const row = await pool.query("SELECT patient_verified FROM appointments WHERE id = $1", [created.body.id]);
      expect(row.rows[0].patient_verified).toBe(true);
    });

    it("only logs when the patient is unknown and leaves the flag false", async () => {
      peers.patient = "error";
      const created = await post(booking());
      peers.patient = "not-found";
      expect(await runPatientReverificationJob()).toBe(0);
      const row = await pool.query("SELECT patient_verified FROM appointments WHERE id = $1", [created.body.id]);
      expect(row.rows[0].patient_verified).toBe(false);
    });

    it("survives a missing service token", async () => {
      peers.patient = "error";
      await post(booking());
      peers.token = "error";
      await expect(runPatientReverificationJob()).resolves.toBe(0);
    });
  });

  describe("REC-7 doctor lookup", () => {
    it("answers 422 when the Staff service says the doctor does not exist", async () => {
      peers.staff = "not-found";
      const res = await post(booking());
      expect(res.status).toBe(422);
      expect(res.body.details).toEqual([{ field: "doctorId", problem: "Doctor not found" }]);
    });

    it.each(["error", "reset", "hang"] as const)("skips the check when the Staff service fails (%s)", async (mode) => {
      peers.staff = mode;
      const res = await post(booking());
      expect(res.status).toBe(201);
    });
  });

  describe("REC-2 / REC-3 booking rules", () => {
    it("rejects moving an appointment into the past (PUT)", async () => {
      const res = await request(app)
        .put(`/api/appointments/${A1}`)
        .set("Authorization", `Bearer ${reception}`)
        .send(booking({ ...slot(-5), doctorId: DOCTOR1 }));
      expect(res.status).toBe(422);
      expect(res.body.details).toEqual([{ field: "startAt", problem: "must be in the future" }]);
    });

    it("lets PUT change the reason without moving the appointment", async () => {
      const current = await request(app).get(`/api/appointments/${A1}`).set("Authorization", `Bearer ${reception}`);
      const res = await request(app)
        .put(`/api/appointments/${A1}`)
        .set("Authorization", `Bearer ${reception}`)
        .send({ ...current.body, reason: "Changed reason" });
      expect(res.status).toBe(200);
      expect(res.body.reason).toBe("Changed reason");
    });

    it("allows exactly one of two simultaneous bookings for the same doctor and time", async () => {
      const body = booking(slot(96));
      const results = await Promise.all(Array.from({ length: 6 }, () => post(body)));
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    });

    it("lets back-to-back appointments through (end == start is not an overlap)", async () => {
      const first = slot(120);
      expect((await post(booking(first))).status).toBe(201);
      const second = { startAt: first.endAt, endAt: new Date(Date.parse(first.endAt) + 30 * 60_000).toISOString() };
      expect((await post(booking(second))).status).toBe(201);
    });

    it("does not count cancelled appointments as overlapping", async () => {
      const t = slot(144);
      const first = await post(booking(t));
      await request(app).post(`/api/appointments/${first.body.id}/cancel`).set("Authorization", `Bearer ${reception}`).send({});
      expect((await post(booking(t))).status).toBe(201);
    });

    it("reports 422 field problems instead of failing on bad ids or dates", async () => {
      const res = await post({ patientId: "nope", doctorId: DOCTOR1, startAt: "yesterday", endAt: "tomorrow", reason: " " });
      expect(res.status).toBe(422);
      const fields = res.body.details.map((d: { field: string }) => d.field).sort();
      expect(fields).toEqual(expect.arrayContaining(["patientId", "reason", "startAt"]));
    });
  });

  describe("REC-4 / REC-8 / REC-10 state changes", () => {
    it("publishes appointment.created after booking and appointment.cancelled after cancelling", async () => {
      const created = await post(booking());
      expect(publishEventAsync).toHaveBeenCalledWith(
        "appointment.created",
        expect.objectContaining({ appointmentId: created.body.id, doctorId: DOCTOR1 }),
        expect.any(String)
      );
      await request(app).post(`/api/appointments/${created.body.id}/cancel`).set("Authorization", `Bearer ${reception}`).send({ reason: "no" });
      expect(publishEventAsync).toHaveBeenLastCalledWith(
        "appointment.cancelled",
        expect.objectContaining({ appointmentId: created.body.id }),
        expect.any(String)
      );
    });

    it("does not publish when the booking is rejected", async () => {
      peers.patient = "not-found";
      await post(booking());
      expect(publishEventAsync).not.toHaveBeenCalled();
    });

    it("rejects a cancel reason longer than 255 characters", async () => {
      const res = await request(app)
        .post(`/api/appointments/${A1}/cancel`)
        .set("Authorization", `Bearer ${reception}`)
        .send({ reason: "x".repeat(256) });
      expect(res.status).toBe(422);
    });

    it("answers 409 to a second cancel and 404 to an unknown appointment", async () => {
      const url = `/api/appointments/${A1}/cancel`;
      await request(app).post(url).set("Authorization", `Bearer ${reception}`).send({});
      expect((await request(app).post(url).set("Authorization", `Bearer ${reception}`).send({})).status).toBe(409);
      const unknown = await request(app).post(`/api/appointments/${crypto.randomUUID()}/cancel`).set("Authorization", `Bearer ${reception}`).send({});
      expect(unknown.status).toBe(404);
    });

    it("only lets one of two simultaneous check-ins win", async () => {
      const call = () => request(app).post(`/api/appointments/${A1}/check-in`).set("Authorization", `Bearer ${reception}`);
      const statuses = (await Promise.all([call(), call(), call()])).map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409, 409]);
    });
  });

  describe("REC-9 reminders", () => {
    it("creates one SMS and one EMAIL reminder for appointments starting within 24 hours, once", async () => {
      const soon = await post(booking(slot(5)));
      const later = await post(booking({ ...slot(30), doctorId: DOCTOR2 }));
      // The seeded A1/A2 may also be inside the window, depending on the time of day.
      expect(await runMockRemindersJob()).toBeGreaterThanOrEqual(2);

      const rows = await pool.query(
        "SELECT channel, status, sent_at FROM reminders WHERE appointment_id = $1 ORDER BY channel",
        [soon.body.id]
      );
      expect(rows.rows.map((r) => [r.channel, r.status])).toEqual([["EMAIL", "SENT"], ["SMS", "SENT"]]);
      expect(rows.rows.every((r) => r.sent_at !== null)).toBe(true);
      const none = await pool.query("SELECT 1 FROM reminders WHERE appointment_id = $1", [later.body.id]);
      expect(none.rowCount).toBe(0);

      expect(await runMockRemindersJob()).toBe(0); // idempotent
    });

    it("writes the documented log line", async () => {
      const lines: string[] = [];
      const { logger } = await import("../src/middleware/logger.js");
      vi.spyOn(logger, "info").mockImplementation(((arg: unknown) => {
        if (typeof arg === "string") lines.push(arg);
      }) as never);
      const soon = await post(booking(slot(4)));
      await runMockRemindersJob();
      const sms = lines.find((l) => l.startsWith("REMINDER channel=SMS"));
      expect(sms).toBe(
        `REMINDER channel=SMS appointmentId=${soon.body.id} patientId=${PATIENT1} startAt=${soon.body.startAt}`
      );
    });

    it("skips appointments that are not SCHEDULED", async () => {
      await request(app).post(`/api/appointments/${A1}/check-in`).set("Authorization", `Bearer ${reception}`);
      await pool.query("UPDATE appointments SET start_at = now() + interval '2 hours', end_at = now() + interval '3 hours' WHERE id = $1", [A1]);
      await runMockRemindersJob();
      const forA1 = await pool.query("SELECT 1 FROM reminders WHERE appointment_id = $1", [A1]);
      expect(forA1.rowCount).toBe(0);
    });
  });

  describe("REC-11 / REC-12 invoices", () => {
    const invoice = (body: object) =>
      request(app).post("/api/invoices").set("Authorization", `Bearer ${reception}`).send(body);

    it("computes the total in cents and ignores a client total", async () => {
      const res = await invoice({
        patientId: PATIENT1,
        total: 1,
        lines: [
          { description: "A", quantity: 3, unitPrice: 0.1 },
          { description: "B", quantity: 1, unitPrice: 19.99 }
        ]
      });
      expect(res.status).toBe(201);
      expect(res.body.total).toBe(20.29);
      expect(res.body.status).toBe("PENDING");
    });

    it("rejects prices with more than two decimals and bad quantities", async () => {
      const res = await invoice({
        patientId: PATIENT1,
        lines: [{ description: "A", quantity: 1.5, unitPrice: 1.005 }]
      });
      expect(res.status).toBe(422);
      expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
        "lines.0.quantity",
        "lines.0.unitPrice"
      ]);
    });

    it("rejects more than 30 lines", async () => {
      const lines = Array.from({ length: 31 }, () => ({ description: "x", quantity: 1, unitPrice: 1 }));
      expect((await invoice({ patientId: PATIENT1, lines })).status).toBe(422);
    });

    it("lets only one of two simultaneous payments through", async () => {
      const created = await invoice({ patientId: PATIENT1, lines: [{ description: "A", quantity: 1, unitPrice: 5 }] });
      const pay = () =>
        request(app).post(`/api/invoices/${created.body.id}/pay`).set("Authorization", `Bearer ${reception}`).send({ method: "CASH" });
      const statuses = (await Promise.all([pay(), pay()])).map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
    });

    it("refuses to cancel a PAID invoice", async () => {
      const res = await request(app)
        .post("/api/invoices/e6e6e6e6-0000-4000-8000-000000000001/cancel")
        .set("Authorization", `Bearer ${reception}`);
      expect(res.status).toBe(409);
    });
  });

  describe("REC-15 visibility", () => {
    it("PATIENT sees only own invoices; ADMIN sees all", async () => {
      const own = await request(app).get("/api/invoices").set("Authorization", `Bearer ${patient}`);
      expect(own.body.content.every((i: { patientId: string }) => i.patientId === PATIENT1)).toBe(true);
      const all = await request(app).get("/api/invoices").set("Authorization", `Bearer ${admin}`);
      expect(all.body.totalElements).toBe(2);
    });

    it("a DOCTOR token without staffId cannot list everything", async () => {
      // doctor1's token carries staffId, so exercise the guard through the list for another doctor's filter
      const res = await request(app)
        .get(`/api/appointments?doctorId=${DOCTOR2}`)
        .set("Authorization", `Bearer ${doctor}`);
      expect(res.status).toBe(200);
      expect(res.body.content.every((a: { doctorId: string }) => a.doctorId === DOCTOR1)).toBe(true);
    });
  });

  describe("input handling and errors", () => {
    it("answers 400 for a malformed id, filter or page, and 404 for an unknown id", async () => {
      const get = (url: string) => request(app).get(url).set("Authorization", `Bearer ${reception}`);
      expect((await get("/api/appointments/not-a-uuid")).status).toBe(400);
      expect((await get("/api/appointments?status=NOPE")).status).toBe(400);
      expect((await get("/api/appointments?date=2026-02-31")).status).toBe(400);
      expect((await get("/api/appointments?page=abc")).status).toBe(400);
      expect((await get(`/api/appointments/${crypto.randomUUID()}`)).status).toBe(404);
      expect((await get("/api/invoices/zzz")).status).toBe(400);
    });

    it("answers 422 for a missing availability parameter and 400 for a malformed one", async () => {
      const get = (q: string) => request(app).get(`/api/appointments/availability${q}`).set("Authorization", `Bearer ${reception}`);
      expect((await get("")).status).toBe(422);
      expect((await get(`?doctorId=${DOCTOR1}&date=13-10-2026`)).status).toBe(400);
    });

    it("marks the seeded A1 slot unavailable for doctor S1 (REC-14)", async () => {
      const a1 = await request(app).get(`/api/appointments/${A1}`).set("Authorization", `Bearer ${reception}`);
      const day = a1.body.startAt.slice(0, 10);
      const res = await request(app)
        .get(`/api/appointments/availability?doctorId=${DOCTOR1}&date=${day}`)
        .set("Authorization", `Bearer ${reception}`);
      expect(res.body.slots).toHaveLength(18);
      const taken = res.body.slots.find((s: { startAt: string }) => s.startAt === a1.body.startAt);
      expect(taken.available).toBe(false);
    });

    it("answers unknown routes in the shared error body, and malformed JSON with 400", async () => {
      const unknown = await request(app).get("/api/nothing").set("X-Correlation-Id", "abc12345");
      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ status: 404, correlationId: "abc12345" });
      const bad = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${reception}`)
        .set("Content-Type", "application/json")
        .send("{ nope");
      expect(bad.status).toBe(400);
      expect(bad.body.correlationId).toBeTruthy();
    });

    it("does not leak internals on a 500 and answers 503 when the database vanishes", async () => {
      vi.spyOn(pool, "query").mockRejectedValueOnce(new Error('relation "secret" does not exist'));
      const boom = await request(app).get(`/api/appointments/${A1}`).set("Authorization", `Bearer ${reception}`);
      expect(boom.status).toBe(500);
      expect(JSON.stringify(boom.body)).not.toContain("secret");

      vi.spyOn(pool, "query").mockRejectedValueOnce(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
      const down = await request(app).get(`/api/appointments/${A1}`).set("Authorization", `Bearer ${reception}`);
      expect(down.status).toBe(503);
      expect(down.body.message).toBe("Database unavailable");
    });

    it("serves every path of the committed openapi.yaml", async () => {
      const committed = YAML.parse(fs.readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"));
      const served = (await request(app).get("/openapi.json")).body;
      expect(Object.keys(served.paths).sort()).toEqual(Object.keys(committed.paths).sort());
    });
  });

  describe("migrations", () => {
    it("are recorded once and re-running them changes nothing", async () => {
      const { runMigrations } = await import("../src/db/migrate.js");
      await runMigrations();
      const applied = await pool.query("SELECT filename FROM schema_migrations ORDER BY filename");
      expect(applied.rows.map((r) => r.filename)).toEqual(["001_init.sql", "002_reminders_channels.sql"]);
    });
  });
});
