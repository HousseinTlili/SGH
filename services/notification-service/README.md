# Notification Service (`notification-service`)

Port **8087**, database `sgh_notification`, stack **Express 5 (TypeScript)** with `pg`, `zod`, `amqplib`, `vitest`, `supertest`.
Owner: **@hedhilitesnim** (`tasnim.hdhili@esprit.tn`).

- **Contract**: `../../contracts/openapi/notification.yaml` (identical to `openapi.yaml`).
- **Events**:
  - Consumes: `appointment.created`, `appointment.cancelled` from durable queue `notification.appointment.events` (bound to topic exchange `sgh.events`).
  - Dead Letter Queue: `sgh.events.dlq` via `sgh.events.dlx` fanout exchange for poison pills.
  - Idempotency: `processed_events (event_id, event_type) ON CONFLICT DO NOTHING`.
- **REST Endpoints**:
  - `GET /health`: Liveness probe (unconditionally `200 { status: "UP" }`).
  - `GET /api/notifications`: Paginated notifications stream with filtering by read state, type, severity, keyword search (`q`), and sorting (`order`).
  - `GET /api/notifications/unread-count`: Fast badge count of unread notifications.
  - `GET /api/notifications/stats`: Real-time KPI statistics (totals, by severity, by type, last 7 days).
  - `PATCH /api/notifications/:id/read` & `PATCH /api/notifications/:id/unread`: Toggle read flag.
  - `PATCH /api/notifications/read-all`: Mark all items read.
  - `DELETE /api/notifications/:id`: Delete notification.
  - `DELETE /api/notifications/read`: Clear all read notifications.
  - `POST /api/notifications/bulk`: Bulk read, unread, or delete actions.

---

## Run and Test

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Seed demonstration data
npm run seed

# Run with hot reload
npm run dev

# Start in production mode
npm start
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8087` | HTTP listening port |
| `DATABASE_URL` | `postgres://sgh:sgh_dev_password@localhost:5432/sgh_notification` | PostgreSQL connection string |
| `RABBITMQ_URL` | `amqp://sgh:sgh_dev_password@localhost:5672` | RabbitMQ AMQP URI |
