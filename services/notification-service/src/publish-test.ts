import amqp from 'amqplib';
import { randomUUID } from 'crypto';
import { config } from './config';

const type = process.argv[2] ?? 'appointment.created';
const eventId = process.argv[3] ?? randomUUID();

(async () => {
  const conn = await amqp.connect(config.rabbitUrl);
  const ch = await conn.createChannel();
  await ch.assertExchange('sgh.events', 'topic', { durable: true });
  const msg = {
    eventId,
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data: {
      appointmentId: randomUUID(),
      patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
      patientName: 'Jean Dupont',
      scheduledAt: '2026-11-12T10:30:00Z',
    },
  };
  ch.publish('sgh.events', type, Buffer.from(JSON.stringify(msg)), {
    contentType: 'application/json',
    persistent: true,
  });
  await ch.close();
  await conn.close();
  console.log('Evenement publie :', type, eventId);
})();
