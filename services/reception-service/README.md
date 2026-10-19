# Reception service (reception-service)

Service 2 of the SGH Hospital Management System (port 8082, database `sgh_reception`). Handles patient appointment scheduling, doctor availability slots, and billing/invoices.

## Tech Stack & Architecture

- **Runtime**: Node.js 24 + TypeScript (ESM)
- **Framework**: Express 5
- **Database**: PostgreSQL 16 (`sgh_reception`), raw `pg` pool with idempotent migrations and fixtures seeding
- **Messaging**: RabbitMQ (`sgh.events` topic exchange, publishing `appointment.created` and `appointment.cancelled` asynchronously)
- **Auth**: Keycloak JWT validation via remote JWKS (`jose`), role-based access control, confidential client credentials authentication for background verification job
- **Testing**: Vitest 3 + Supertest (71 tests). They run against their own database `sgh_reception_test` (created on first run) with a local token signer and stub Patient/Staff/Keycloak endpoints, so only PostgreSQL is needed; the RabbitMQ test is skipped when no broker is running. `npm run typecheck` checks sources and tests.

## Implemented Business Rules

- **REC-1 / REC-2**: Appointment duration between 10 and 120 minutes, `startAt` must be in the future.
- **REC-3**: Doctor overlap check against active appointments (`SCHEDULED`, `CHECKED_IN`) returning 409 Conflict.
- **REC-4**: Appointment state machine transitions (`SCHEDULED` -> `CHECKED_IN` -> `COMPLETED`, `SCHEDULED` / `CHECKED_IN` -> `CANCELLED`).
- **REC-5 / REC-6**: Patient lookup against Patient Service `/summary` with fallback to `patientVerified = false` on network outage; background reverification job every 60s using `sgh-reception-svc` client credentials.
- **REC-7**: Doctor lookup against Staff Service `/public`: an unknown doctor answers 422, an unreachable Staff service skips the check.
- **REC-9**: Every 60 s (and once at startup) each SCHEDULED appointment starting within 24 h without reminders gets one SMS and one EMAIL reminder, logged as `REMINDER channel=SMS appointmentId=... patientId=... startAt=...` and marked SENT.
- **REC-8 / REC-10**: Asynchronous publishing of `appointment.created` and `appointment.cancelled` events with DLX support; reminder cancellation on appointment cancel.
- **REC-11 / REC-13**: Server-computed invoice total (`sum(quantity * unitPrice)`); payment without storing credit card details.
- **REC-12**: Invoice state transitions (`PENDING` -> `PAID` or `CANCELLED`).
- **REC-14**: Availability endpoint (`GET /api/appointments/availability`) returning 18 half-hour slots from 08:00 to 17:00 UTC.
- **REC-15**: Role visibility enforcement:
  - `RECEPTIONIST`, `ADMIN`: full visibility.
  - `DOCTOR`: forced filter on token `staffId` (403 on other doctors' appointments).
  - `PATIENT`: forced filter on token `patientId` (403 on other patients' records).
- **X-8**: Resilience to database outage (503 Service Unavailable with correlation ID on data endpoints while `/health` remains 200 UP).

## Endpoints

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/health` | *Public* | Healthcheck returning `{ "status": "UP" }` |
| `GET` | `/docs` | *Public* | Swagger UI documentation |
| `GET` | `/openapi.json` | *Public* | OpenAPI 3.0 specification |
| `GET` | `/api/_stub/ping` | `ADMIN` | Protected stub ping |
| `GET` | `/api/appointments/availability` | `RECEPTIONIST`, `DOCTOR`, `ADMIN` | 18 half-hour slots for a doctor and date |
| `GET` | `/api/appointments` | `RECEPTIONIST`, `ADMIN`, `DOCTOR`, `PATIENT` | Paginated appointments sorted by start time |
| `POST` | `/api/appointments` | `RECEPTIONIST` | Book appointment with overlap and patient checks |
| `GET` | `/api/appointments/:id` | `RECEPTIONIST`, `ADMIN`, `DOCTOR`, `PATIENT` | View appointment detail |
| `PUT` | `/api/appointments/:id` | `RECEPTIONIST` | Update SCHEDULED appointment |
| `POST` | `/api/appointments/:id/check-in` | `RECEPTIONIST` | SCHEDULED -> CHECKED_IN |
| `POST` | `/api/appointments/:id/complete` | `DOCTOR`, `RECEPTIONIST` | CHECKED_IN -> COMPLETED |
| `POST` | `/api/appointments/:id/cancel` | `RECEPTIONIST` | Cancel appointment and pending reminders |
| `GET` | `/api/invoices` | `RECEPTIONIST`, `ADMIN`, `PATIENT` | Paginated invoices, newest first |
| `POST` | `/api/invoices` | `RECEPTIONIST` | Create invoice with server-computed total |
| `GET` | `/api/invoices/:id` | `RECEPTIONIST`, `ADMIN`, `PATIENT` | View invoice detail |
| `POST` | `/api/invoices/:id/pay` | `RECEPTIONIST` | Pay invoice (CASH or CARD) |
| `POST` | `/api/invoices/:id/cancel` | `RECEPTIONIST` | Cancel PENDING invoice |

## Running & Testing

```bash
# Install dependencies
npm install

# Start development server on port 8082
npm start

# Run all 34 Vitest integration tests
npm test
```

## Errors, concurrency and upgrades

- Shared error body for everything, including unknown routes (`404`). Wrong parameter types (non-UUID ids, bad filters, malformed JSON) answer `400`; missing or invalid fields `422`. A database lost after startup answers `503 Database unavailable`; unexpected failures answer `500` with a generic message.
- Booking and moving an appointment take a per-doctor transaction lock around the overlap check (REC-3), and state changes (`check-in`, `complete`, `cancel`, invoice `pay`/`cancel`) are single conditional updates, so concurrent requests cannot both succeed.
- Events are queued in memory right after the commit and sent with publisher confirms; while the broker is down they are retried with backoff and delivered when it returns (they are lost if the process stops in the meantime).
- Schema changes are versioned SQL files in `migrations/`, applied at startup under an advisory lock (`npm run migrate:up` runs them alone). `002` converts the single never-sent reminders of the earlier job to the SMS/EMAIL model.
- The `invoices.lines` column stores the lines as JSON rather than in an `invoice_lines` table; the API shape is the one in the contract.
