import amqplib, { ChannelModel, ConfirmChannel } from "amqplib";
import crypto from "crypto";
import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

const EXCHANGE = "sgh.events";
const DLX = "sgh.events.dlx";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_PENDING_EVENTS = 1000;

type PublishedType = "appointment.created" | "appointment.cancelled";

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
