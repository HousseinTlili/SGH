# Doctor (Consultation) Service (`doctor-service`)

Service 3 (Consultation) of the SGH Hospital Management System. Runs on port 8083, database `sgh_consultation`, built with Express 5 and TypeScript.

- **Contract**: `openapi.yaml` (byte-identical copy of `../../contracts/openapi/consultation.yaml`, verified by `scripts/check-contracts.sh`).
- **Events**:
  - Publishes `lab.request.created` and `prescription.created` to exchange `sgh.events`.
  - Consumes `lab.result.ready` from queue `consultation.lab.result.ready` with dead-letter exchange `sgh.events.dlx`.

---

## Run and Test

```bash
# Install dependencies
npm install

# Type-check the sources and the tests
npm run typecheck

# Run unit and integration tests (Vitest)
npm test

# Build TypeScript to dist/
npm run build

# Start the service (runs migrations and seed on boot)
npm start
```

### Test prerequisites

| Dependency | Needed by | Behaviour when missing |
|---|---|---|
| PostgreSQL (`docker compose -f ../../infra/docker-compose.yml up -d postgres`) | all tests | the suite fails. The tests use their own database `sgh_consultation_test`, created on first run, and never touch `sgh_consultation` |
| Keycloak | none by default | tests sign their own tokens with a local JWKS (`tests/fake-idp.ts`, claims mirror `infra/keycloak/sgh-realm.json`). Set `TEST_KEYCLOAK=1` to use the real realm instead |
| RabbitMQ with `infra/rabbitmq/definitions.json` loaded | `tests/amqp.integration.test.ts` | those tests are skipped |

The RabbitMQ tests listen on throwaway queues, and the consumer test skips itself when a doctor-service is already consuming the queue. They check the published envelopes against `contracts/events/*.json`, delivery of events that were queued before the broker connection existed, idempotent consumption of `lab.result.ready`, and dead-lettering of a poison message.

- **Health check**: `http://localhost:8083/health`
- **Swagger UI**: `http://localhost:8083/docs`
- **OpenAPI JSON**: `http://localhost:8083/openapi.json`

---

## Business Rules Implemented

- **CON-1**: DOCTOR role opens consultation with `doctorId` extracted from JWT `staffId` claim. Calls Patient service for snapshot with 2s timeout.
- **CON-2**: Resilient patient snapshot fallback: if Patient service times out, is down, or returns 5xx, stores `patientSnapshot = null` and still creates the consultation.
- **CON-3**: Only own doctor can edit SOAP notes in `DRAFT` status; `SIGNED` returns 409 Conflict; partial updates supported (D30).
- **CON-4**: Sign and lock: own doctor signs when `assessment` and `plan` are present; already signed returns 409 Conflict.
- **CON-5**: Prescriptions: 1 to 20 items issued on DRAFT or SIGNED; publishes `prescription.created` in background without delaying HTTP response.
- **CON-6**: Lab orders: 1 to 10 unique tests; publishes `lab.request.created` in background.
- **CON-7**: Lab results: consumes `lab.result.ready` idempotently via `processed_events`, stores validated results (consultation taken from the order), and marks order as `VALIDATED`. A result for an unknown lab order is logged and acknowledged.
- **CON-8**: Vital signs: NURSE and DOCTOR record measurements with `recordedBy` from token; validates range constraints and `diastolic < systolic`.
- **CON-9**: Consultations list: paged newest first; PATIENT role restricted to own patient ID.
- **CON-10**: PHARMACIST role restricted exclusively to `GET /api/consultations/{id}/prescriptions`.
- **X-6 / X-8**: Resilient boot: starts even if Postgres or RabbitMQ are down; `/health` returns 200 UP immediately; database endpoints return 503 until migrations and seed finish in background retry loop.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8083` | HTTP listener port |
| `DATABASE_URL` | `postgres://sgh:sgh_dev_password@localhost:5432/sgh_consultation` | PostgreSQL connection URL |
| `RABBITMQ_URL` | `amqp://sgh:sgh_dev_password@localhost:5672` | RabbitMQ broker URL |
| `KEYCLOAK_ISSUER` | `http://localhost:8180/realms/sgh` | Keycloak realm issuer |
| `KEYCLOAK_JWKS_URI` | `http://localhost:8180/realms/sgh/protocol/openid-connect/certs` | Keycloak certs endpoint |
| `PATIENT_SERVICE_URL` | `http://localhost:8081` | Patient service base URL |
| `HTTP_TIMEOUT_MS` | `2000` | Service-to-service call timeout |
| `SEED` | `true` | Run idempotent seed on startup |
| `AMQP_REQUEUE_DELAY_MS` | `2000` | Pause before a `lab.result.ready` message is requeued after a transient failure |
| `LOG_LEVEL` | `info` | Pino log level |

---

## Messaging behaviour

- **Publishing** (`lab.request.created`, `prescription.created`): the HTTP response never waits for the broker. Events are queued in memory right after the database commit and sent with publisher confirms. While the broker is unreachable they are retried with exponential backoff (1 s up to 30 s) for as long as the process lives, and delivered in order once it is back (buffer of 1000 events, oldest dropped first). They are not persisted, so a process that stops while the broker is down loses what it still holds; a transactional outbox is the production remedy.
- **Consuming** (`lab.result.ready`): the message is acknowledged only after it is saved. A message that cannot be understood (not JSON, fails the schema, refers to an unknown consultation) is dead-lettered to `sgh.events.dlq`. A transient failure (database down, migrations not finished yet) requeues the message instead, so a valid result is never lost to an outage.
- **Connection**: a single reconnect timer with backoff handles broker restarts; connection and channel errors are logged and never crash the process.

## Error format

Every error uses the shared body (`timestamp, status, error, message, path, correlationId, details?`), including unknown routes. Wrong parameter types (a path id that is not a UUID, a non-numeric `page`, a malformed filter, malformed JSON) answer `400`; unknown resources `404`; field validation `422`; a database that disappears after startup `503 Database unavailable`. Unexpected failures answer `500 Internal server error` without exposing the cause, which is only written to the log.

## Database

Schema changes are versioned SQL files in `migrations/`, applied in filename order at startup (and by `npm run migrate:up`) under an advisory lock and recorded in `schema_migrations`. The seed then loads the fixtures idempotently (`SEED=false` skips it).
