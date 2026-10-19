import amqplib, { Channel, ChannelModel } from "amqplib";
import crypto from "crypto";
import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

let connection: ChannelModel | null = null;
let publishChannel: Channel | null = null;

const EXCHANGE = "sgh.events";
const DLX = "sgh.events.dlx";

export interface EventEnvelope<T = Record<string, unknown>> {
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
      setTimeout(initRabbitMQ, 5000);
    });

    const pChan = await conn.createChannel();
    publishChannel = pChan;
    await pChan.assertExchange(EXCHANGE, "topic", { durable: true });
    await pChan.assertExchange(DLX, "fanout", { durable: true });

    logger.info("RabbitMQ initialized successfully for reception-service");
  } catch (err) {
    logger.warn({ err }, "RabbitMQ init failed, will retry in 5s");
    setTimeout(initRabbitMQ, 5000);
  }
}

export function publishEventAsync<T extends Record<string, unknown>>(
  type: string,
  data: T,
  correlationId: string
): void {
  // Fire-and-forget in background with retries, never blocks HTTP
  setImmediate(async () => {
    const event: EventEnvelope<T> = {
      eventId: crypto.randomUUID(),
      type,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId,
      data
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        if (!publishChannel) {
          throw new Error("Publish channel not available");
        }

        const payload = Buffer.from(JSON.stringify(event));
        const published = publishChannel.publish(EXCHANGE, type, payload, {
          persistent: true,
          contentType: "application/json",
          headers: {
            "x-correlation-id": correlationId
          }
        });

        if (published) {
          logger.info({ eventId: event.eventId, type, correlationId }, "Event published successfully");
          return;
        } else {
          throw new Error("Channel buffer full");
        }
      } catch (err) {
        logger.warn({ err, attempt: attempts, type }, "Failed to publish event, will retry");
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 500));
        } else {
          logger.error({ err, eventId: event.eventId, type }, "Giving up publishing event after 3 attempts");
        }
      }
    }
  });
}
