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
const QUEUE = "pharmacy.prescription.created";

interface EventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  data: T;
}

interface PrescriptionItemData {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface PrescriptionCreatedData {
  prescriptionId: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  items: PrescriptionItemData[];
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
    await cChan.bindQueue(QUEUE, EXCHANGE, "prescription.created");

    await startConsumer(cChan);

    logger.info("RabbitMQ initialized successfully in pharmacy-service");
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

        if (event.type === "prescription.created" && event.data) {
          await handlePrescriptionCreated(event);
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

export async function handlePrescriptionCreated(event: EventEnvelope): Promise<void> {
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

    const data = event.data as unknown as PrescriptionCreatedData;

    // Save copy of prescription
    await client.query(
      `INSERT INTO prescription_copies (id, consultation_id, patient_id, doctor_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ISSUED', $5, $5)
       ON CONFLICT (id) DO NOTHING`,
      [
        data.prescriptionId,
        data.consultationId,
        data.patientId,
        data.doctorId,
        event.occurredAt || new Date().toISOString()
      ]
    );

    // Save items
    if (Array.isArray(data.items)) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        await client.query(
          `INSERT INTO prescription_items (id, prescription_id, item_index, drug_name, dosage, frequency, duration, dispensed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false)
           ON CONFLICT (prescription_id, item_index) DO NOTHING`,
          [
            crypto.randomUUID(),
            data.prescriptionId,
            i,
            item.drugName,
            item.dosage,
            item.frequency,
            item.duration
          ]
        );
      }
    }

    // Mark event processed
    await client.query(
      "INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [event.eventId, event.type]
    );

    await client.query("COMMIT");
    logger.info(
      { prescriptionId: data.prescriptionId, consultationId: data.consultationId },
      "Prescription copy saved successfully from prescription.created event"
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface PrescriptionDispensedData {
  prescriptionId: string;
  pharmacistId: string;
  status: "PARTIALLY_DISPENSED" | "DISPENSED";
  dispensedAt: string;
}

/**
 * Publishes prescription.dispensed event to sgh.events exchange in background with retry.
 * Never throws or blocks the caller HTTP request.
 */
export function publishPrescriptionDispensedAsync(
  data: PrescriptionDispensedData,
  correlationId: string
): void {
  const envelope: EventEnvelope<PrescriptionDispensedData> = {
    eventId: crypto.randomUUID(),
    type: "prescription.dispensed",
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

        publishChannel.publish(EXCHANGE, "prescription.dispensed", payload, {
          persistent: true,
          contentType: "application/json"
        });

        logger.info(
          {
            type: "prescription.dispensed",
            eventId: envelope.eventId,
            prescriptionId: data.prescriptionId,
            correlationId
          },
          "prescription.dispensed event published successfully"
        );
        return;
      } catch (err) {
        logger.warn(
          { attempt, type: "prescription.dispensed", err },
          `Publish attempt ${attempt} failed, retrying in ${delay}ms`
        );
        if (attempt === maxRetries) {
          logger.error(
            { err, type: "prescription.dispensed", eventId: envelope.eventId },
            "Failed to publish prescription.dispensed after 3 attempts"
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  });
}
