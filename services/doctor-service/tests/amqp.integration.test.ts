import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import fs from "node:fs";
import crypto from "node:crypto";
import amqplib, { Channel, ChannelModel } from "amqplib";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { config } from "../src/config/index.js";
import { pool } from "../src/db/pool.js";
import {
  closeRabbitMQ,
  initRabbitMQ,
  pendingEventCount,
  publishEventAsync
} from "../src/events/amqp.js";
import { setupTestDatabase } from "./helpers.js";

// ajv-formats ships CommonJS with a default export; unwrap it under NodeNext.
const addFormats = (addFormatsModule as unknown as { default: (instance: Ajv2020) => void }).default;

// Needs the broker from infra/docker-compose.yml (definitions.json loaded); skipped when absent.
const brokerUp = await new Promise<boolean>((resolve) => {
  const { hostname, port } = new URL(config.rabbitmqUrl);
  const socket = net.connect(Number(port) || 5672, hostname, () => {
    socket.destroy();
    resolve(true);
  });
  socket.on("error", () => resolve(false));
});

const CONSULTATION = "f7f7f7f7-0000-4000-8000-000000000001";
const PATIENT = "a1a1a1a1-0000-4000-8000-000000000005";
const DOCTOR = "b2b2b2b2-0000-4000-8000-000000000002";

const schema = (name: string) =>
  JSON.parse(fs.readFileSync(new URL(`../../../contracts/events/${name}`, import.meta.url), "utf8"));

async function waitFor<T>(probe: () => Promise<T | null | false>, ms = 8000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out waiting for condition");
}

describe.skipIf(!brokerUp)("RabbitMQ integration (contracts, confirms, consumer)", () => {
  let conn: ChannelModel;
  let ch: Channel;
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);

  // The real lab and pharmacy services may be running and consuming the shared queues, so the test
  // listens on throwaway queues bound to the same exchange instead.
  let labListener: string;
  let rxListener: string;

  const drain = async (queue: string) => {
    const messages: any[] = [];
    for (;;) {
      const msg = await ch.get(queue, { noAck: true });
      if (!msg) return messages;
      messages.push(JSON.parse(msg.content.toString()));
    }
  };

  beforeAll(async () => {
    await setupTestDatabase();
    conn = await amqplib.connect(config.rabbitmqUrl);
    ch = await conn.createChannel();
    labListener = (await ch.assertQueue("", { exclusive: true })).queue;
    rxListener = (await ch.assertQueue("", { exclusive: true })).queue;
    await ch.bindQueue(labListener, "sgh.events", "lab.request.created");
    await ch.bindQueue(rxListener, "sgh.events", "prescription.created");
  });

  afterAll(async () => {
    await closeRabbitMQ();
    await ch?.close();
    await conn?.close();
    await pool.end();
  });

  it("delivers events queued before the broker connection exists, matching the contracts", async () => {
    // Nothing is connected yet: this is the "broker down at boot" situation.
    const labRequestId = crypto.randomUUID();
    const prescriptionId = crypto.randomUUID();
    publishEventAsync(
      "lab.request.created",
      {
        labRequestId,
        consultationId: CONSULTATION,
        patientId: PATIENT,
        doctorId: DOCTOR,
        priority: "URGENT",
        tests: [{ code: "K", name: "Potassium" }]
      },
      "corr-lab"
    );
    publishEventAsync(
      "prescription.created",
      {
        prescriptionId,
        consultationId: CONSULTATION,
        patientId: PATIENT,
        doctorId: DOCTOR,
        items: [{ drugName: "Paracetamol 500 mg", dosage: "1 tablet", frequency: "3 per day", duration: "5 days" }]
      },
      "corr-rx"
    );
    expect(pendingEventCount()).toBe(2);

    await initRabbitMQ();

    const lab = await waitFor(async () => (await drain(labListener))[0]);
    const rx = await waitFor(async () => (await drain(rxListener))[0]);
    expect(pendingEventCount()).toBe(0);

    const validateEnvelope = ajv.compile(schema("envelope.schema.json"));
    const validateLab = ajv.compile(schema("lab.request.created.data.schema.json"));
    const validateRx = ajv.compile(schema("prescription.created.data.schema.json"));

    expect(validateEnvelope(lab), JSON.stringify(validateEnvelope.errors)).toBe(true);
    expect(validateLab(lab.data), JSON.stringify(validateLab.errors)).toBe(true);
    expect(lab).toMatchObject({ type: "lab.request.created", version: 1, correlationId: "corr-lab" });
    expect(validateEnvelope(rx), JSON.stringify(validateEnvelope.errors)).toBe(true);
    expect(validateRx(rx.data), JSON.stringify(validateRx.errors)).toBe(true);
  });

  it("consumes a lab.result.ready event published by the lab service", async (ctx) => {
    // A running doctor-service would take the message instead of this process.
    const { consumerCount } = await ch.checkQueue("consultation.lab.result.ready");
    if (consumerCount > 1) ctx.skip(); // 1 = this test's own consumer
    const labRequestId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO lab_orders (id, consultation_id, patient_id, doctor_id, priority, status)
       VALUES ($1, $2, $3, $4, 'ROUTINE', 'REQUESTED')`,
      [labRequestId, CONSULTATION, PATIENT, DOCTOR]
    );

    const envelope = {
      eventId: crypto.randomUUID(),
      type: "lab.result.ready",
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: "corr-result",
      data: {
        labRequestId,
        consultationId: CONSULTATION,
        patientId: PATIENT,
        validatedBy: "b2b2b2b2-0000-4000-8000-000000000004",
        validatedAt: new Date().toISOString(),
        results: [{ testCode: "K", value: 4.2, unit: "mmol/L", referenceRange: "3.5-5.0", flag: "NORMAL" }]
      }
    };
    const validateData = ajv.compile(schema("lab.result.ready.data.schema.json"));
    expect(validateData(envelope.data), JSON.stringify(validateData.errors)).toBe(true);

    // Publish twice to prove idempotency end to end.
    for (let i = 0; i < 2; i++) {
      ch.publish("sgh.events", "lab.result.ready", Buffer.from(JSON.stringify(envelope)), {
        persistent: true
      });
    }

    await waitFor(async () => {
      const r = await pool.query("SELECT status FROM lab_orders WHERE id = $1", [labRequestId]);
      return r.rows[0]?.status === "VALIDATED";
    });
    const copies = await pool.query(
      "SELECT 1 FROM lab_result_copies WHERE lab_request_id = $1",
      [labRequestId]
    );
    expect(copies.rowCount).toBe(1);
    const processed = await pool.query("SELECT 1 FROM processed_events WHERE event_id = $1", [
      envelope.eventId
    ]);
    expect(processed.rowCount).toBe(1);
  });

  it("dead-letters a poison message to sgh.events.dlq", async () => {
    await ch.purgeQueue("sgh.events.dlq");
    ch.publish("sgh.events", "lab.result.ready", Buffer.from("this is not json"));
    const dead = await waitFor(async () => {
      const msg = await ch.get("sgh.events.dlq", { noAck: true });
      return msg ? msg.content.toString() : null;
    });
    expect(dead).toBe("this is not json");
  });
});
