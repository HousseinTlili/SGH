import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 8087),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://sgh:sgh_dev_password@localhost:5432/sgh_notification',
  rabbitUrl: process.env.RABBITMQ_URL ?? 'amqp://sgh:sgh_dev_password@localhost:5672',
};
