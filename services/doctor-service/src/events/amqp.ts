import amqplib, { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";
import crypto from "crypto";
import { z } from "zod";
import { config } from "../config/index.js";
import { getDatabaseReady, withTransaction } from "../db/pool.js";
import { logger } from "../middleware/logger.js";

const EXCHANGE = "sgh.events";
const DLX = "sgh.events.dlx";
const QUEUE = "consultation.lab.result.ready";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_PENDING_EVENTS = 1000;

type PublishedType = "lab.request.created" | "prescription.created";

interface EventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  data: T;
}

let connection: ChannelModel | null = null;
let publishChannel: ConfirmChannel | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let stopping = false;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/** Connects in the background. Never throws: the service must boot with the broker down (X-6). */
export async function initRabbitMQ(): Promise<void> {
  if (stopping || connection) return;

  try {
    const conn = await amqplib.connect(config.rabbitmqUrl);
    connection = conn;

    conn.on("error", (err) => logger.error({ err }, "RabbitMQ connection error"));
    conn.on("close", () => {
      if (connection !== conn) return;
      logger.warn("RabbitMQ connection closed");
      connection = null;
      publishChannel = null;
      scheduleReconnect();
    });

    const pub = await conn.createConfirmChannel();
    pub.on("error", (err) => logger.error({ err }, "RabbitMQ publish channel error"));
    pub.on("close", () => {
      if (publishChannel === pub) publishChannel = null;
    });
    await pub.assertExchange(EXCHANGE, "topic", { durable: true });
    await pub.assertExchange(DLX, "fanout", { durable: true });
    publishChannel = pub;

    const sub = await conn.createChannel();
    sub.on("error", (err) => logger.error({ err }, "RabbitMQ consumer channel error"));
    await sub.prefetch(10);
    await sub.assertQueue(QUEUE, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX }
    });
    await sub.bindQueue(QUEUE, EXCHANGE, "lab.result.ready");
    await sub.consume(QUEUE, (msg) => void onMessage(sub, msg), { noAck: false });

    reconnectDelay = RECONNECT_BASE_MS;
    logger.info("RabbitMQ initialized successfully");
    void flushPending();
  } catch (err) {
    logger.warn({ err }, `RabbitMQ init failed, retrying in ${reconnectDelay / 1000}s`);
    // Drop a half-open connection so the retry starts from a clean state.
    const conn = connection as ChannelModel | null;
    connection = null;
    publishChannel = null;
    await conn?.close().catch(() => undefined);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (stopping || reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void initRabbitMQ();
  }, delay);
  reconnectTimer.unref();
}

/** Stops reconnecting and closes the broker connection (graceful shutdown). */
export async function closeRabbitMQ(): Promise<void> {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const conn = connection;
  connection = null;
  publishChannel = null;
  await conn?.close().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Consuming lab.result.ready
// ---------------------------------------------------------------------------

const LabResultDataSchema = z.object({
  labRequestId: z.string().uuid(),
  consultationId: z.string().uuid(),
  patientId: z.string().uuid(),
  validatedBy: z.string().uuid(),
  validatedAt: z.string().datetime({ offset: true }),
  results: z
    .array(
      z.object({
        testCode: z.string(),
        value: z.number(),
        unit: z.string(),
        referenceRange: z.string(),
        flag: z.enum(["NORMAL", "HIGH", "LOW", "CRITICAL"])
      })
    )
    .min(1)
});

const EnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  type: z.string(),
  version: z.number().int(),
  occurredAt: z.string(),
  correlationId: z.string(),
  data: z.record(z.unknown())
});

/** Failures that say nothing about the message itself: retrying later can succeed. */
function isTransient(err: any): boolean {
  const code: string = err?.code ?? "";
  return (
    err instanceof NotReadyError ||
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(code) ||
    /^(08|53|57)/.test(code) ||
    /timeout exceeded when trying to connect|Connection terminated/i.test(err?.message ?? "")
  );
}

class NotReadyError extends Error {}

export async function onMessage(
  channel: import("amqplib").Channel,
  msg: ConsumeMessage | null
): Promise<void> {
  if (!msg) return; // consumer cancelled by the broker

  try {
    if (!getDatabaseReady()) throw new NotReadyError("database not ready");

    const envelope = EnvelopeSchema.parse(JSON.parse(msg.content.toString()));
    if (envelope.type === "lab.result.ready") {
      await handleLabResultReady(envelope, LabResultDataSchema.parse(envelope.data));
    } else {
      logger.warn({ type: envelope.type }, "Ignoring unexpected event type on lab result queue");
    }
    channel.ack(msg);
  } catch (err) {
    if (isTransient(err)) {
      // Keep the message: dead-lettering it would lose a valid result because of an outage.
      logger.warn({ err }, "Transient failure handling event, requeueing");
      await sleep(config.amqpRequeueDelayMs);
      safely(() => channel.nack(msg, false, true));
    } else {
      logger.error({ err }, "Unprocessable event, sending to the dead-letter queue");
      safely(() => channel.nack(msg, false, false));
    }
  }
}

/** The channel may already be closed when a retry wakes up; the broker redelivers in that case. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    logger.warn({ err }, "Could not settle message, the broker will redeliver it");
  }
}

async function handleLabResultReady(
  event: EventEnvelope,
  data: z.infer<typeof LabResultDataSchema>
): Promise<void> {
  await withTransaction(async (client) => {
    // Insert first and let the primary key arbitrate, so two deliveries of the same event
    // racing each other cannot both apply it (X-5).
    const claimed = await client.query(
      `INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING event_id`,
      [event.eventId, event.type]
    );
    if (claimed.rowCount === 0) {
      logger.info({ eventId: event.eventId }, "Event already processed, skipping");
      return;
    }

    await client.query(
      `INSERT INTO lab_result_copies (
         lab_request_id, consultation_id, patient_id, validated_by, validated_at, results
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (lab_request_id) DO UPDATE SET
         validated_by = EXCLUDED.validated_by,
         validated_at = EXCLUDED.validated_at,
         results = EXCLUDED.results`,
      [
        data.labRequestId,
        data.consultationId,
        data.patientId,
        data.validatedBy,
        data.validatedAt,
        JSON.stringify(data.results)
      ]
    );
    await client.query("UPDATE lab_orders SET status = 'VALIDATED' WHERE id = $1", [
      data.labRequestId
    ]);

    logger.info(
      {
        eventId: event.eventId,
        correlationId: event.correlationId,
        labRequestId: data.labRequestId,
        consultationId: data.consultationId
      },
      "Saved lab result copy and marked order VALIDATED"
    );
  });
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

const pending: EventEnvelope[] = [];
let flushing = false;

/**
 * Queues an event for publication and returns immediately; the HTTP request never waits on
 * the broker. Events are delivered with publisher confirms and retried with exponential
 * backoff for as long as the process lives. They are kept in memory only, so they are lost
 * if the process stops while the broker is unreachable (a transactional outbox would close
 * that gap in production).
 */
export function publishEventAsync(
  type: PublishedType,
  data: Record<string, unknown>,
  correlationId: string
): void {
  if (pending.length >= MAX_PENDING_EVENTS) {
    const dropped = pending.shift()!;
    logger.error({ eventId: dropped.eventId, type: dropped.type }, "Event buffer full, dropped oldest event");
  }
  pending.push({
    eventId: crypto.randomUUID(),
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId,
    data
  });
  setImmediate(() => void flushPending());
}

function publishConfirmed(channel: ConfirmChannel, envelope: EventEnvelope): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.publish(
      EXCHANGE,
      envelope.type,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true, contentType: "application/json", messageId: envelope.eventId },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

async function flushPending(): Promise<void> {
  if (flushing) return;
  flushing = true;
  let delay = RECONNECT_BASE_MS;

  try {
    while (pending.length > 0 && !stopping) {
      const channel = publishChannel;
      if (!channel) {
        // The reconnect loop calls flushPending again once the broker is back.
        return;
      }

      const envelope = pending[0];
      try {
        await publishConfirmed(channel, envelope);
        pending.shift();
        delay = RECONNECT_BASE_MS;
        logger.info(
          { type: envelope.type, eventId: envelope.eventId, correlationId: envelope.correlationId },
          "Event published"
        );
      } catch (err) {
        logger.warn({ err, type: envelope.type, eventId: envelope.eventId }, `Publish failed, retrying in ${delay}ms`);
        await sleep(delay);
        delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      }
    }
  } finally {
    flushing = false;
  }
}

export function pendingEventCount(): number {
  return pending.length;
}
