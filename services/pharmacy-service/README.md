# Pharmacy service (`pharmacy-service`)

Port **8085**, database `sgh_pharmacy`, stack **Express 5 (TypeScript)** with `pg`, `jose`, `zod`, `amqplib`, `pino`, `vitest`, `supertest`.

- **Contract**: `../../contracts/openapi/pharmacy.yaml` (identical to `openapi.yaml`, validated with `./scripts/check-contracts.sh`).
- **Specification**: Notion page "Pharmacy Service - API Spec", Domain Model and Business Rules (PHA-1 to PHA-9, X-1 to X-8), Seed Data and Fixtures, Event Catalogue.
- **Events**:
  - Consumes: `prescription.created` from queue `pharmacy.prescription.created` (idempotently via `processed_events`).
  - Publishes: `prescription.dispensed` to exchange `sgh.events`, queued right after the commit and sent with publisher confirms; while the broker is down it is retried with backoff for as long as the process lives (held in memory only).
- **Outgoing HTTP**: Verifies prescription with Consultation service `GET /api/consultations/{id}/prescriptions` on port 8083 using caller's bearer token; falls back to local copy if consultation-service is unreachable (PHA-7).

---

## Run and Test

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Type-check sources and tests, then run the Vitest suite (73 tests)
npm run typecheck && npm test

# Start the service
npm start
```

- Liveness: `http://localhost:8085/health` (unconditionally 200 UP)
- Swagger UI: `http://localhost:8085/docs`
- OpenAPI JSON: `http://localhost:8085/openapi.json`

Tests need PostgreSQL only: they use their own database `sgh_pharmacy_test` (created on first run), sign their tokens with a local key and talk to a stub Consultation service that they can break on purpose. `tests/amqp.integration.test.ts` uses a real RabbitMQ (`infra/rabbitmq/definitions.json` loaded) and is skipped when none is running.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8085` | HTTP listening port |
| `DATABASE_URL` | `postgres://sgh:sgh_dev_password@localhost:5432/sgh_pharmacy` | PostgreSQL database connection string |
| `RABBITMQ_URL` | `amqp://sgh:sgh_dev_password@localhost:5672` | RabbitMQ broker AMQP URI |
| `KEYCLOAK_ISSUER` | `http://localhost:8180/realms/sgh` | Keycloak JWT issuer URL |
| `KEYCLOAK_JWKS_URI` | `http://localhost:8180/realms/sgh/protocol/openid-connect/certs` | Keycloak public key JWKS URI |
| `CONSULTATION_SERVICE_URL` | `http://localhost:8083` | Doctor / Consultation service URL (PHA-7) |
| `HTTP_TIMEOUT_MS` | `2000` | HTTP request timeout for outgoing calls |
| `SEED` | `true` | Seed database on startup if true |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |

---

## Seed Data

- **Drugs (`d4d4d4d4-0000-4000-8000-000000000001` to `...0010`)**:
  - D01: Paracetamol (TABLET, 500 mg, stock 500, reorderThreshold 100)
  - D02: Ibuprofen (TABLET, 400 mg, stock 300, reorderThreshold 80)
  - D03: Amoxicillin (CAPSULE, 500 mg, **stock 55, reorderThreshold 60** - low stock alert!)
  - D04: Omeprazole (CAPSULE, 20 mg, stock 150, reorderThreshold 50)
  - D05: Metformin (TABLET, 850 mg, stock 400, reorderThreshold 100)
  - D06: Amlodipine (TABLET, 5 mg, stock 250, reorderThreshold 70)
  - D07: Atorvastatin (TABLET, 20 mg, stock 180, reorderThreshold 60)
  - D08: Salbutamol (INHALER, 100 mcg/dose, stock 120, reorderThreshold 30)
  - D09: Cetirizine (TABLET, 10 mg, stock 220, reorderThreshold 50)
  - D10: Insulin glargine (INJECTION, 100 IU/ml, stock 40, reorderThreshold 20)
- **Prescription R1 (`f8f8f8f8-0000-4000-8000-000000000001`)**:
  - Consultation C1 (`f7f7f7f7-0000-4000-8000-000000000001`), Patient P5 (`a1a1a1a1-0000-4000-8000-000000000005`), Doctor S2 (`b2b2b2b2-0000-4000-8000-000000000002`).
  - Status: `ISSUED`.
  - Items:
    - 0: Paracetamol 500 mg, 1 tablet, 3 per day, 5 days, dispensed: false
    - 1: Cetirizine 10 mg, 1 tablet, 1 per day, 7 days, dispensed: false

---

## Business Rules Implemented

- **PHA-1**: Read endpoints for drugs and stock alerts; drug list supports case-insensitive substring search on name, paged.
- **PHA-2**: Add drug (`POST /api/drugs`, PHARMACIST) rejects duplicate name + strength with 409 Conflict (case-insensitive).
- **PHA-2 / Spec**: Edit drug (`PUT /api/drugs/{id}`, PHARMACIST) updates drug attributes while ignoring any stock value in the body.
- **PHA-3**: Stock adjustment (`POST /api/drugs/{id}/stock`, PHARMACIST) takes signed non-zero delta and reason (1-200 chars); returns 409 Conflict if resulting stock would be negative.
- **PHA-4 / PHA-5**: Dispensing (`POST /api/prescriptions/{id}/dispense`, PHARMACIST) validates lines, locks rows (`SELECT ... FOR UPDATE`), decrements stock, creates dispensing record and lines, and updates prescription status (`PARTIALLY_DISPENSED` or `DISPENSED`).
- **PHA-6**: Publishes `prescription.dispensed` event to `sgh.events` exchange asynchronously after transaction commit.
- **PHA-7**: Consultation verification before dispensing: queries Consultation service; if reachable and prescription is missing returns 409 Conflict; if Consultation is down, falls back to local copy.
- **PHA-8**: Stock alerts (`GET /api/stock/alerts`, plain array) returns all drugs where `stock <= reorderThreshold`.
- **PHA-9 / D31**: Prescription listing accepts single status or comma-separated list (e.g. `?status=ISSUED,PARTIALLY_DISPENSED`), sorted with `ISSUED` and `PARTIALLY_DISPENSED` first, then oldest.
- **X-8**: Resilient startup: starts HTTP server immediately even if PostgreSQL is unavailable; `/health` returns 200 UP; database-backed endpoints return 503 Service Unavailable ("Database unavailable") until background retry loop connects, runs migrations and seed.

---

## Concurrency, errors and upgrades

- Dispensing locks the prescription row first and the drug rows in a fixed order, so the same item cannot be dispensed twice by racing requests, two dispensings that share drugs cannot deadlock, and stock cannot be oversold. Stock adjustments are a single conditional update.
- A `PHARMACIST` token without `staffId` gets `403` on dispense: the dispensing record needs a real pharmacist.
- Wrong parameter types (non-UUID ids, bad filters, malformed JSON, non-numeric paging) answer `400`; invalid fields `422`; conflicts (duplicate drug, insufficient stock, already dispensed) `409`, also when two creations race; a database lost after startup `503 Database unavailable`; unexpected failures `500` with a generic message. Unknown routes answer in the shared error body.
- `prescription.created` is validated against the event contract; invalid messages go to `sgh.events.dlq`, and messages that arrive while the database is down or still migrating are requeued instead of lost.
- Schema changes are versioned SQL files in `migrations/`, applied at startup under an advisory lock (`npm run migrate:up` runs them alone).
