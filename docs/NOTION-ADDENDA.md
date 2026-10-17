# Notion changes (APPLIED 2026-10-17)

Written and applied 2026-10-17 at the project lead's request. All 14 pages received an "Addendum (17 October 2026)" appended at the end (the Decisions Log got a new section "Resolved on 17 October"); existing text was not changed. This file keeps the full text for the record.

Notion check done on 2026-10-17: all 38 pages present and unchanged since 2026-10-06 (compared at minute precision with the times recorded in `docs/PLAN.md`). The gaps below come from my read of the spec, with the finding ids of `docs/PLAN.md` section 3.

---

## 1. Decisions Log: add a section "Resolved on 17 October"

Intro line: "Added 17 October 2026 by the project lead's assistant. These are defaults: change a line here first if the team or the teacher decides otherwise. They override older text on other pages."

| # | Decision | Resolves |
|---|----------|----------|
| D21 | The six modules in the repository are `patient-service`, `reception-service`, `doctor-service`, `lab-service`, `pharmacy-service`, `staff-service`. Each is a folder under `services/` and a Git branch with the same name. `doctor-service` implements Service 3 (Consultation). The logical name `consultation` stays everywhere else: API paths, port 8083, database `sgh_consultation`, queue names, the gateway 503 body, Angular `ServiceName`. | naming |
| D22 | Default stacks: Patient Spring Boot, Reception NestJS, Doctor Express (TypeScript), Lab FastAPI, Pharmacy Express (TypeScript), Staff Spring Boot, Gateway Spring Cloud Gateway (WebFlux). Four distinct technologies. | Q3 (stacks) |
| D23 | Notion stays the source of truth. A dated copy of every page is committed as `docs/spec/` at handoff, with a table of last-edited times. "docs/spec/" on other pages means that copy. | M2 |
| D24 | `contracts/openapi/<service>.yaml` is the single source of truth for each API, written by the project lead. A service folder holds a byte-identical copy, checked by `scripts/check-contracts.sh`. | M4 |
| D25 | The protected placeholder endpoint of a stub is `GET /api/_stub/ping`, role ADMIN, answering `{ "service": "<name>", "user": "<preferred_username>" }`. Removed when the first real protected endpoint exists. | M5 |
| D26 | New rule X-8: a service starts with its database unreachable; `/health` always answers 200; database-backed endpoints answer 503 with the shared error body (message "Database unavailable") until migrations and seed have run in a background retry loop (1, 2, 4, 8, 16, 30 s). | M6 |
| D27 | The RabbitMQ topology (exchange `sgh.events`, `sgh.events.dlx`, `sgh.events.dlq`, every consumer queue and binding) is pre-declared by `infra/rabbitmq/definitions.json`. Services still declare the same objects with identical arguments. | M7 |
| D28 | Reception's 60-second verification job (REC-6) authenticates with Keycloak confidential client `sgh-reception-svc` (client credentials, service account with realm role RECEPTIONIST). Variables `KEYCLOAK_TOKEN_URL`, `RECEPTION_CLIENT_ID`, `RECEPTION_CLIENT_SECRET` (dev value in `.env.example`). | M1 |
| D29 | Images pinned to current tags chosen at install: Keycloak 26.x (exact tag in the compose file), `rabbitmq:4-management`, `postgres:16`. Compose ports quoted. Spring Cloud Gateway 5 uses `spring.cloud.gateway.server.webflux`. | B2, B3, B4 |
| D30 | `PUT /api/consultations/{id}` is a partial update (a missing field is unchanged). A null `patientSnapshot` shows "Patient details are unavailable" and is not back-filled. | B16, M9 |
| D31 | `GET /api/prescriptions?status=` accepts one status or several separated by commas. | S-8 |
| D32 | The project lead builds the gateway and hands it to the Staff owner afterwards. The lead owns `infra/`, `contracts/`, `scripts/`, `tools/`. | M8 |

## 2. Local Setup: append

- Repository layout is the union of this page and the CLAUDE.md layout: `contracts/`, `infra/`, `gateway/`, `frontend/`, `services/<module>-service/`, `scripts/`, `tools/mock/`, `docs/`. The repository root is the project root (no extra `sgh/` level). Service folders: `patient-service`, `reception-service`, `doctor-service`, `lab-service`, `pharmacy-service`, `staff-service` (Decisions Log D21).
- Start order: 1 infrastructure (`docker compose -f infra/docker-compose.yml up -d`), 2 the six services in any order, 3 the gateway, 4 the front end. (The numbering in the section above restarts at 1 for each list.)
- Windows: use Git Bash for `scripts/*.sh`; install `jq` (`winget install jqlang.jq`); Docker Desktop with the WSL2 backend; `.gitattributes` forces LF on `*.sh`.
- `scripts/reset.sh` wipes and restarts the infrastructure and reseeds. Required before a full E2E run.

## 3. Stack Templates: append to section 3 and section 1

- Stub placeholder endpoint: `GET /api/_stub/ping`, ADMIN only (D25).
- X-8 (D26): HTTP server first; background loop runs migrations then seed and sets a "ready" flag; database-backed endpoints answer 503 until ready; `/health` is its own handler. Spring Boot: do not use the actuator database indicator for `/health`; set Hikari `initialization-fail-timeout` to -1; run Flyway from the background loop, not at context start. JWT keys: fetch lazily with a cache (Spring `jwk-set-uri` with an issuer validator, not an eager `issuer-uri`).
- Publishing an event happens from a background task after the commit, so a broker outage never delays the HTTP response (3 retries with backoff, then log an error).
- CORS headers are added by the gateway only. Services add none.

## 4. Infra Files: append

- Image tags: see D29. Quote every port mapping (`"5432:5432"`).
- Add to the RabbitMQ service: mount `./rabbitmq/definitions.json` and `./rabbitmq/rabbitmq.conf` (`load_definitions = /etc/rabbitmq/definitions.json`).
- Keycloak has no healthcheck, so `docker compose ps` shows it as "running", not "healthy". Check `http://localhost:8180/realms/sgh` returns 200.
- New scripts: `scripts/reset.sh`, `scripts/check-contracts.sh`, `scripts/stub-check.sh`. New env variables for Reception: see D28.

## 5. Keycloak Setup: append

- Add client `sgh-reception-svc` (confidential, service account enabled, standard flow off, role RECEPTIONIST on the service account) (D28).
- `patient1` needs first name `Youssef`, last name `Ben Salah`, email `patient1@sgh.local`, otherwise the password grant fails with "Account is not fully set up".
- Tokens carry extra realm roles (`default-roles-sgh`, `offline_access`, `uma_authorization`). Services keep only the seven SGH roles when building `/api/me`.
- The exact JSON that makes `staffId` and `patientId` appear in the token (user profile declaration or unmanaged attributes) is verified when the realm is first imported and written to `docs/keycloak-notes.md`.

## 6. Seed Data and Fixtures: append

- User `patient1` is Youssef Ben Salah (P1), email `patient1@sgh.local`.
- Prescription R1 items are written in full: `Paracetamol 500 mg`, dosage `1 tablet`, `3 per day`, `5 days`; `Cetirizine 10 mg`, dosage `1 tablet`, `1 per day`, `7 days`.
- Relative timestamps are relative to the first start of each service. For a demo, run `scripts/reset.sh` and start all services on the same day.

## 7. Domain Model and Business Rules: append

- REC-6: the verification job authenticates with the service account of D28 (it has no caller token). X-4 applies to calls made on behalf of a user.
- X-8: see D26.
- X-9: a PUT on a consultation updates only the fields present in the body (D30).

## 8. Event Catalogue: append

- The queues and bindings are created in advance by `infra/rabbitmq/definitions.json` (D27), so the checklist line "exchange available from docker-compose.yml" is true.
- Payload examples use the lab test code `CBC`; real codes are `HGB`, `WBC`, `GLU`, `CHOL`, `CRE`, `K` (Seed Data).
- A published event never delays the HTTP response of the producer.

## 9. Consultation Service - API Spec: append

- `PUT /api/consultations/{id}` is a partial update (D30).
- The workspace shows the dispensing status of a prescription only to the DOCTOR role (the gateway refuses NURSE on `/api/prescriptions/**`).

## 10. Pharmacy Service - API Spec: append

- `GET /api/prescriptions?status=` accepts a comma-separated list (D31).

## 11. API Contracts and Conventions: append

- Top-level endpoints that return a plain array although D19 says lists are paged: `/api/staff/directory`, `/api/roles`, `/api/stock/alerts`, `/api/tests`, `/api/consultations/{id}/lab-orders`.
- `contracts/openapi/` is the single source of truth (D24).

## 12. Angular - Screens B: append

- NURSE does not request `GET /api/prescriptions/{id}`; only DOCTOR sees the dispensing badge.
- Lab results of a consultation come from `GET /api/consultations/{id}/lab-results`.
- A null `patientSnapshot` shows "Patient details are unavailable" (D30).

## 13. End-to-End Scenarios (curl): append

- Create test patients with a unique suffix per run so the script can run twice; run `scripts/reset.sh` before the full run.
- Scenario 4: validating a request that is IN_PROGRESS returns 409 (not "422 or 409").
- Scenario 12 (patient portal) is part of the automated run.

## 14. Gateway Config: append

- Acceptance for a stopped service in `/gateway/health/services`: "within 3 seconds" (1 s timeout plus up to 2 s cache).
- Spring Cloud Gateway 5 property prefix: `spring.cloud.gateway.server.webflux` (D29).
