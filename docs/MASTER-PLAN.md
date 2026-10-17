# SGH master plan: six modules, shared parts, requirements

Written 2026-10-17. Supersedes the phase list of `docs/PLAN.md` where they differ; `docs/DOCTOR-PLAN.md` is the detailed view of the doctor module inside this plan.
Page titles in brackets are Notion pages. **UNVERIFIED** = never run by anyone. Numbers marked "est." are estimates, not measurements.

---

## 0. Where things stand

**Notion (checked 2026-10-17):** all 38 pages present, none changed since 2026-10-06 (compared at minute precision). The spec is complete enough to build from, but has the gaps and contradictions listed in `docs/PLAN.md` section 3. I wrote the fixes as decisions D21 to D32 and as page addenda in **`docs/NOTION-ADDENDA.md`**. **I could not apply them: the Notion connection refused my write.** Until they are in Notion (you paste them, or you allow the write and I apply them), this plan treats D21 to D32 as the working rules and flags every place that depends on one.

**Repository today:** `main` and the six module branches (`patient-service`, `reception-service`, `doctor-service`, `lab-service`, `pharmacy-service`, `staff-service`) are at the same commit. Contents: the Angular app (`frontend/`, with the doctor, patient, reception, staff screens; Lab, Pharmacy and portal screens are partly or not built), `tools/mock/` (Prism and a mock gateway), docs. **No backend of any kind exists** (no `services/`, `infra/`, `contracts/`, `gateway/`, `scripts/`). My doctor work and `docs/*PLAN*.md` are local, not pushed.

---

## 1. Target layout: one folder per module, shared parts beside them

```
.                                  repository root = project root
  CLAUDE.md  README.md  CODEOWNERS  .gitattributes  .gitignore
  contracts/openapi/*.yaml         SHARED: 6 API contracts (source of truth, D24)
  contracts/events/*.json          SHARED: event envelope + 6 payload schemas
  infra/                           SHARED: docker-compose.yml, postgres/init.sql, rabbitmq/, keycloak/sgh-realm.json
  gateway/                         SHARED: Spring Cloud Gateway, port 8080
  frontend/                        SHARED: the one Angular app, port 4200
  tools/mock/                      SHARED: Prism mocks + mock gateway (exists)
  scripts/                         SHARED: token.sh, health.sh, reset.sh, e2e.sh, check-contracts.sh, stub-check.sh
  docs/                            SHARED: plans, spec snapshot, architecture, PROMPTS.md
  services/
    patient-service/               module 1   Spring Boot   8081  sgh_patient
    reception-service/             module 2   NestJS        8082  sgh_reception
    doctor-service/                module 3   Express (TS)   8083  sgh_consultation   (Service 3 "Consultation", D21)
    lab-service/                   module 4   FastAPI       8084  sgh_lab
    pharmacy-service/              module 5   Express (TS)   8085  sgh_pharmacy
    staff-service/                 module 6   Spring Boot   8086  sgh_staff
```

Every service folder holds the same things: `README.md`, `.env.example`, `openapi.yaml` (copy of the contract), source, migrations, seed, tests, `CLAUDE.md`. Stacks are the defaults of D22 (change them before work starts on a module; four distinct technologies cover the "at least three" criterion).

**Branch and ownership:** each module is built on its own branch (same name as the folder) and merged to `main` by pull request, one reviewer other than the author ([GitHub Workflow]). Shared parts are built on `feature/<area>-<topic>` branches by the project lead. CODEOWNERS: lead owns `contracts/ infra/ gateway/ scripts/ tools/ docs/ frontend/`; each module folder is owned by its owner.

---

## 2. What I need: machine, disk, internet, permissions

### 2.1 This machine (measured today)

| Item | Found | Needed | Verdict |
|------|-------|--------|---------|
| Free disk, C: | **504 GB** of 953 GB | est. 25 GB (see 2.3) | plenty |
| RAM | **23.7 GB** | est. 10 to 12 GB with everything running | enough; limit WSL2 to 8 GB |
| CPU | i7-13650HX, 14 cores | any 4+ cores | enough |
| Virtualization | enabled in firmware, SLAT yes | required for WSL2 and Docker | OK |
| OS | Windows 11 Pro, build 26300 | Windows 10 22H2 or 11 | OK |
| Free ports | 4200, 5432, 5672, 15672, 8080 to 8086, 8180 all free | same | OK |
| Present | Node 24.19, npm, Git 2.55, JDK 17.0.20, Python 3.12.10, curl, winget, Edge | all of these | OK |
| Missing | **Docker, WSL2 (not installed), jq** | Docker and WSL2 mandatory, jq for the E2E script | to install |
| Not needed | .NET SDK, Maven or Gradle on PATH (the Spring wrapper downloads Maven), psql (use `docker exec`) | | skip |

### 2.2 Internet (tested today)

Reachable: npm registry, Maven Central, start.spring.io, Docker Hub, Quay, GitHub, Microsoft registry. Measured about **1.6 MB/s** on a small file (about 13 Mbit/s); **PyPI was slow (15 s for one request)**, so Python installs may need retries. At 1.6 MB/s the downloads below (est. 3 GB) take about **30 to 40 minutes** in total. A stable connection is needed during installs; after the first install, work is offline except `git push` and Notion.

### 2.3 Downloads and disk (est.)

| What | Download | Disk after | When |
|------|----------|------------|------|
| WSL2 platform update | about 100 MB | about 1 GB | first, needs admin and a reboot |
| Docker Desktop | about 600 MB | about 4 GB | needs admin, license acceptance by you |
| Docker images: postgres:16, rabbitmq:4-management, keycloak 26.x | about 600 MB | about 1.5 GB (Docker disk grows to about 10 GB over time) | first `docker compose up` |
| jq | 1 MB | 1 MB | any time |
| Spring Boot: Maven wrapper plus dependencies for 3 JVM projects (patient, staff, gateway) | about 500 MB | about 800 MB in `~/.m2` (shared) | modules 1, 6, gateway |
| Node: reception (NestJS), doctor, pharmacy (Express) | about 600 MB | about 1 GB | modules 2, 3, 5 |
| Python venv for FastAPI (lab) | about 150 MB | about 250 MB | module 4 |
| **Total** | **about 3 GB** | **about 20 to 25 GB** | |

### 2.4 Permissions I need from you

| Needed | Why | Who does it |
|--------|-----|-------------|
| **Allow Notion writes** (or paste `docs/NOTION-ADDENDA.md` yourself) | the spec gaps (D21 to D32) must live in the source of truth | you |
| **Admin rights and one reboot** for WSL2 and Docker Desktop | containers for Postgres, RabbitMQ, Keycloak | you run `wsl --install --no-distribution` in an admin PowerShell, reboot, then `winget install -e --id Docker.DockerDesktop` and accept the license (free for students and education) |
| OK to run `winget install -e --id jqlang.jq` (1 MB) | E2E script needs it | me, after your yes |
| OK to download Maven, npm and PyPI packages into the repo and caches | the services' dependencies | me, after your yes |
| OK to push module branches and open pull requests | work becomes visible to teammates | me, per push, after your yes |
| **A decision on stacks (D22) and the open questions in section 8** | cannot guess | you |

I did **not** install anything today. Installing system software and accepting licenses is yours to approve.

---

## 3. Phases (shared parts first, then modules, then integration)

Effort is focused hours with Claude Code typing and you verifying. Risk is the chance the phase needs rework. "Branch" says where it is built.

| Phase | Goal | Branch | Hours | Risk |
|-------|------|--------|-------|------|
| **S0** | Spec check, apply Notion addenda, push my local work (plans, doctor polish) | `feature/docs-plans` | 1-2 | low |
| **S1** | Installs: WSL2, Docker Desktop, jq (section 2) | none | 2-4 plus about 40 min download | medium (admin, reboot) |
| **S2** | Repository skeleton: layout above, CLAUDE.md, CODEOWNERS, `.gitattributes`, `.editorconfig`, PROMPTS.md, per-module README and CLAUDE.md | `feature/skeleton` | 2-4 | low |
| **S3** | Infra: compose with Postgres (six databases), RabbitMQ with `definitions.json`, Keycloak; `token.sh/.ps1`, `health.sh`, `reset.sh` | `feature/infra` | 5-10 | medium |
| **S4** | Keycloak realm: seven roles, clients `sgh-frontend`, `sgh-dev-cli`, `sgh-reception-svc`, eight users, claim mappers; verified by decoding tokens | `feature/infra` | 5-10 | **high** (first run of the realm JSON) |
| **S5** | Contracts: six OpenAPI files with seed-based examples, event JSON Schemas, conventions, `check-contracts.sh`, lint with Redocly | `feature/contracts` | 12-20 | medium |
| **S6** | Patient (module 1), the reference service: sets the pattern for X-6/X-8, JWT, errors, paging, health | `patient-service` | 20-32 | **high** |
| **S7** | Gateway: routes as data, JWT, coarse roles, CORS, correlation id, 503 body, `/gateway/health/services` | `feature/gateway` | 14-24 | medium-high |
| **S8** | Stub checker `scripts/stub-check.sh` (10 checks plus `/api/_stub/ping`) | `feature/scripts` | 3-5 | low |
| **M2 to M6** | The other five modules (section 4), each started from a stub that passes S8 | `<module>-service` | see section 4 | medium |
| **F5 to F8** | Finish the front end: Lab, Pharmacy (incl. dispensing), Staff, portal, resilience pass; real Keycloak login | `feature/frontend-*` | 35-55 | medium |
| **I1** | Integration: `scripts/e2e.sh` (scenarios 1 to 7 and 12), fix failures in the owning module | `feature/integration` | 15-28 | **high** |
| **I2** | Resilience: scenarios 8 to 11 by hand and the per-row table of [Resilience Demo] | `feature/integration` | 6-14 | medium |
| **D1** | Documentation: README, architecture diagram (Mermaid), technical choices, PROMPTS.md complete, spec snapshot | `feature/docs` | 8-14 | low |

**Order and dependencies**

```
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 (Patient) -> S7 (Gateway) -> S8 -> M2..M6 (parallel, one per branch)
                                                              \-> F5..F8 (against mocks, then real services)
M2..M6 + F5..F8 -> I1 -> I2 -> D1
```
S0 to S2 need no installs. S3 onward need Docker. The front end (F5 to F8) and the pure-unit-test part of every module can progress without Docker, so work is never fully blocked.

**Total effort (focused hours):** shared parts about 90 to 150; the six modules about 110 to 180; front end 35 to 55; integration, resilience and docs 29 to 56. **Overall about 265 to 440 hours.** This is many weeks of work, not one sitting; the plan is built so each phase ends with something that runs and is committed.

---

## 4. The six modules

Each module follows the owner order from [Build Prompts by Phase]: 1 models, migrations, seed; 2 read endpoints; 3 write endpoints with rules; 4 events; 5 outgoing calls with fallbacks; 6 the tests listed on its API Spec page; 7 README. All share the behaviours of [Stack Templates] section 1: `/health` without token, `/docs` and `/openapi.json`, JWT via JWKS (lazy), roles from `realm_access.roles`, shared error body, correlation id, paging, 2 s outgoing timeout, `processed_events` table, X-6/X-8.

### Module 1: patient-service (Spring Boot 4.1, JDK 17, Flyway, JPA, springdoc)
- Port 8081, DB `sgh_patient`: `patients`, `medical_file_entries`, `processed_events`.
- 9 endpoints: list/search, get, create, update, soft delete, summary, medical file list and add note, health. Rules PAT-1 to PAT-8. Seed: 8 patients, 4 file entries ([Seed Data]).
- No events, no outgoing calls. Tests: the 10 groups of [Patient Service - API Spec] (duplicate case-insensitive 409, future birth date 422, PATIENT own record only 403, soft delete invisible).
- Spring traps to handle: do not let Hikari or Flyway stop startup when Postgres is down (D26); `/health` as its own handler; roles from nested `realm_access.roles`.
- Hours 20-32. This is the pattern for the others.

### Module 2: reception-service (NestJS 12, TypeORM, `@nestjs/schedule`, amqp-connection-manager)
- Port 8082, DB `sgh_reception`: `appointments`, `invoices`, `invoice_lines`, `reminders`, `processed_events`; index on `(doctor_id, start_at, end_at)`.
- Endpoints: appointments (list, get, create, update, check-in, complete, cancel, availability), invoices (list, get, create, pay, cancel). Rules REC-1 to REC-15 (overlap 409, status moves, server-computed total, 08:00 to 17:00 UTC slots).
- Events published: `appointment.created`, `appointment.cancelled` after commit. Outgoing: Patient summary (404 gives 422, outage gives `patientVerified=false`), Staff `/public` (outage skips). Jobs every 60 s: re-verify patients with the `sgh-reception-svc` token (D28), create mock reminders.
- Tests: 13 groups of [Reception Service - API Spec]. Hours 25-40.

### Module 3: doctor-service = Consultation (Express 5 with TypeScript, `pg` with `node-pg-migrate`, `jose`, `zod`, `amqplib`, pino, vitest and supertest)
- Port 8083, DB `sgh_consultation`: `consultations`, `vital_signs`, `prescriptions`, `prescription_items`, `lab_orders`, `lab_order_tests`, `lab_result_copies`, `processed_events`.
- Endpoints, rules CON-1 to CON-10, events (`lab.request.created`, `prescription.created` published; `lab.result.ready` consumed from queue `consultation.lab.result.ready`), the Patient-summary fallback and the 10 minimum tests are listed in full in `docs/DOCTOR-PLAN.md` section 3 and 4 (track B). Hours 25-40.

### Module 4: lab-service (FastAPI 0.143, SQLAlchemy 2 with Alembic, PyJWT, aio-pika, pytest and httpx)
- Port 8084, DB `sgh_lab`: `test_catalogue`, `lab_requests`, `lab_request_tests`, `lab_results`, `processed_events`. Seed: six tests, requests L1 and L2.
- Endpoints: queue (URGENT first), get, start, results, validate, results list, tests. Rules LAB-1 to LAB-8, flag computation with decimals (worked examples in the API Spec).
- Consumes `lab.request.created` idempotently (dead-letter on bad payload); publishes `lab.result.ready` after commit without rolling back validation on failure. No outgoing calls.
- Tests: 9 groups including "service stopped, event published, service started, request appears". Hours 15-25.

### Module 5: pharmacy-service (Express 5 with TypeScript, same libraries as module 3)
- Port 8085, DB `sgh_pharmacy`: `drugs`, `prescription_copies`, `prescription_items`, `dispensings`, `dispensing_lines`, `processed_events`. Seed: 10 drugs (Amoxicillin low stock), copy R1.
- Endpoints: drugs (list, create, update, stock adjust), alerts, prescriptions (list with comma-separated status, get, dispense, dispensings). Rules PHA-1 to PHA-9; dispensing in one transaction with row locking.
- Consumes `prescription.created`; publishes `prescription.dispensed`. Outgoing: Consultation prescriptions with the caller's token (PHA-7, fallback to the local copy).
- Tests: 10 groups including two parallel dispenses of the last units. Hours 18-28.

### Module 6: staff-service (Spring Boot 4.1)
- Port 8086, DB `sgh_staff`: `staff_members`, `processed_events`. Seed: seven staff.
- Endpoints: staff CRUD (ADMIN), deactivate, **directory and public (route order: `directory` before `{id}`)**, roles, `/api/me`. Rules STF-1 to STF-5. No events, no outgoing calls.
- Tests: 8 groups. Hours 10-16. (Keycloak user creation is a stretch goal, out of scope.)

### Shared per-module deliverables
Postman collection per service, README with run and test commands, `.env.example`, contract copy checked by `scripts/check-contracts.sh`, one PR to `main` with the "Done when" list ticked with evidence.

---

## 5. Shared parts in detail

- **infra/** (S3, S4): compose file from [Infra Files] with the changes of D29; `init.sql` creates the six databases; `definitions.json` pre-declares exchange `sgh.events`, `sgh.events.dlx` (fanout), queue `sgh.events.dlq` and the consumer queues `lab.lab.request.created`, `pharmacy.prescription.created`, `consultation.lab.result.ready` (plus the stretch ones left out); Keycloak imports `sgh-realm.json`. Acceptance: `docker compose -f infra/docker-compose.yml up -d`, `docker compose ps`, `docker exec sgh-postgres psql -U sgh -c "\l"`, `curl -u sgh:sgh_dev_password http://localhost:15672/api/queues`, `./scripts/token.sh doctor1` decoded shows `iss`, `realm_access.roles`, `staffId`, `preferred_username`.
- **contracts/** (S5): written from the six API Spec pages; every example uses seed ids; `npx @redocly/cli lint contracts/openapi/*.yaml` must exit 0; `docs/contracts-coverage.md` maps each API Spec endpoint to its operation.
- **gateway/** (S7): Spring Cloud Gateway WebFlux; route table and role rules in configuration, not code; tests with stub servers (9 tests of [Gateway Config]).
- **frontend/**: finish Lab queue and request actions, Pharmacy dispensing and drugs/stock, Staff, portal; swap Prism for real services one at a time; real Keycloak login behind the existing `AuthBackend`.
- **scripts/** and **CI (optional, stretch)**: a GitHub Actions workflow running lint, tests and `check-contracts.sh` per folder gives each PR a green check; not required by the course.

---

## 6. Git workflow

1. `main` is protected (required PR review) in GitHub settings. I cannot change that setting; you do it once.
2. Shared work: `feature/<area>-<topic>` from `main`, PR to `main`. Module work: on `<module>-service`, PR to `main`; a module branch is merged only when its "Done when" list passes.
3. Commit messages `<area>: what` (for example `doctor: sign consultation`). Every significant prompt goes in `docs/PROMPTS.md`.
4. I push and open PRs only when you say so. I do not merge to `main` myself.

---

## 7. Risks (top ones)

1. Keycloak claims missing (S4); every ownership and role rule depends on them.
2. A service that cannot start without its database or broker (S6 sets the pattern; S8 checks it).
3. A first event lost because a queue did not exist yet (D27).
4. Docker or WSL2 install problems on this Windows machine (S1); mitigation: the front end and unit tests continue meanwhile.
5. Scope: about 265 to 440 hours. Mitigation: shared parts and Patient first, stretch goals out, each phase committed.
6. Teacher refusal or a mandatory Eureka/Spring-only rule. Mitigation: send the email in `docs/PLAN.md` section 4.1 before S6.
7. Notion edited while building: spec check at the start of every phase.
8. PyPI slowness during the Lab setup.

---

## 8. Questions and decisions I need

1. Allow Notion writes, or will you paste `docs/NOTION-ADDENDA.md`?
2. Confirm or change the stacks (D22). Do Reception, Lab and Pharmacy go to teammates (then I only build their stubs), or do you want me to build all six?
3. Docker: OK to proceed with the install steps in section 2.4?
4. Teacher: has the SGH question been sent? Eureka or static routes?
5. Repository: confirm that module work goes through PRs reviewed by you, and who the teammates' GitHub usernames are (CODEOWNERS).
6. Dates: the deadline and the Session 5 date, so hours become a calendar.
