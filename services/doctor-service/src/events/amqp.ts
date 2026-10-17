import amqplib, { Channel, ChannelModel } from "amqplib";
import crypto from "crypto";
import { config } from "../config/index.js";
import { pool } from "../db/pool.js";
import { logger } from "../middleware/logger.js";

let connection: ChannelModel | null = null;
let publishChannel: Channel | null = null;
let consumerChannel: Channel | null = null;

const EXCHANGE = "sgh.events";
const DLX = "sgh.events.dlx";
const QUEUE = "consultation.lab.result.ready";

interface EventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  data: T;
}

export async function initRabbitMQ(): Promise<void> {
  try {
    const conn = await amqplib.connect(config.rabbitmqUrl);
    connection = conn;

    conn.on("error", (err) => {
      logger.error({ err }, "RabbitMQ connection error");
    });

    conn.on("close", () => {
      logger.warn("RabbitMQ connection closed, scheduling reconnect...");
      connection = null;
      publishChannel = null;
      consumerChannel = null;
      setTimeout(initRabbitMQ, 5000);
    });

    const pChan = await conn.createChannel();
    publishChannel = pChan;
    await pChan.assertExchange(EXCHANGE, "topic", { durable: true });
    await pChan.assertExchange(DLX, "fanout", { durable: true });

    const cChan = await conn.createChannel();
    consumerChannel = cChan;
    await cChan.prefetch(10);

    await cChan.assertQueue(QUEUE, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX }
    });
    await cChan.bindQueue(QUEUE, EXCHANGE, "lab.result.ready");

    await startConsumer(cChan);

    logger.info("RabbitMQ initialized successfully");
  } catch (err) {
    logger.warn({ err }, "RabbitMQ init failed, will retry in 5s");
    setTimeout(initRabbitMQ, 5000);
  }
}

async function startConsumer(channel: Channel): Promise<void> {
  await channel.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;

      try {
        const content = msg.content.toString();
        const event: EventEnvelope = JSON.parse(content);

        if (event.type === "lab.result.ready" && event.data) {
          await handleLabResultReady(event);
        }

        channel.ack(msg);
      } catch (err) {
        logger.error({ err }, "Failed to process event from queue");
        // Nack without requeue sends to dead-letter exchange
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );
}

interface LabResultData {
  labRequestId: string;
  consultationId: string;
  patientId: string;
  validatedBy: string;
  validatedAt: string;
  results: Array<{
    testCode: string;
    value: number;
    unit: string;
    referenceRange: string;
    flag: "NORMAL" | "HIGH" | "LOW" | "CRITICAL";
  }>;
}

async function handleLabResultReady(event: EventEnvelope): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check processed_events for idempotency (X-5)
    const processedRes = await client.query(
      "SELECT event_id FROM processed_events WHERE event_id = $1",
      [event.eventId]
    );

    if (processedRes.rowCount && processedRes.rowCount > 0) {
      logger.info({ eventId: event.eventId }, "Event already processed, skipping");
      await client.query("COMMIT");
      return;
    }

    const data = event.data as unknown as LabResultData;

    // Save copy of lab results
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

    // Update lab order status to VALIDATED
    await client.query(
      "UPDATE lab_orders SET status = 'VALIDATED' WHERE id = $1",
      [data.labRequestId]
    );

    // Mark event processed
    await client.query(
      "INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [event.eventId, event.type]
    );

    await client.query("COMMIT");
    logger.info(
      { labRequestId: data.labRequestId, consultationId: data.consultationId },
      "Saved lab result copy and updated order to VALIDATED"
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Publishes an event to sgh.events exchange in background with retry.
 * Never throws or blocks the caller HTTP request.
 */
export function publishEventAsync(
  type: "lab.request.created" | "prescription.created",
  data: Record<string, unknown>,
  correlationId: string
): void {
  const envelope: EventEnvelope = {
    eventId: crypto.randomUUID(),
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId,
    data
  };

  setImmediate(async () => {
    const payload = Buffer.from(JSON.stringify(envelope));
    const maxRetries = 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!publishChannel) {
          throw new Error("Publish channel not connected");
        }

        publishChannel.publish(EXCHANGE, type, payload, {
          persistent: true,
          contentType: "application/json"
        });

        logger.info(
          { type, eventId: envelope.eventId, correlationId },
          "Event published successfully"
        );
        return;
      } catch (err) {
        logger.warn(
          { attempt, type, err },
          `Publish attempt ${attempt} failed, retrying in ${delay}ms`
        );
        if (attempt === maxRetries) {
          logger.error(
            { err, type, eventId: envelope.eventId },
            "Failed to publish event after 3 attempts"
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  });
}
