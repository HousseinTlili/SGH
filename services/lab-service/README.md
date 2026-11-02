# Lab Service (`lab-service`)

Laboratory service for managing clinical lab analysis requests, work queue priority, test catalogue, entering results with computed flags, and validating results with event publishing.

- **Port**: `8084`
- **Database**: PostgreSQL `sgh_lab`
- **Stack**: FastAPI (Python 3.12 / 3.14), SQLAlchemy 2, PyJWT with PyJWKClient (Keycloak 26), `aio-pika` (RabbitMQ 4), pytest + httpx
- **Contract**: `contracts/openapi/lab.yaml` (mirrored byte-for-byte in `openapi.yaml`)
- **Events**:
  - Consumes: `lab.request.created` from queue `lab.lab.request.created`
  - Publishes: `lab.result.ready` to exchange `sgh.events` on validation

---

## Features & Business Rules

1. **Request Intake via AMQP (LAB-1)**:
   - There is no direct REST endpoint to create requests. Requests arrive asynchronously via `lab.request.created` messages published by `doctor-service` / Consultation.
   - Idempotency is enforced using the `processed_events` table by `eventId`.
   - Malformed payloads are rejected and dead-lettered to `sgh.events.dlq`.

2. **Work Queue & Priority (LAB-7)**:
   - `GET /api/lab-requests`: Accessible by `LAB_TECHNICIAN`, `DOCTOR`, `ADMIN`.
   - Returned sorted with **`URGENT` requests first**, then oldest by `requestedAt ASC`.
   - Query filters: `status`, `priority`, `patientId`, `page`, `size`.

3. **Technician Workflow (LAB-2, LAB-3, LAB-4, LAB-5, LAB-6)**:
   - `POST /api/lab-requests/{id}/start`: Transitions `REQUESTED` to `IN_PROGRESS` and stamps `startedAt`. Returns `409 Conflict` if not `REQUESTED`.
   - `POST /api/lab-requests/{id}/results`: Enters results while `IN_PROGRESS` or `RESULT_ENTERED` (replaces previous results). Validates that every `testCode` belongs to the request (returns `422` otherwise).
   - **Flag Computation**:
     - `value < criticalLow` or `value > criticalHigh` → `CRITICAL`
     - else `value < refLow` → `LOW`
     - else `value > refHigh` → `HIGH`
     - else `NORMAL`
   - `POST /api/lab-requests/{id}/validate`: Transitions `RESULT_ENTERED` to `VALIDATED`. Enforces that every requested test has a result (`422` if any is missing). Stamps `validatedAt` and `validatedBy` from the JWT `staffId` claim. Publishes `lab.result.ready` event without rolling back validation if publish fails (**LAB-6**). Validated results are immutable.

4. **Catalogue & Results Queries**:
   - `GET /api/tests`: Returns catalogue of 6 standard tests (`HGB`, `WBC`, `GLU`, `CHOL`, `CRE`, `K`).
   - `GET /api/lab-results`: Lists validated results only, newest first (`validatedAt DESC, id DESC`).

5. **Resilience & Startup (Rule X-8)**:
   - Starts and serves `GET /health` (`200 {"status": "UP"}`) immediately even when PostgreSQL or RabbitMQ is temporarily offline.
   - Background retry loop connects and initializes database schema and seed data with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s).
   - Any database-dependent endpoints respond with `503 Service Unavailable` (`"Database unavailable"`) until connection is established.

---

## Seed Data

- **Test Catalogue (6 tests)**:
  - `HGB`: Hemoglobin (g/dL, ref: 12.0–17.0, crit: 7.0–20.0)
  - `WBC`: White blood cells (10^9/L, ref: 4.0–11.0, crit: 2.0–30.0)
  - `GLU`: Fasting glucose (mg/dL, ref: 70–100, crit: 40–400)
  - `CHOL`: Total cholesterol (mg/dL, ref: 0–200)
  - `CRE`: Creatinine (mg/dL, ref: 0.6–1.3, crit max: 5.0)
  - `K`: Potassium (mmol/L, ref: 3.5–5.1, crit: 2.5–6.5)
- **Lab Requests**:
  - `L1` (`f9f9f9f9-0000-4000-8000-000000000001`): `ROUTINE`, `VALIDATED` for P5 (`Hatem Dridi`) with HGB (14.2 NORMAL) and WBC (12.5 HIGH).
  - `L2` (`f9f9f9f9-0000-4000-8000-000000000002`): `URGENT`, `REQUESTED` for P3 (`Nizar Khelifi`) with K and CRE.

---

## Running and Testing

### 1. Run the service
```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --port 8084     # migrates and seeds in the background
```

### 2. Run the test suite (65 tests)
```bash
./.venv/bin/pytest
```
Needs PostgreSQL (`docker compose -f ../../infra/docker-compose.yml up -d postgres`). The tests use their own database `sgh_lab_test` (created on first run), sign their tokens with a local RSA key served through a local JWKS endpoint (no Keycloak needed) and never touch `sgh_lab`. `tests/test_broker.py` talks to a real RabbitMQ (`infra/rabbitmq/definitions.json` loaded) and is skipped when none is running.

### 3. Check contract integrity
```bash
../../scripts/check-contracts.sh
```

### 4. Interactive Docs & Health
- **Health**: http://localhost:8084/health
- **Swagger UI**: http://localhost:8084/docs (served from bundled assets, works offline)
- **OpenAPI JSON**: http://localhost:8084/openapi.json

---

## Security

Tokens are verified with the Keycloak public keys (RS256 only), the issuer and the expiry; anything else, including an unsigned `alg: none` token, is answered `401 Missing or invalid token` without saying why. `start`, `results` and `validate` need a `staffId` claim (LAB-5), otherwise `403`.

## Errors

Shared error body for everything, including unknown routes (`404`). Wrong parameter types and malformed JSON answer `400`, field validation `422`, a database lost after startup `503 Database unavailable`, unexpected failures `500` with a generic message (the cause is only logged). `start`/`results`/`validate` lock the request row, so concurrent calls cannot both succeed.

## Messaging

- `lab.request.created` is validated against the event contract; an unreadable or invalid message goes to `sgh.events.dlq`, a message that arrives while the database is down or still migrating is requeued instead of lost.
- `lab.result.ready` is queued right after the validation is committed and sent with publisher confirms; while the broker is down it is retried with backoff (1 to 30 s) for as long as the process lives. It is held in memory only, so it is lost if the process stops in the meantime.

## Database

Schema changes are Alembic migrations in `alembic/versions/` applied at startup (`alembic upgrade head` does the same from a shell). `0001` also adopts a database created by the earlier `create_all` start-up.
