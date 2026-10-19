import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import fs from "node:fs";
import crypto from "node:crypto";
import request from "supertest";
import amqplib, { Channel, ChannelModel } from "amqplib";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { app } from "../src/app.js";
import { config } from "../src/config/index.js";
import { pool } from "../src/db/pool.js";
import { closeRabbitMQ, initRabbitMQ } from "../src/events/amqp.js";
import { getToken, setupTestDatabase } from "./helpers.js";

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

const schema = (name: string) =>
  JSON.parse(fs.readFileSync(new URL(`../../../contracts/events/${name}`, import.meta.url), "utf8"));

async function waitFor<T>(probe: () => Promise<T | null | false | undefined>, ms = 8000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out waiting for condition");
}

describe.skipIf(!brokerUp)("RabbitMQ integration: prescription.created in, prescription.dispensed out", () => {
  let conn: ChannelModel;
  let ch: Channel;
  let listener: string;
  let pharmacist: string;

  beforeAll(async () => {
    await setupTestDatabase();
    pharmacist = await getToken("pharmacist1");
    conn = await amqplib.connect(config.rabbitmqUrl);
    ch = await conn.createChannel();
    listener = (await ch.assertQueue("", { exclusive: true })).queue;
    await ch.bindQueue(listener, "sgh.events", "prescription.dispensed");
    await ch.purgeQueue("sgh.events.dlq");
    await initRabbitMQ();
  });

  afterAll(async () => {
    await closeRabbitMQ();
    await ch?.close();
    await conn?.close();
    await pool.end();
  });

  it("stores the copy, dispenses it, and emits a contract-conformant event", async () => {
    const prescriptionId = crypto.randomUUID();
    const created = {
      eventId: crypto.randomUUID(),
      type: "prescription.created",
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: "corr-broker",
      data: {
        prescriptionId,
        consultationId: crypto.randomUUID(),
        patientId: "a1a1a1a1-0000-4000-8000-000000000001",
        doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
        items: [{ drugName: "Paracetamol 500 mg", dosage: "1 tablet", frequency: "3 per day", duration: "5 days" }]
      }
    };
    // twice: the redelivery must not create a second copy
    for (let i = 0; i < 2; i++) {
      ch.publish("sgh.events", "prescription.created", Buffer.from(JSON.stringify(created)), { persistent: true });
    }

    const copy = await waitFor(async () => {
      const res = await request(app).get(`/api/prescriptions/${prescriptionId}`).set("Authorization", `Bearer ${pharmacist}`);
      return res.status === 200 ? res.body : null;
    });
    expect(copy.status).toBe("ISSUED");
    await new Promise((r) => setTimeout(r, 300));
    expect((await pool.query("SELECT count(*)::int AS n FROM prescription_items WHERE prescription_id = $1", [prescriptionId])).rows[0].n).toBe(1);

    const dispensed = await request(app)
      .post(`/api/prescriptions/${prescriptionId}/dispense`)
      .set("Authorization", `Bearer ${pharmacist}`)
      .set("X-Correlation-Id", "corr-dispense")
      .send({ lines: [{ itemIndex: 0, drugId: "d4d4d4d4-0000-4000-8000-000000000001", quantity: 15 }] });
    expect(dispensed.status).toBe(200);

    const event = await waitFor(async () => {
      const msg = await ch.get(listener, { noAck: true });
      return msg ? JSON.parse(msg.content.toString()) : null;
    });
    const ajv = new Ajv2020({ strict: false });
    addFormats(ajv);
    const envelope = ajv.compile(schema("envelope.schema.json"));
    const data = ajv.compile(schema("prescription.dispensed.data.schema.json"));
    expect(envelope(event), JSON.stringify(envelope.errors)).toBe(true);
    expect(data(event.data), JSON.stringify(data.errors)).toBe(true);
    expect(event).toMatchObject({ type: "prescription.dispensed", correlationId: "corr-dispense" });
    expect(event.data).toMatchObject({ prescriptionId, status: "DISPENSED" });
  });

  it("dead-letters a message nobody can process", async () => {
    ch.publish("sgh.events", "prescription.created", Buffer.from("this is not json"));
    const dead = await waitFor(async () => {
      const msg = await ch.get("sgh.events.dlq", { noAck: true });
      return msg ? msg.content.toString() : null;
    });
    expect(dead).toBe("this is not json");
  });
});
