import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import fs from "node:fs";
import YAML from "yamljs";
import type { Channel, ConsumeMessage } from "amqplib";
import { app } from "../src/app.js";
import { pool, setDatabaseReady } from "../src/db/pool.js";
import { onMessage, publishEventAsync } from "../src/events/amqp.js";
import { getToken, setupTestDatabase } from "./helpers.js";
import { signToken } from "./fake-idp.js";
import { consultation } from "./consultation-stub.js";

vi.mock("../src/events/amqp.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/events/amqp.js")>();
  return { ...real, publishEventAsync: vi.fn(), initRabbitMQ: vi.fn(), closeRabbitMQ: vi.fn() };
});

const R1 = "f8f8f8f8-0000-4000-8000-000000000001";
const D01 = "d4d4d4d4-0000-4000-8000-000000000001"; // Paracetamol, stock 500
const D03 = "d4d4d4d4-0000-4000-8000-000000000003"; // Amoxicillin, stock 55
const D04 = "d4d4d4d4-0000-4000-8000-000000000004";
const D09 = "d4d4d4d4-0000-4000-8000-000000000009"; // Cetirizine

describe("Pharmacy rules", () => {
  let pharmacist: string;
  let doctor: string;
  let admin: string;

  beforeAll(async () => {
    pharmacist = await getToken("pharmacist1");
    doctor = await getToken("doctor1");
    admin = await getToken("admin1");
  });

  beforeEach(async () => {
    await setupTestDatabase();
    consultation.reset();
    vi.mocked(publishEventAsync).mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const dispense = (id: string, lines: object[], token = pharmacist) =>
    request(app).post(`/api/prescriptions/${id}/dispense`).set(as(token)).send({ lines });
  const stockOf = async (drugId: string) =>
    (await pool.query("SELECT stock FROM drugs WHERE id = $1", [drugId])).rows[0].stock as number;

  async function newPrescription(items = 2): Promise<string> {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO prescription_copies (id, consultation_id, patient_id, doctor_id, status)
       VALUES ($1, $2, 'a1a1a1a1-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000001', 'ISSUED')`,
      [id, crypto.randomUUID()]
    );
    for (let i = 0; i < items; i++) {
      await pool.query(
        `INSERT INTO prescription_items (id, prescription_id, item_index, drug_name, dosage, frequency, duration, dispensed)
         VALUES ($1, $2, $3, 'Item', '1', '1 per day', '5 days', false)`,
        [crypto.randomUUID(), id, i]
      );
    }
    return id;
  }

  describe("seed", () => {
    it("matches the fixtures: ten drugs, only Amoxicillin in alerts, R1 issued", async () => {
      const drugs = await request(app).get("/api/drugs?size=100").set(as(pharmacist));
      expect(drugs.body.totalElements).toBe(10);
      const alerts = await request(app).get("/api/stock/alerts").set(as(pharmacist));
      expect(alerts.body.map((d: { name: string }) => d.name)).toEqual(["Amoxicillin"]);
      const issued = await request(app).get("/api/prescriptions?status=ISSUED").set(as(pharmacist));
      expect(issued.body.content.map((p: { id: string }) => p.id)).toEqual([R1]);
    });
  });

  describe("PHA-7 verification against the Consultation service", () => {
    it("forwards the caller's token and correlation id, and dispenses when the prescription is there", async () => {
      consultation.mode = "ok";
      consultation.ids = [R1];
      const res = await dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 15 }]).set("X-Correlation-Id", "corr9876");
      expect(res.status).toBe(200);
      expect(consultation.auth.at(-1)).toBe(`Bearer ${pharmacist}`);
      expect(consultation.correlation.at(-1)).toBe("corr9876");
    });

    it.each(["missing", "not-found"] as const)("answers 409 and changes nothing when Consultation says it is gone (%s)", async (mode) => {
      consultation.mode = mode;
      const res = await dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 15 }]);
      expect(res.status).toBe(409);
      expect(await stockOf(D01)).toBe(500);
      expect(publishEventAsync).not.toHaveBeenCalled();
    });

    it.each(["error", "reset", "hang"] as const)("falls back to the local copy when Consultation fails (%s)", async (mode) => {
      consultation.mode = mode;
      const res = await dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 15 }]);
      expect(res.status).toBe(200);
      expect(await stockOf(D01)).toBe(485);
    });
  });

  describe("dispensing rules", () => {
    it("PHA-5: partial, then complete, then a third attempt is refused", async () => {
      const first = await dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 15 }]);
      expect(first.body.status).toBe("PARTIALLY_DISPENSED");
      const second = await dispense(R1, [{ itemIndex: 1, drugId: D09, quantity: 7 }]);
      expect(second.body.status).toBe("DISPENSED");
      expect(second.body.items.every((i: { dispensed: boolean }) => i.dispensed)).toBe(true);
      expect((await dispense(R1, [{ itemIndex: 1, drugId: D09, quantity: 1 }])).status).toBe(409);
    });

    it("PHA-6: publishes prescription.dispensed with the new status after the commit", async () => {
      await dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 15 }]);
      expect(publishEventAsync).toHaveBeenCalledWith(
        "prescription.dispensed",
        expect.objectContaining({ prescriptionId: R1, status: "PARTIALLY_DISPENSED", pharmacistId: "b2b2b2b2-0000-4000-8000-000000000005" }),
        expect.any(String)
      );
    });

    it("PHA-3/PHA-4: one failing line changes nothing for any line", async () => {
      const res = await dispense(R1, [
        { itemIndex: 0, drugId: D01, quantity: 15 },
        { itemIndex: 1, drugId: D03, quantity: 56 } // Amoxicillin has 55
      ]);
      expect(res.status).toBe(409);
      expect(await stockOf(D01)).toBe(500);
      expect(await stockOf(D03)).toBe(55);
      const after = await request(app).get(`/api/prescriptions/${R1}`).set(as(pharmacist));
      expect(after.body.status).toBe("ISSUED");
      expect(after.body.items.some((i: { dispensed: boolean }) => i.dispensed)).toBe(false);
      expect(publishEventAsync).not.toHaveBeenCalled();
    });

    it("sums the quantities of lines that use the same drug", async () => {
      const rx = await newPrescription(2);
      const res = await dispense(rx, [
        { itemIndex: 0, drugId: D03, quantity: 30 },
        { itemIndex: 1, drugId: D03, quantity: 30 }
      ]);
      expect(res.status).toBe(409);
      expect(await stockOf(D03)).toBe(55);
    });

    it("rejects invalid lines with 422 and leaves the stock alone", async () => {
      const bad = [
        [{ itemIndex: 99, drugId: D01, quantity: 1 }],
        [{ itemIndex: 0, drugId: D01, quantity: 0 }],
        [{ itemIndex: 0, drugId: crypto.randomUUID(), quantity: 1 }],
        [{ itemIndex: 0, drugId: "not-a-uuid", quantity: 1 }],
        [{ itemIndex: 0, drugId: D01, quantity: 1 }, { itemIndex: 0, drugId: D01, quantity: 1 }],
        []
      ];
      for (const lines of bad) expect((await dispense(R1, lines)).status).toBe(422);
      expect(await stockOf(D01)).toBe(500);
    });

    it("refuses a PHARMACIST token without staffId instead of inventing a pharmacist", async () => {
      const anonymous = await signToken("pharmacist1", { withoutStaffId: true });
      const res = await dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 1 }], anonymous);
      expect(res.status).toBe(403);
      expect(await stockOf(D01)).toBe(500);
    });

    it("answers 404 for an unknown prescription and 400 for a malformed id", async () => {
      expect((await dispense(crypto.randomUUID(), [{ itemIndex: 0, drugId: D01, quantity: 1 }])).status).toBe(404);
      expect((await dispense("nope", [{ itemIndex: 0, drugId: D01, quantity: 1 }])).status).toBe(400);
    });

    it("checks the role before the body", async () => {
      const res = await request(app).post(`/api/prescriptions/${R1}/dispense`).set(as(doctor)).send({ nonsense: true });
      expect(res.status).toBe(403);
    });
  });

  describe("concurrency", () => {
    it("dispenses the same item only once when requests race", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => dispense(R1, [{ itemIndex: 0, drugId: D01, quantity: 10 }]))
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409, 409, 409, 409, 409]);
      expect(await stockOf(D01)).toBe(490); // decremented once, not six times
      const history = await request(app).get(`/api/prescriptions/${R1}/dispensings`).set(as(pharmacist));
      expect(history.body).toHaveLength(1);
    });

    it("does not deadlock when two dispensings take the same drugs in opposite order", async () => {
      const a = await newPrescription(2);
      const b = await newPrescription(2);
      const rounds = await Promise.all([
        dispense(a, [{ itemIndex: 0, drugId: D01, quantity: 1 }, { itemIndex: 1, drugId: D04, quantity: 1 }]),
        dispense(b, [{ itemIndex: 0, drugId: D04, quantity: 1 }, { itemIndex: 1, drugId: D01, quantity: 1 }])
      ]);
      expect(rounds.map((r) => r.status)).toEqual([200, 200]);
    });

    it("never oversells: ten parallel dispensings for five units succeed exactly five times", async () => {
      const drugId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO drugs (id, name, form, strength, unit, stock, reorder_threshold)
         VALUES ($1, 'Scarce', 'TABLET', '1 mg', 'tablet', 5, 0)`,
        [drugId]
      );
      const prescriptions = await Promise.all(Array.from({ length: 10 }, () => newPrescription(1)));
      const results = await Promise.all(prescriptions.map((rx) => dispense(rx, [{ itemIndex: 0, drugId, quantity: 1 }])));
      expect(results.filter((r) => r.status === 200)).toHaveLength(5);
      expect(results.filter((r) => r.status === 409)).toHaveLength(5);
      expect(await stockOf(drugId)).toBe(0);
    });

    it("keeps the stock non-negative under concurrent adjustments", async () => {
      const drugId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO drugs (id, name, form, strength, unit, stock, reorder_threshold)
         VALUES ($1, 'Counted', 'TABLET', '1 mg', 'tablet', 5, 0)`,
        [drugId]
      );
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          request(app).post(`/api/drugs/${drugId}/stock`).set(as(pharmacist)).send({ delta: -1, reason: "audit" })
        )
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(5);
      expect(await stockOf(drugId)).toBe(0);
    });

    it("answers 409, never 500, when the same drug is created twice at once", async () => {
      const body = { name: "Racer", form: "TABLET", strength: "5 mg", unit: "tablet", stock: 1, reorderThreshold: 0 };
      const results = await Promise.all(
        Array.from({ length: 6 }, () => request(app).post("/api/drugs").set(as(pharmacist)).send(body))
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    });
  });

  describe("drugs and stock", () => {
    it("increases the stock with a positive delta and refuses to go below zero", async () => {
      const up = await request(app).post(`/api/drugs/${D03}/stock`).set(as(pharmacist)).send({ delta: 10, reason: "delivery" });
      expect(up.body.stock).toBe(65);
      const down = await request(app).post(`/api/drugs/${D03}/stock`).set(as(pharmacist)).send({ delta: -66, reason: "oops" });
      expect(down.status).toBe(409);
      expect(await stockOf(D03)).toBe(65);
    });

    it("validates the stock adjustment", async () => {
      const post = (body: object, id = D03) => request(app).post(`/api/drugs/${id}/stock`).set(as(pharmacist)).send(body);
      expect((await post({ delta: 0, reason: "x" })).status).toBe(422);
      expect((await post({ delta: 1.5, reason: "x" })).status).toBe(422);
      expect((await post({ delta: 1, reason: "" })).status).toBe(422);
      expect((await post({ delta: 1, reason: "y".repeat(201) })).status).toBe(422);
      expect((await post({ delta: 1, reason: "x" }, crypto.randomUUID())).status).toBe(404);
    });

    it("PUT keeps the stock and refuses a duplicate name + strength (case-insensitive)", async () => {
      const put = (id: string, body: object) => request(app).put(`/api/drugs/${id}`).set(as(pharmacist)).send(body);
      const ok = await put(D03, { name: "Amoxicillin", form: "CAPSULE", strength: "500 mg", unit: "capsule", stock: 9999, reorderThreshold: 10 });
      expect(ok.status).toBe(200);
      expect(ok.body.stock).toBe(55);
      const dup = await put(D03, { name: "paracetamol", form: "TABLET", strength: "500 MG", unit: "tablet", stock: 0, reorderThreshold: 1 });
      expect(dup.status).toBe(409);
    });

    it("searches for the text literally, so % and _ are not wildcards", async () => {
      const all = await request(app).get("/api/drugs?search=%25").set(as(pharmacist));
      expect(all.body.totalElements).toBe(0);
      const contains = await request(app).get("/api/drugs?search=CILL").set(as(pharmacist));
      expect(contains.body.content.map((d: { name: string }) => d.name)).toEqual(["Amoxicillin"]);
    });

    it("lists by name with paging", async () => {
      const page = await request(app).get("/api/drugs?size=3&page=1").set(as(admin));
      expect(page.body).toMatchObject({ page: 1, size: 3, totalElements: 10, totalPages: 4 });
      const names = page.body.content.map((d: { name: string }) => d.name);
      expect(names).toEqual([...names].sort());
    });
  });

  describe("PHA-1 prescription.created consumer", () => {
    const channel = () => ({ ack: vi.fn(), nack: vi.fn() });
    const message = (payload: unknown) =>
      ({ content: Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)) }) as ConsumeMessage;
    const event = (overrides: Record<string, unknown> = {}) => ({
      eventId: crypto.randomUUID(),
      type: "prescription.created",
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: "c1",
      data: {
        prescriptionId: crypto.randomUUID(),
        consultationId: crypto.randomUUID(),
        patientId: "a1a1a1a1-0000-4000-8000-000000000001",
        doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
        items: [
          { drugName: "Salbutamol 100 mcg/dose", dosage: "1 puff", frequency: "twice daily", duration: "30 days" },
          { drugName: "Cetirizine 10 mg", dosage: "1 tablet", frequency: "1 per day", duration: "7 days" }
        ],
        ...overrides
      }
    });
    const run = async (payload: unknown) => {
      const ch = channel();
      const msg = message(payload);
      await onMessage(ch as unknown as Channel, msg);
      return { ch, msg };
    };

    it("creates an ISSUED copy with items numbered from 0 and acks", async () => {
      const ev = event();
      const { ch, msg } = await run(ev);
      expect(ch.ack).toHaveBeenCalledWith(msg);
      const rx = await request(app).get(`/api/prescriptions/${ev.data.prescriptionId}`).set(as(pharmacist));
      expect(rx.body.status).toBe("ISSUED");
      expect(rx.body.items.map((i: { index: number; dispensed: boolean }) => [i.index, i.dispensed])).toEqual([[0, false], [1, false]]);
    });

    it("acks a redelivered event and a repeated prescriptionId without a duplicate", async () => {
      const ev = event();
      await run(ev);
      const again = await run(ev);
      expect(again.ch.ack).toHaveBeenCalledOnce();
      const sameRx = await run({ ...ev, eventId: crypto.randomUUID() });
      expect(sameRx.ch.ack).toHaveBeenCalledOnce();
      const copies = await pool.query("SELECT count(*)::int AS n FROM prescription_items WHERE prescription_id = $1", [ev.data.prescriptionId]);
      expect(copies.rows[0].n).toBe(2);
    });

    it("handles two simultaneous deliveries of the same event as one", async () => {
      const ev = event();
      const [a, b] = await Promise.all([run(ev), run(ev)]);
      expect(a.ch.ack).toHaveBeenCalledOnce();
      expect(b.ch.ack).toHaveBeenCalledOnce();
      const n = await pool.query("SELECT count(*)::int AS n FROM prescription_copies WHERE id = $1", [ev.data.prescriptionId]);
      expect(n.rows[0].n).toBe(1);
    });

    it.each([
      ["not JSON", "{{{"],
      ["no items", event({ items: [] })],
      ["bad id", event({ prescriptionId: "nope" })],
      ["missing field", event({ doctorId: undefined })]
    ])("dead-letters a message that is %s", async (_label, payload) => {
      const { ch, msg } = await run(payload);
      expect(ch.nack).toHaveBeenCalledWith(msg, false, false);
      expect(ch.ack).not.toHaveBeenCalled();
    });

    it("requeues instead of dead-lettering while the database is not ready", async () => {
      setDatabaseReady(false);
      const { ch, msg } = await run(event());
      expect(ch.nack).toHaveBeenCalledWith(msg, false, true);
      setDatabaseReady(true);
    });

    it("requeues when the database drops out in the middle", async () => {
      vi.spyOn(pool, "connect").mockRejectedValueOnce(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
      const { ch, msg } = await run(event());
      expect(ch.nack).toHaveBeenCalledWith(msg, false, true);
    });
  });

  describe("input handling and errors", () => {
    it("answers 400 for malformed ids, filters and paging, 404 for unknown resources", async () => {
      const get = (url: string) => request(app).get(url).set(as(pharmacist));
      expect((await get("/api/prescriptions/not-a-uuid")).status).toBe(400);
      expect((await get("/api/prescriptions?status=NOPE")).status).toBe(400);
      expect((await get("/api/prescriptions?patientId=zzz")).status).toBe(400);
      expect((await get("/api/drugs?page=abc")).status).toBe(400);
      expect((await get(`/api/prescriptions/${crypto.randomUUID()}`)).status).toBe(404);
      expect((await get(`/api/prescriptions/${crypto.randomUUID()}/dispensings`)).status).toBe(404);
    });

    it("accepts a list of statuses (D31)", async () => {
      const res = await request(app).get("/api/prescriptions?status=ISSUED,PARTIALLY_DISPENSED").set(as(pharmacist));
      expect(res.status).toBe(200);
      expect(res.body.totalElements).toBe(1);
    });

    it("answers unknown routes in the shared error body and malformed JSON with 400", async () => {
      const unknown = await request(app).get("/api/nothing").set("X-Correlation-Id", "abc12345");
      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ status: 404, correlationId: "abc12345" });
      const bad = await request(app).post("/api/drugs").set(as(pharmacist)).set("Content-Type", "application/json").send("{ nope");
      expect(bad.status).toBe(400);
      expect(bad.body.correlationId).toBeTruthy();
    });

    it("does not leak internals on a 500 and answers 503 when the database vanishes", async () => {
      vi.spyOn(pool, "query").mockRejectedValueOnce(new Error('relation "secret" does not exist'));
      const boom = await request(app).get("/api/drugs").set(as(pharmacist));
      expect(boom.status).toBe(500);
      expect(JSON.stringify(boom.body)).not.toContain("secret");

      vi.spyOn(pool, "query").mockRejectedValueOnce(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
      const down = await request(app).get("/api/drugs").set(as(pharmacist));
      expect(down.status).toBe(503);
      expect(down.body.message).toBe("Database unavailable");
    });

    it("serves every path of the committed openapi.yaml", async () => {
      const committed = YAML.parse(fs.readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"));
      const served = (await request(app).get("/openapi.json")).body;
      expect(Object.keys(served.paths).sort()).toEqual(Object.keys(committed.paths).sort());
    });

    it("records the migration once", async () => {
      const { runMigrations } = await import("../src/db/migrate.js");
      await runMigrations();
      const applied = await pool.query("SELECT filename FROM schema_migrations ORDER BY filename");
      expect(applied.rows.map((r) => r.filename)).toEqual(["001_init.sql"]);
    });
  });
});
