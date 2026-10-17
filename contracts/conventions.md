# Contract conventions (one page)

Source: API Contracts and Conventions, Event Catalogue, Decisions Log D15 to D31. The OpenAPI files in `contracts/openapi/` are the source of truth (D24); a service folder holds a byte-identical `openapi.yaml`, checked by `scripts/check-contracts.sh`.

## Files
| Module folder | Contract | Port | Operations |
|---------------|----------|------|-----------|
| patient-service | `openapi/patient.yaml` | 8081 | 9 |
| reception-service | `openapi/reception.yaml` | 8082 | 14 |
| doctor-service | `openapi/consultation.yaml` | 8083 | 13 |
| lab-service | `openapi/lab.yaml` | 8084 | 8 |
| pharmacy-service | `openapi/pharmacy.yaml` | 8085 | 10 |
| staff-service | `openapi/staff.yaml` | 8086 | 10 |

Operation counts equal the endpoint lists of the API Spec pages (health included). Lint: `npx @redocly/cli lint contracts/openapi/*.yaml` (config in `redocly.yaml`).

## Rules
- Base path `/api`; JSON; camelCase; UUID ids; UTC timestamps `2026-10-12T09:30:00Z`; dates `YYYY-MM-DD`.
- Paged lists `?page=0&size=20` (max 100) return `{ content, page, size, totalElements, totalPages }`. Plain arrays (D19 and its exceptions): sub-collections of one parent, `/api/staff/directory`, `/api/roles`, `/api/stock/alerts`, `/api/tests`.
- Error body `{ timestamp, status, error, message, path, correlationId, details? }`; 400, 401, 403, 404, 409, 422, 503, 500. Role is checked before the body is validated. 503 `Database unavailable` while migrations have not run (X-8).
- `X-Correlation-Id` on every request, response, log line, outgoing call and event.
- `GET /health` (no token), Swagger UI at `/docs`, spec at `/openapi.json` on every service (not repeated in the OpenAPI files except `/health`).
- Roles are listed in each operation's description and in the `x-roles` extension.

## Events (`events/`)
Exchange `sgh.events` (topic, durable), routing key = event type, envelope `envelope.schema.json`. Payload schemas: `appointment.created`, `appointment.cancelled`, `lab.request.created`, `lab.result.ready`, `prescription.created`, `prescription.dispensed` (`*.data.schema.json`). Queues are pre-declared by `infra/rabbitmq/definitions.json` (D27): `lab.lab.request.created`, `pharmacy.prescription.created`, `consultation.lab.result.ready`, dead letters in `sgh.events.dlq`.

## Synchronous calls allowed
Reception to Patient `GET /api/patients/{id}/summary`; Consultation to Patient the same; Reception to Staff `GET /api/staff/{id}/public`; Pharmacy to Consultation `GET /api/consultations/{id}/prescriptions`. All with a 2 s timeout, forwarding `Authorization` and `X-Correlation-Id`, and a documented fallback. Reception's 60 s job uses the client credentials of `sgh-reception-svc` (D28).
