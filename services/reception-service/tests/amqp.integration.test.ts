import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import fs from "node:fs";
import crypto from "node:crypto";
import amqplib, { Channel, ChannelModel } from "amqplib";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { config } from "../src/config/index.js";
import { closeRabbitMQ, initRabbitMQ, pendingEventCount, publishEventAsync } from "../src/events/amqp.js";

// ajv-formats ships CommonJS with a default export; unwrap it under NodeNext.
const addFormats = (addFormatsModule as unknown as { default: (instance: Ajv2020) => void }).default;

// Needs the broker from infra/docker-compose.yml; skipped when absent.
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

describe.skipIf(!brokerUp)("RabbitMQ integration: appointment events", () => {
  let conn: ChannelModel;
  let ch: Channel;
  let queue: string;

  beforeAll(async () => {
    conn = await amqplib.connect(config.rabbitmqUrl);
    ch = await conn.createChannel();
    await ch.assertExchange("sgh.events", "topic", { durable: true });
    // Nothing consumes appointment.* yet, so listen with a throwaway queue.
    queue = (await ch.assertQueue("", { exclusive: true })).queue;
    await ch.bindQueue(queue, "sgh.events", "appointment.*");
  });

  afterAll(async () => {
    await closeRabbitMQ();
    await ch?.close();
    await conn?.close();
  });

  it("delivers events queued before the connection exists, matching the contracts", async () => {
    const data = {
      appointmentId: crypto.randomUUID(),
      patientId: "a1a1a1a1-0000-4000-8000-000000000001",
      doctorId: "b2b2b2b2-0000-4000-8000-000000000001",
      startAt: "2026-10-20T09:00:00.000Z",
      endAt: "2026-10-20T09:30:00.000Z"
    };
    publishEventAsync("appointment.created", data, "corr-created");
    publishEventAsync("appointment.cancelled", data, "corr-cancelled");
    expect(pendingEventCount()).toBe(2);

    await initRabbitMQ();

    const received: any[] = [];
    await waitFor(async () => {
      const msg = await ch.get(queue, { noAck: true });
      if (msg) received.push({ key: msg.fields.routingKey, body: JSON.parse(msg.content.toString()) });
      return received.length === 2;
    });
    expect(pendingEventCount()).toBe(0);

    const ajv = new Ajv2020({ strict: false });
    addFormats(ajv);
    const envelope = ajv.compile(schema("envelope.schema.json"));
    const validators: Record<string, ReturnType<typeof ajv.compile>> = {
      "appointment.created": ajv.compile(schema("appointment.created.data.schema.json")),
      "appointment.cancelled": ajv.compile(schema("appointment.cancelled.data.schema.json"))
    };

    for (const { key, body } of received) {
      expect(body.type).toBe(key);
      expect(envelope(body), JSON.stringify(envelope.errors)).toBe(true);
      expect(validators[key](body.data), JSON.stringify(validators[key].errors)).toBe(true);
    }
    expect(received.map((r) => r.body.correlationId).sort()).toEqual(["corr-cancelled", "corr-created"]);
  });
});
