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

# Run unit and integration tests (Vitest)
npm test

# Build TypeScript to dist/
npm run build

# Start the service (runs migrations and seed on boot)
npm start
```

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
- **CON-7**: Lab results: consumes `lab.result.ready` idempotently via `processed_events`, stores validated results, and marks order as `VALIDATED`.
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
