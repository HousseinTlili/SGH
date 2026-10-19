import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import YAML from "yamljs";
import crypto from "crypto";
import type { Channel, ConsumeMessage } from "amqplib";
import { app } from "../src/app.js";
import { pool, setDatabaseReady } from "../src/db/pool.js";
import { onMessage, pendingEventCount, publishEventAsync } from "../src/events/amqp.js";
import { getToken, setupTestDatabase } from "./helpers.js";

const SEEDED_CONSULTATION = "f7f7f7f7-0000-4000-8000-000000000001";

describe("Input handling", () => {
  let doctor: string;
  let nurse: string;

  beforeAll(async () => {
    await setupTestDatabase();
    doctor = await getToken("doctor1");
    nurse = await getToken("nurse1");
  });

  it("answers 400 for a path id that is not a UUID", async () => {
    const res = await request(app)
      .get("/api/consultations/not-a-uuid")
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 400, error: "Bad Request" });
    expect(res.body.details).toEqual([{ field: "id", problem: "must be a valid UUID" }]);
    expect(res.body.correlationId).toBeTruthy();
  });

  it.each(["prescriptions", "lab-orders", "lab-results"])(
    "answers 400 for a malformed id on /%s",
    async (sub) => {
      const res = await request(app)
        .get(`/api/consultations/123/${sub}`)
        .set("Authorization", `Bearer ${doctor}`);
      expect(res.status).toBe(400);
    }
  );

  it("answers 404 for a well-formed id that does not exist", async () => {
    const res = await request(app)
      .get(`/api/consultations/${crypto.randomUUID()}`)
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(404);
  });

  it("uses the default paging when page and size are absent", async () => {
    const res = await request(app)
      .get("/api/consultations")
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.body).toMatchObject({ page: 0, size: 20 });
  });

  it("answers 400 for a non-numeric page or size", async () => {
    const res = await request(app)
      .get("/api/consultations?page=abc&size=xyz")
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(["page"]);
  });

  it("caps size at 100 and floors page at 0", async () => {
    const res = await request(app)
      .get("/api/consultations?page=-5&size=1000")
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 0, size: 100 });
  });

  it("answers 400 for a malformed filter instead of a database error", async () => {
    const res = await request(app)
      .get("/api/consultations?patientId=oops&status=WHATEVER")
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
      "patientId",
      "status"
    ]);
  });

  it("answers 400 for a malformed vitals filter", async () => {
    const res = await request(app)
      .get("/api/vitals?patientId=oops")
      .set("Authorization", `Bearer ${nurse}`);
    expect(res.status).toBe(400);
  });

  it("answers 422 when vitals reference an unknown consultation", async () => {
    const res = await request(app)
      .post("/api/vitals")
      .set("Authorization", `Bearer ${nurse}`)
      .send({
        patientId: "a1a1a1a1-0000-4000-8000-000000000001",
        consultationId: crypto.randomUUID(),
        heartRate: 70
      });
    expect(res.status).toBe(422);
    expect(res.body.details).toEqual([
      { field: "consultationId", problem: "Consultation not found" }
    ]);
  });

  it("answers 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/vitals")
      .set("Authorization", `Bearer ${nurse}`)
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Malformed JSON body");
    expect(res.body.correlationId).toBeTruthy();
  });

  it("answers an unknown route in the shared error body", async () => {
    const res = await request(app).get("/api/nothing-here").set("X-Correlation-Id", "abc12345");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toMatchObject({
      status: 404,
      error: "Not Found",
      path: "/api/nothing-here",
      correlationId: "abc12345"
    });
  });

  it("serves every path of the committed openapi.yaml", async () => {
    const committed = YAML.parse(
      fs.readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8")
    );
    const served = (await request(app).get("/openapi.json")).body;
    expect(Object.keys(served.paths).sort()).toEqual(Object.keys(committed.paths).sort());
    for (const path of Object.keys(committed.paths)) {
      expect(Object.keys(served.paths[path]).sort()).toEqual(
        Object.keys(committed.paths[path]).sort()
      );
    }
  });

  it("checks the role before validating the body", async () => {
    const res = await request(app)
      .post("/api/consultations")
      .set("Authorization", `Bearer ${nurse}`)
      .send({ nonsense: true });
    expect(res.status).toBe(403);
  });
});

describe("Error handling", () => {
  let doctor: string;

  beforeAll(async () => {
    await setupTestDatabase();
    doctor = await getToken("doctor1");
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not leak internal error messages on a 500", async () => {
    vi.spyOn(pool, "query").mockRejectedValue(new Error('relation "secret_table" does not exist'));
    const res = await request(app)
      .get(`/api/consultations/${SEEDED_CONSULTATION}`)
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    expect(JSON.stringify(res.body)).not.toContain("secret_table");
  });

  it("answers 503 when the database goes away after startup", async () => {
    vi.spyOn(pool, "query").mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" })
    );
    const res = await request(app)
      .get(`/api/consultations/${SEEDED_CONSULTATION}`)
      .set("Authorization", `Bearer ${doctor}`);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Database unavailable");
  });

  it("rejects a token signed by another key", async () => {
    const res = await request(app)
      .get("/api/consultations")
      .set("Authorization", "Bearer eyJhbGciOiJSUzI1NiJ9.e30.invalid");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Missing or invalid token");
  });
});

describe("lab.result.ready consumer", () => {
  let labOrderId: string;

  const fakeChannel = () => ({ ack: vi.fn(), nack: vi.fn() });
  const runMessage = async (body: unknown) => {
    const ch = fakeChannel();
    const msg = asMessage(body);
    await onMessage(ch as unknown as Channel, msg);
    return { ch, msg };
  };
  const asMessage = (body: unknown) =>
    ({ content: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)) }) as ConsumeMessage;

  const envelope = (eventId: string, overrides: Record<string, unknown> = {}) => ({
    eventId,
    type: "lab.result.ready",
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: "test-corr",
    data: {
      labRequestId: labOrderId,
      consultationId: SEEDED_CONSULTATION,
      patientId: "a1a1a1a1-0000-4000-8000-000000000005",
      validatedBy: "b2b2b2b2-0000-4000-8000-000000000004",
      validatedAt: "2026-10-12T10:00:00Z",
      results: [
        { testCode: "K", value: 4.1, unit: "mmol/L", referenceRange: "3.5-5.0", flag: "NORMAL" }
      ],
      ...overrides
    }
  });

  beforeAll(async () => {
    await setupTestDatabase();
    labOrderId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO lab_orders (id, consultation_id, patient_id, doctor_id, priority, status)
       VALUES ($1, $2, 'a1a1a1a1-0000-4000-8000-000000000005', 'b2b2b2b2-0000-4000-8000-000000000002', 'ROUTINE', 'REQUESTED')`,
      [labOrderId, SEEDED_CONSULTATION]
    );
  });

  afterEach(() => setDatabaseReady(true));

  it("stores the result, validates the order and acks", async () => {
    const ch = fakeChannel();
    const msg = asMessage(envelope(crypto.randomUUID()));
    await onMessage(ch as unknown as Channel, msg);

    expect(ch.ack).toHaveBeenCalledWith(msg);
    const order = await pool.query("SELECT status FROM lab_orders WHERE id = $1", [labOrderId]);
    expect(order.rows[0].status).toBe("VALIDATED");
    const copies = await pool.query("SELECT 1 FROM lab_result_copies WHERE lab_request_id = $1", [
      labOrderId
    ]);
    expect(copies.rowCount).toBe(1);
  });

  it("acks a redelivered event without applying it twice (X-5)", async () => {
    const eventId = crypto.randomUUID();
    const first = fakeChannel();
    const second = fakeChannel();
    await onMessage(first as unknown as Channel, asMessage(envelope(eventId)));

    await pool.query("UPDATE lab_orders SET status = 'REQUESTED' WHERE id = $1", [labOrderId]);
    await onMessage(second as unknown as Channel, asMessage(envelope(eventId)));

    expect(second.ack).toHaveBeenCalledOnce();
    const order = await pool.query("SELECT status FROM lab_orders WHERE id = $1", [labOrderId]);
    expect(order.rows[0].status).toBe("REQUESTED"); // the duplicate did not touch it
    const seen = await pool.query("SELECT 1 FROM processed_events WHERE event_id = $1", [eventId]);
    expect(seen.rowCount).toBe(1);
  });

  it.each([
    ["is not JSON", "{{{"],
    ["fails schema validation", envelope(crypto.randomUUID(), { results: [] })]
  ])("dead-letters a message that %s", async (_label, body) => {
    const ch = fakeChannel();
    const msg = asMessage(body);
    await onMessage(ch as unknown as Channel, msg);
    expect(ch.nack).toHaveBeenCalledWith(msg, false, false);
    expect(ch.ack).not.toHaveBeenCalled();
  });

  it("acks a result for an unknown lab order without storing anything (CON-7)", async () => {
    const unknown = crypto.randomUUID();
    const { ch, msg } = await runMessage(envelope(crypto.randomUUID(), { labRequestId: unknown }));
    expect(ch.ack).toHaveBeenCalledWith(msg);
    const copies = await pool.query("SELECT 1 FROM lab_result_copies WHERE lab_request_id = $1", [unknown]);
    expect(copies.rowCount).toBe(0);
  });

  it("takes the consultation from the order, not from the event", async () => {
    const { ch } = await runMessage(envelope(crypto.randomUUID(), { consultationId: crypto.randomUUID() }));
    expect(ch.ack).toHaveBeenCalled();
    const copy = await pool.query("SELECT consultation_id FROM lab_result_copies WHERE lab_request_id = $1", [labOrderId]);
    expect(copy.rows[0].consultation_id).toBe(SEEDED_CONSULTATION);
  });

  it("requeues instead of dead-lettering while the database is not ready", async () => {
    setDatabaseReady(false);
    const ch = fakeChannel();
    const msg = asMessage(envelope(crypto.randomUUID()));
    await onMessage(ch as unknown as Channel, msg);
    expect(ch.nack).toHaveBeenCalledWith(msg, false, true);
  });
});

describe("Event publishing without a broker", () => {
  it("buffers events and never throws or blocks the caller", () => {
    const before = pendingEventCount();
    expect(() => publishEventAsync("prescription.created", { x: 1 }, "corr")).not.toThrow();
    expect(pendingEventCount()).toBe(before + 1);
  });
});

describe("Migrations", () => {
  it("are recorded once and re-running them changes nothing", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    await runMigrations();
    await runMigrations();
    const applied = await pool.query("SELECT filename FROM schema_migrations ORDER BY filename");
    expect(applied.rows.map((r) => r.filename)).toEqual(["001_init.sql"]);
  });
});
