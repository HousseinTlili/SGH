# Handoff for Antigravity: build the SGH back end, integrate, finish the front end

Written 2026-10-17 by the project lead (Houssein). Read this file first, then `GUIDELINES.md` (the working rules), then work through the tasks in section 5 in order.

The specification is in Notion (read-only for you, see section 1). The decisions D21 to D32 in the Notion Decisions Log are final defaults. `docs/PLAN.md` (spec findings), `docs/MASTER-PLAN.md` (phases, requirements) and `docs/DOCTOR-PLAN.md` (the doctor module in detail) give the background. Do not re-plan: execute.

---

## 1. The Notion specification

Root page: **SGH - Hospital Management System (Microservices Project)**, https://app.notion.com/p/3f029a30745981808e7ce9464afe4cc6 (38 pages in total: this root, 17 overview pages and 20 specification pages).

**Rules for Notion:** read only. Never create, edit, move or delete a Notion page. If a page needs a change, write it in `docs/spec-changes.md` and tell the project lead. "docs/spec/" in any page or in GUIDELINES.md means "the Notion page with that title".

**Spec check at the start of every task:** re-read the pages the task names, compare each page's last-edited time with the table below, and report any difference before building. Times are UTC; the Decisions Log and the 13 pages marked (+) were extended on 2026-10-17 with an "Addendum (17 October 2026)", so their time is later than in the older table of `docs/PLAN.md`.

Key pages, in the order you will need them:

| Page | URL |
|------|-----|
| Claude Code Playbook | https://app.notion.com/p/3f129a3074598104b912c4b5fcce09aa |
| Build Prompts by Phase (the owner prompt applies to every module) | https://app.notion.com/p/3f129a307459818aa432d0251a1fa8f6 |
| Decisions Log (+) (D9 to D32) | https://app.notion.com/p/3f029a30745981928ccbd2449ff47088 |
| Domain Model and Business Rules (+) (rule ids PAT, REC, CON, LAB, PHA, STF, X-1 to X-9) | https://app.notion.com/p/3f129a307459817b8b91e35fe49d4207 |
| Seed Data and Fixtures (+) (exact ids) | https://app.notion.com/p/3f129a307459817fa9cef0cc0f4efd6f |
| API Contracts and Conventions (+) | https://app.notion.com/p/3f029a30745981ba9611e41052bebcb0 |
| Event Catalogue (RabbitMQ) (+) | https://app.notion.com/p/3f029a30745981aa8a9be7cfdf207640 |
| Stack Templates (+) | https://app.notion.com/p/3f129a307459816d87edde8b6bdbf924 |
| Infra Files (+) | https://app.notion.com/p/3f129a30745981dbaebef18f8db1734f |
| Keycloak Setup (+) | https://app.notion.com/p/3f129a30745981d78966cf47cc80219f |
| Gateway Config (+) and API Gateway and Security | https://app.notion.com/p/3f129a307459810788d2d9ce6db3a93a and https://app.notion.com/p/3f029a30745981898145c5973ab68bf7 |
| Patient Service - API Spec | https://app.notion.com/p/3f129a30745981a28d52e531c9c16ab7 |
| Reception Service - API Spec | https://app.notion.com/p/3f129a30745981c0abe6c64992b68791 |
| Consultation Service - API Spec (+) (implemented by doctor-service) | https://app.notion.com/p/3f129a3074598158badce47e73e9f5dd |
| Lab Service - API Spec | https://app.notion.com/p/3f129a307459818aa69ffe61d357a2e9 |
| Pharmacy Service - API Spec (+) | https://app.notion.com/p/3f129a30745981afa320cbb911c3b216 |
| Staff Service - API Spec | https://app.notion.com/p/3f129a307459814e99fdc53668394d0f |
| Local Setup (+) | https://app.notion.com/p/3f029a307459814b9d1ae3347581b3ca |
| End-to-End Scenarios (curl) (+) | https://app.notion.com/p/3f129a30745981b89dddd8866ebc8ea3 |
| Resilience Demo | https://app.notion.com/p/3f029a307459818db329d7767fd3ed01 |
| Testing and Quality | https://app.notion.com/p/3f029a30745981659085c66fa77cb0a2 |
| Deliverables and Defence | https://app.notion.com/p/3f029a30745981618730f5f6799366c9 |
| Angular - Architecture and Shared Code | https://app.notion.com/p/3f129a30745981f98847d63bec51d8b9 |
| Angular - Screens A (Layout, Patients, Reception, Staff) | https://app.notion.com/p/3f129a30745981c8baebcd16dbc208b8 |
| Angular - Screens B (Consultation, Lab, Pharmacy, Patient portal) (+) | https://app.notion.com/p/3f129a30745981b6b0d4c7f257046df3 |
| Angular - Mock API | https://app.notion.com/p/3f129a307459811e886cf366da1a4db1 |

Precedence when pages disagree: Domain Model and Business Rules > the service's API Spec > Seed Data > API Contracts and Event Catalogue > Infra Files, Keycloak Setup, Gateway Config, Stack Templates > Angular pages > Decisions Log > older overview pages. If still unclear, stop and ask.

---

## 2. What exists today (verified on 2026-10-17)

Branch `feature/platform` (local, built on `feature/doctor-polish`) contains everything below. Module branches `patient-service`, `reception-service`, `doctor-service`, `lab-service`, `pharmacy-service`, `staff-service` exist on GitHub (`HousseinTlili/SGH`) at the old `main` commit; they do not have the platform work yet.

| Path | State |
|------|-------|
| `frontend/` | Angular 22 app, zoneless, Material, Vitest. Built: shell, auth (mock sign-in, real Keycloak not yet), patients, reception, staff, consultation workspace and vitals, lab results, lab request detail (read only), prescription queue and detail (read only). **Not built:** lab queue, lab technician actions (start, enter results, validate), pharmacy dispensing panel, drugs and stock, stock alerts, patient portal, real Keycloak login. 266 unit tests pass. See `docs/FRONTEND-DECISIONS.md`. |
| `tools/mock/` | Prism servers (8081 to 8086) and a mock gateway (8080) for the front end. Specs in `tools/mock/specs/`. |
| `contracts/openapi/*.yaml` | Six contracts, complete, lint clean (`npx @redocly/cli lint contracts/openapi/*.yaml`). Source of truth for every API (D24). |
| `contracts/events/*.json` | Envelope and six payload JSON Schemas. `contracts/conventions.md` is a one-page summary. |
| `infra/` | `docker-compose.yml` (Postgres 16.15, RabbitMQ 4.3.6-management, Keycloak 26.8.1), `postgres/init.sql` (six databases), `rabbitmq/` (definitions and conf), `keycloak/sgh-realm.json` (7 roles, 3 clients, 9 users). **Never run**: Docker was not usable yet. |
| `scripts/` | `token.sh`, `token.ps1`, `health.sh`, `reset.sh`, `check-contracts.sh`. Missing: `stub-check.sh`, `e2e.sh`. |
| `services/<module>/` | Only `README.md` and `CLAUDE.md` per module. **No back-end code exists.** `gateway/` does not exist. |
| Notion | Decisions D21 to D32 and addenda applied on 2026-10-17. |

**Machine** (Windows 11, Git Bash is the shell for `scripts/*.sh`; also PowerShell): Node 24.19, npm, Git, JDK 17.0.20, Python 3.12.10, curl, winget, jq (installed at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\jqlang.jq_Microsoft.Winget.Source_8wekyb3d8bbwe\jq.exe`; add it to PATH in the shell you use), Edge. Docker Desktop 4.95 was installed but **WSL2 and the Docker engine may not be running yet**: task T0 checks it. 504 GB free disk, 23.7 GB RAM, all SGH ports free. Maven and Gradle are not installed (use the Spring wrapper). No .NET.

---

## 3. Working rules (in addition to CLAUDE.md)

1. **One task, one branch, one pull request.** Never push to `main`; never merge to `main` yourself. Commit messages `<area>: what`. Every commit keeps `main`-style health: tests pass.
2. **Evidence or it did not happen.** After each step run the command and show its real output. Never write "works" about something you did not run. Report failures honestly.
3. **Contracts first.** `contracts/openapi/*.yaml` is the source of truth. If a contract is wrong, fix the contract (and tell the lead which Notion page to change), then the code. A service's `openapi.yaml` is a byte-identical copy, checked by `scripts/check-contracts.sh`.
4. **Use the exact seed ids** of Seed Data and Fixtures. Never invent ids. Development password `Sgh@dev2026`.
5. **No secrets in the repo.** Only the development values of Infra Files. `.env` is git-ignored; commit `.env.example`.
6. **Tests with every behaviour.** Each rule id (PAT-n, REC-n, CON-n, LAB-n, PHA-n, STF-n, X-n) is cited in a test name or a comment. After writing tests, break the code on purpose once to prove a test fails.
7. **Small steps, stop when blocked.** If the spec is ambiguous, pick the simplest reading and write it in `docs/SERVICE-DECISIONS.md`; stop and ask only for decisions that are hard to undo.
8. **Log significant prompts** in `docs/PROMPTS.md` (context, prompt, output used, verification, corrections, decision). The course requires every member to understand the code that is merged.
9. **Git Bash for scripts**, line endings LF for `*.sh` (`.gitattributes`). On Windows set `git config core.autocrlf` as you like; never commit CRLF in shell scripts.
10. **Stay in your folder.** A module task edits only `services/<module>/` (plus `docs/`). Shared parts (`infra/`, `contracts/`, `scripts/`, `gateway/`, `frontend/`) change only in their own task.

---

## 4. Git flow

```
main  <-- PR <-- feature/platform                      (already built: skeleton, infra, contracts)
main  <-- PR <-- <module>-service                      (one per module)
main  <-- PR <-- feature/gateway, feature/scripts, feature/frontend-*, feature/integration, feature/docs
```
Start every module branch by bringing in the platform work:
```
git checkout patient-service        # or the module you build
git merge --no-ff feature/platform  # fast-forward is fine; the module branches are ancestors
```
Push a branch only when the task's acceptance checks pass, and open a PR. The lead reviews.

---

## 5. Tasks, in order

Each task lists: spec pages (read first), what to create, acceptance commands, dependency, effort (focused hours), risk. Do the **spec check** (section 1) first.

### T0. Environment check (0.5 h)
- Commands: `docker --version`, `docker compose version`, `docker run --rm hello-world`, `wsl --status`, `jq --version` (with PATH set), `node --version`, `java -version`, `python --version`.
- If Docker is missing or the engine is not running: stop and tell the lead exactly what is missing (WSL2 install needs an admin PowerShell and a reboot; Docker Desktop must be started once and its terms accepted). Do not try to work around it with other databases.

### T1. Infra up and Keycloak realm verified (5-10 h, risk HIGH)
Pages: Infra Files, Keycloak Setup, Decisions Log D27 to D29, Event Catalogue.
- `docker compose -f infra/docker-compose.yml up -d` then `docker compose -f infra/docker-compose.yml ps`.
- Postgres: `docker exec sgh-postgres psql -U sgh -c "\l"` lists the six `sgh_*` databases.
- RabbitMQ: `curl -s -u sgh:sgh_dev_password http://localhost:15672/api/queues` lists `lab.lab.request.created`, `pharmacy.prescription.created`, `consultation.lab.result.ready`, `sgh.events.dlq`; `.../api/exchanges/%2F/sgh.events` exists. If `load_definitions` or the default user conflicts, fix `infra/rabbitmq/*` (this file was never run).
- Keycloak: `curl -s -o /dev/null -w '%{http_code}' http://localhost:8180/realms/sgh` is 200. Run the 7 verification steps of Keycloak Setup. **The decisive check:** `./scripts/token.sh doctor1` decoded (payload = second part, base64url) must show `iss` = `http://localhost:8180/realms/sgh`, `realm_access.roles` containing DOCTOR, `staffId` = `b2b2b2b2-0000-4000-8000-000000000001`, `preferred_username` = `doctor1`; `patient1` must carry `patientId` = `a1a1a1a1-0000-4000-8000-000000000001`; `admin1` must carry a `staffId`. Also: a client-credentials token for `sgh-reception-svc` (secret `sgh_reception_dev_secret`) carries the role RECEPTIONIST; a wrong password fails; the JWKS URL returns keys; restarting the container keeps the realm.
- If `staffId` or `patientId` is missing: fix `infra/keycloak/sgh-realm.json` (user profile declaration or `unmanagedAttributePolicy`, check the documentation of the Keycloak version in use), re-import (`./scripts/reset.sh`), retest. Write the working syntax in `docs/keycloak-notes.md`.
- Finish with `./scripts/reset.sh` working end to end. Branch `feature/infra`, PR.

### T2. patient-service: the reference service (20-32 h, risk HIGH)
Pages: Patient Service - API Spec, Domain Model (PAT-1 to PAT-8, X-1 to X-9), Seed Data (patients, medical file), Stack Templates (Spring Boot), Build Prompts (owner prompt), Decisions Log. Contract: `contracts/openapi/patient.yaml` (copy it to `services/patient-service/openapi.yaml`).
- Stack: Spring Boot 4.1.x, Java 17, Maven wrapper (create with start.spring.io: web, validation, data-jpa, postgresql, flyway, oauth2-resource-server, springdoc, test), Testcontainers for Postgres in tests.
- Port 8081, DB `sgh_patient`: `patients`, `medical_file_entries`, `processed_events`. 9 operations of the contract. Seed: 8 patients and 4 medical file entries, idempotent.
- **The pattern every other service copies:** (a) HTTP server starts when Postgres is down; Hikari `initialization-fail-timeout=-1`; Flyway and seed run from a background retry loop (1, 2, 4, 8, 16, 30 s) and set a ready flag; database-backed endpoints answer 503 `Database unavailable` until ready (X-8); (b) `/health` is its own handler returning `{ "status": "UP" }`, never the actuator database indicator; (c) JWT validated with lazy JWKS and an issuer validator for `http://localhost:8180/realms/sgh`; roles read from nested `realm_access.roles`, keep only the seven SGH roles; (d) role checks run before body validation (a NURSE posting a patient gets 403, not 422); (e) shared error body with `correlationId`; `X-Correlation-Id` created when missing and echoed; (f) paging helper; (g) request log line without tokens (X-7); (h) Swagger UI `/docs`, `/openapi.json` serving the contract.
- Tests: the 10 groups of the API Spec page ("Tests that must exist"), plus: service starts with Postgres stopped and `/health` is 200, data call 503, then recovers after Postgres starts.
- Acceptance: test command passes (`./mvnw test`); `T=$(./scripts/token.sh reception1); curl -s -H "Authorization: Bearer $T" http://localhost:8081/api/patients | jq .totalElements` prints 8; PATIENT token for P1 reading P2 returns 403; `./scripts/check-contracts.sh` clean; the "Checks after seeding" line for patients. Branch `patient-service`, PR.

### T3. scripts/stub-check.sh (3-5 h, risk low)
Pages: Stack Templates section 3 and Decisions Log D25. Black-box checks for the 10 stub acceptance items plus `GET /api/_stub/ping` (ADMIN only). Usage `./scripts/stub-check.sh <port> <service-name>`. It must pass against patient-service. Branch `feature/scripts`.

### T4. gateway (14-24 h, risk medium-high)
Pages: Gateway Config, API Gateway and Security, Keycloak Setup, API Contracts, Decisions Log D10, D11, D29. Folder `gateway/`, Spring Cloud Gateway WebFlux (starter `spring-cloud-starter-gateway-server-webflux`, property prefix `spring.cloud.gateway.server.webflux`).
- Route table and coarse role rules as data. JWT validation, CORS only for `http://localhost:4200`, correlation id, structured 503 with the service name, `GET /health`, `GET /gateway/health/services` (1 s timeout, 2 s cache, parallel calls), starts with every service down.
- Tests: the 9 tests of Gateway Config using stub servers. Acceptance: 401 without token on `/api/patients`; NURSE on `/api/drugs` is 403; a stopped Patient gives 503 with `"service":"patient"` and the status endpoint shows `patient: DOWN` within 3 seconds while the others stay UP.

### T5 to T9. The other modules (read the module section; each follows the owner prompt of Build Prompts)
Order and reason: staff (Reception and the front end need the directory), doctor (core flow), lab, pharmacy, reception. Each module: start from the platform branch, create the stub and pass `scripts/stub-check.sh`, then implement the full API Spec page, then the tests, then the README and PR.

- **T5 staff-service** (Spring Boot, 8086, `sgh_staff`; 10-16 h): Staff Service - API Spec; STF-1 to STF-5; endpoints staff CRUD (ADMIN), deactivate, **`/api/staff/directory` declared before `/api/staff/{id}`**, `/{id}/public`, `/api/roles`, `/api/me` (roles filtered to the seven; staff matched by the `staffId` claim; patient users get `patientId` and staff null). Seed: 7 staff. Tests: 8 groups.
- **T6 doctor-service** = Consultation (Express 5 + TypeScript, `pg` with `node-pg-migrate`, `jose`, `zod`, `amqplib`, pino, vitest + supertest; 8083, `sgh_consultation`; 25-40 h): full detail in `docs/DOCTOR-PLAN.md` sections 3 and 4 (track B). Rules CON-1 to CON-10. Publishes `lab.request.created` and `prescription.created` from a background queue after commit (3 retries, never delaying the response); consumes `lab.result.ready` from `consultation.lab.result.ready` idempotently. Patient call with 2 s timeout and `patientSnapshot = null` fallback. `PUT` is a partial update (D30). PHARMACIST may only GET prescriptions (D20). Tests: the 10 groups of the API Spec.
- **T7 lab-service** (FastAPI, SQLAlchemy 2 + Alembic, PyJWT PyJWKClient, aio-pika, pytest + httpx; 8084, `sgh_lab`; 15-25 h): Lab Service - API Spec; LAB-1 to LAB-8; consume `lab.request.created` idempotently (dead-letter on a malformed payload); flag computation with decimals (worked examples on the page); publish `lab.result.ready` after commit without rolling back validation on failure. Seed: catalogue of 6 tests, L1 and L2. Tests: 9 groups including "stop, publish, start, request appears".
- **T8 pharmacy-service** (Express 5 + TypeScript, same libraries; 8085, `sgh_pharmacy`; 18-28 h): Pharmacy Service - API Spec; PHA-1 to PHA-9; dispensing in one transaction with row locking; `status` filter accepts a comma-separated list (D31); consult `GET /api/consultations/{id}/prescriptions` with the caller's token (fallback to the local copy). Seed: 10 drugs, copy R1. Tests: 10 groups including two parallel dispenses of the last units.
- **T9 reception-service** (NestJS 12 + TypeORM, `@nestjs/schedule`, amqp-connection-manager; 8082, `sgh_reception`; 25-40 h): Reception Service - API Spec; REC-1 to REC-15; overlap check with the index on `(doctor_id, start_at, end_at)`; availability 08:00 to 17:00 UTC in 30-minute slots; invoices with server-computed total; reminders job every 60 s; verification job every 60 s using the **client credentials of `sgh-reception-svc`** (D28); publishes `appointment.created` and `appointment.cancelled`. Seed: 4 appointments, 2 invoices. Tests: 13 groups.

Each module's acceptance: its test command passes; `./scripts/stub-check.sh <port> <name>` passes; `./scripts/check-contracts.sh` clean; seed check line from Seed Data; the service starts with Postgres and RabbitMQ stopped and recovers; the failures of its row in Resilience Demo.

### T10. Front end completion (35-55 h, risk medium)
Pages: Angular - Architecture, Screens A, Screens B, Mock API; `docs/FRONTEND-DECISIONS.md` (decisions F-1 to F-24 and findings S-1 to S-9). Work in `frontend/` on branch `feature/frontend-*`.
- Build: lab queue `/lab/requests`; lab request actions for LAB_TECHNICIAN (start, enter results with computed flags, validate with confirmation listing critical values); pharmacy dispensing panel on `/pharmacy/prescriptions/:id` (stock check, confirmation); drugs and stock page with create, edit, adjust stock; stock alerts page; patient portal (`/my/appointments`, `/my/invoices`, `/my/consultations`); remove `FeaturePlaceholder` when the last placeholder goes; a resilience pass (each service stopped, only its own screens degrade).
- Real Keycloak login: add `keycloak-js`, a `KeycloakAuthBackend` implementing the existing `AuthBackend` interface (Authorization Code with PKCE S256, client `sgh-frontend`, `checkLoginIframe: false`, silent refresh when the token expires within 30 s); keep mock mode working; the roles come from `realm_access.roles` (seven only), `staffId` and `patientId` from claims.
- Switch from Prism to real services one at a time (stop its Prism port, start the real service on the same port, rerun the walk-through); fix drift by changing the contract, not the screen.
- Quality: `npm run lint`, `npm test`, `npm run build` pass; no `any`; no literal colours outside `src/styles/_tokens.scss`; remove the invented content on the login and landing pages (hospital name other than SGH, phone numbers, "accredited", fake telemetry) and the blue-green logo gradient; set Prettier `endOfLine: auto`.

### T11. Integration (15-28 h, risk HIGH)
Pages: End-to-End Scenarios (+), Event Catalogue, Resilience Demo, Testing and Quality. Create `scripts/e2e.sh` from scenarios 1 to 7 and 12 with a `check` helper printing PASS or FAIL per expectation and a summary; unique test-patient names per run; `reset.sh` before the full run. Run it, attribute every FAIL to a module and a rule id, fix in that module's branch. Acceptance: `./scripts/reset.sh` then start everything then `./scripts/e2e.sh` prints zero FAIL, twice in a row (with a reset between).

### T12. Resilience (6-14 h)
Scenarios 8 to 11 by hand plus every row of the Resilience Demo table (Reception, Pharmacy, Staff, Keycloak and the gateway starting with all services stopped). Record results in `docs/resilience-results.md` with the commands and what you saw.

### T13. Documentation and defence (8-14 h)
Pages: Deliverables and Defence, Decisions Log. Complete `README.md` (sections already outlined), `docs/architecture.md` (Mermaid: front end, gateway, six services with stacks and databases, Keycloak, RabbitMQ; solid arrows REST, dashed arrows events), `docs/technical-choices.md` (answers to the justification list), `docs/PROMPTS.md`, a committed spec snapshot `docs/spec/` with a table of last-edited times, Postman collection per service folder, `.env.example` and `openapi.yaml` per service.

---

## 6. Known traps (read before coding)

- **Spring Boot:** Flyway or Hikari failing at startup kills the app when Postgres is down; use the background loop (X-8). The actuator database health indicator makes `/health` 503; write the endpoint yourself. Use `jwk-set-uri` plus an issuer validator, not an eager `issuer-uri`. Spring Cloud Gateway 5 renamed its starter and properties (see T4).
- **Keycloak:** custom attributes disappear unless declared in the user profile or unmanaged attributes are enabled; the issuer is always `http://localhost:8180/realms/sgh` (a token fetched through `127.0.0.1` is rejected); tokens contain extra roles (`default-roles-sgh`, `offline_access`, `uma_authorization`): filter to the seven.
- **RabbitMQ:** queue and exchange arguments must be identical everywhere (`x-dead-letter-exchange: sgh.events.dlx`, classic queues) or the broker answers PRECONDITION_FAILED. A message published before a queue exists is lost, which is why the topology is pre-declared. Ack only after the effect and the `eventId` are saved in one transaction.
- **Async publish:** publishing with retries inside the request adds seconds of delay; publish from a background task.
- **Order of checks:** authenticate (401), authorize by role (403), then validate (422), then business rules (409).
- **Routes:** `/api/staff/directory` before `/api/staff/{id}`; `/api/appointments/availability` before `/api/appointments/{id}`.
- **Prism (front end mocks):** answers the first example, is stateless, returns 401 without a bearer token; use `Prefer: code=409` for error examples; http-proxy-middleware v3 does not strip the mount path.
- **Windows:** `jq` is not on PATH in already-open shells; use Git Bash for `*.sh`; `docker compose` paths use forward slashes; CRLF in shell scripts breaks them.
- **Seed timestamps** are relative to each service's first start: start all services on the same day after `reset.sh`.
- **E2E script** is not re-runnable unless names are unique and the data is reset.

---

## 7. Unverified items to prove (list them as you close them)

Keycloak realm import and the `staffId`/`patientId` claims; RabbitMQ `definitions.json` loading with the default user; the compose file itself; the Spring Boot 4.1 startup-without-database pattern; Spring Cloud Gateway 5 routes and error mapping (connection refused to 503); the whole event flow Doctor to Lab to Doctor and Doctor to Pharmacy; the Reception service-account token; real-token behaviour of the front end (`staffId` drives the doctor ownership rule); everything in the Resilience Demo table. Nothing in the repository has ever run against a real back end.

---

## 8. Definition of done (whole project)

Map to the success criteria of the Notion root page and **Deliverables and Defence**: six services start with one documented command each; Angular logs in through Keycloak and reaches every service through the gateway; at least three technologies (here four); one database per service; Swagger on every service; REST and RabbitMQ both work end to end (`e2e.sh` zero FAIL); stopping any one service leaves the others working (Resilience Demo rows tested for real); JWT with roles protects the API (401, 403, 200 proven); README, architecture diagram and PROMPTS.md present; tests and their commands documented; fresh-clone run from the README succeeds.

---

## 9. How to report after each task

1. What you built (files and folders). 2. Commands run and their real output (not a summary). 3. Checks that passed and checks that failed or were not run. 4. Anything in the spec or contract that looked wrong, with page name and exact text. 5. The branch and the PR. 6. What the next task needs from the lead.
