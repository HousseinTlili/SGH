# SGH - Hospital Management System (microservices)

University project (ESPRIT, module Applications Web Distribuees). Six independent services behind one API gateway, one Angular front end, Keycloak for login, RabbitMQ for events, Postgres. Runs locally only. No deployment.

## Source of truth
The specification lives in Notion (root page "SGH - Hospital Management System"). A dated copy is committed in docs/spec/ when handed to contributors; "docs/spec/" in any page means that copy. Precedence when pages disagree: Domain Model and Business Rules > the service's API Spec > Seed Data and Fixtures > API Contracts and Conventions and Event Catalogue > Infra Files, Keycloak Setup, Gateway Config, Stack Templates > Angular pages > Decisions Log (D9 to D32 are resolved decisions) > older overview pages. If still unclear, stop and ask. Do not guess silently.

## Layout
contracts/openapi/   one OpenAPI file per service: the single source of truth (D24); contracts/events/ JSON Schemas
infra/               docker-compose.yml, postgres/init.sql, rabbitmq/ (definitions.json), keycloak/sgh-realm.json
gateway/             API gateway, Spring Cloud Gateway, port 8080
frontend/            Angular app, port 4200
services/            one folder per module (D21):
  patient-service 8081 Spring Boot      sgh_patient
  reception-service 8082 Express (TS)      sgh_reception
  doctor-service 8083 Express (TS)      sgh_consultation   (Service 3, logical name "consultation")
  lab-service 8084 FastAPI              sgh_lab
  pharmacy-service 8085 Express (TS)    sgh_pharmacy
  staff-service 8086 Spring Boot        sgh_staff
tools/mock/          Prism mock servers + mock gateway (front end without a backend)
scripts/             token.sh, health.sh, reset.sh, e2e.sh, check-contracts.sh, stub-check.sh
docs/                plans, decisions, PROMPTS.md, architecture

## Conventions (every service)
- JSON, camelCase, UUID ids, timestamps ISO 8601 UTC, dates YYYY-MM-DD.
- Error body: { timestamp, status, error, message, path, correlationId, details? }. 422 validation, 409 conflict.
- Lists: ?page=0&size=20 (max 100) -> { content, page, size, totalElements, totalPages }. Sub-collections and the exceptions in API Contracts are plain arrays.
- Auth: Keycloak JWT. Issuer http://localhost:8180/realms/sgh (always localhost). Roles in realm_access.roles; keep only the seven SGH roles. Claims: preferred_username, staffId, patientId. 401 no/invalid token, 403 wrong role. Check the role before validating the body.
- X-Correlation-Id on every request, response, log line, outgoing call and event.
- Service-to-service calls: 2 s timeout, forward Authorization and X-Correlation-Id, documented fallback.
- Events: exchange sgh.events (topic, durable), envelope per Event Catalogue, publish after commit from a background task, consumers idempotent through processed_events and acknowledge after saving.
- X-6/X-8: a service starts with the database, broker and peers down. /health is its own handler. Database-backed endpoints answer 503 "Database unavailable" until migrations and seed have run.
- Every service has GET /health -> { status: UP } (no token), Swagger UI at /docs, spec at /openapi.json.
- Database: Postgres, own database only, migrations + idempotent seed from Seed Data and Fixtures. Use the exact seed ids. Never invent new ones.

## Commands
Infra up:     docker compose -f infra/docker-compose.yml up -d
Reset:        ./scripts/reset.sh
Health:       ./scripts/health.sh
Token:        ./scripts/token.sh doctor1   (doctor1 doctor2 nurse1 lab1 pharmacist1 reception1 admin1 patient1; password Sgh@dev2026)
End to end:   ./scripts/e2e.sh
Mock servers: npm run mock     Front end: cd frontend && npm run start:mock
Each service README has its own run and test commands.

## Working rules
- Contracts first: change the spec and contracts/openapi before behaviour.
- Small steps: implement, run, show evidence (command and output), commit with a prefix like 'patient: ...'.
- Never say something works unless you ran it. Report what you ran and what you saw.
- Do not add features that are not in the spec. Stretch goals only after the core works and is tested.
- Stay inside the module folder you work on. If another contract is wrong, report it.
- No secrets in the repository. Only the development values documented in Infra Files.
- Log significant prompts in docs/PROMPTS.md. Read and understand generated code before it is merged.
- Merge to main only through a pull request.

## Definition of done (a service)
Every endpoint, rule and consumer on its API Spec page works. The tests listed on that page pass with one documented command. Seed matches the fixtures. The stub acceptance list passes (scripts/stub-check.sh). The service survives the failures listed for it on the Resilience Demo page.
