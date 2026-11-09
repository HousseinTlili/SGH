import amqp from 'amqplib';
import { z } from 'zod';
import { config } from './config';
import { pool } from './db';

const EXCHANGE = 'sgh.events';
const DLX = 'sgh.events.dlx';
const DLQ = 'sgh.events.dlq';
const QUEUE = 'notification.appointment.events';
const KEYS = ['appointment.created', 'appointment.cancelled'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class PoisonError extends Error {}

const envelope = z.object({
  eventId: z.string().uuid(),
  type: z.string(),
  version: z.number().optional(),
  occurredAt: z.string(),
  correlationId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

function pick(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function build(type: string, data: Record<string, unknown>) {
  const patient =
    pick(data, ['patientName', 'patientFullName']) ?? (data.patientId ? `patient ${data.patientId}` : 'un patient');
  const when = pick(data, ['scheduledAt', 'startTime', 'startsAt', 'dateTime', 'date']);
  const suffix = when ? ` (${new Date(when).toLocaleString('fr-FR')})` : '';
  if (type === 'appointment.cancelled') {
    return {
      title: 'Rendez-vous annul\u00e9',
      message: `Le rendez-vous de ${patient} a \u00e9t\u00e9 annul\u00e9${suffix}`,
      severity: 'WARNING',
    };
  }
  return {
    title: 'Nouveau rendez-vous',
    message: `Un rendez-vous a \u00e9t\u00e9 programm\u00e9 pour ${patient}${suffix}`,
    severity: 'INFO',
  };
}

async function handle(raw: string): Promise<'created' | 'duplicate'> {
  let env: z.infer<typeof envelope>;
  try {
    env = envelope.parse(JSON.parse(raw));
  } catch {
    throw new PoisonError('Invalid message');
  }
  if (!KEYS.includes(env.type)) throw new PoisonError(`Unexpected event type ${env.type}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [env.eventId, env.type]
    );
    if (r.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'duplicate';
    }
    const n = build(env.type, env.data);
    await client.query(
      'INSERT INTO notifications (type, title, message, severity, payload) VALUES ($1, $2, $3, $4, $5)',
      [env.type, n.title, n.message, n.severity, JSON.stringify(env.data)]
    );
    await client.query('COMMIT');
    return 'created';
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function startConsumer(): Promise<void> {
  for (;;) {
    try {
      const conn = await amqp.connect(config.rabbitUrl);
      conn.on('error', () => {});
      const closed = new Promise<void>((resolve) => conn.on('close', () => resolve()));
      const ch = await conn.createChannel();
      ch.on('error', () => {});

      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      await ch.assertExchange(DLX, 'fanout', { durable: true });
      await ch.assertQueue(DLQ, { durable: true });
      await ch.bindQueue(DLQ, DLX, '');
      await ch.assertQueue(QUEUE, { durable: true, deadLetterExchange: DLX });
      for (const k of KEYS) await ch.bindQueue(QUEUE, EXCHANGE, k);
      await ch.prefetch(10);

      await ch.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const result = await handle(msg.content.toString());
          console.log(`Evenement ${msg.fields.routingKey} : ${result}`);
          ch.ack(msg);
        } catch (e) {
          try {
            if (e instanceof PoisonError) {
              console.log('Message invalide envoye vers la DLQ');
              ch.nack(msg, false, false);
            } else {
              console.log('Erreur temporaire, nouvel essai...');
              await sleep(2000);
              ch.nack(msg, false, true);
            }
          } catch {
            /* canal ferme */
          }
        }
      });

      console.log('Consommateur RabbitMQ pret');
      await closed;
      console.log('Connexion RabbitMQ perdue, reconnexion...');
    } catch {
      console.log('RabbitMQ indisponible, nouvel essai dans 5 s...');
    }
    await sleep(5000);
  }
}
