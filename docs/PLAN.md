# SGH build plan (planning session, 2026-10-06)

Status: PLAN ONLY. Nothing has been built, installed or changed in Notion. Written by Claude Code from a read-only crawl of the Notion specification.
Citation style: **[Page title]** = the Notion page the claim comes from. **[web]** = checked against current public documentation during this session (sources at the end of section 3).
Anything marked **UNVERIFIED** has never been run by anyone.

---

## 1. Summary

At the end there will be, running locally with no deployment:

- Six independent services behind one gateway on 8080: Patient 8081, Reception 8082, Consultation 8083, Lab 8084, Pharmacy 8085, Staff 8086. Each uses its own Postgres database (`sgh_*`), and at least three different back-end technologies are used.
- One Angular app on 4200, built entirely by the project lead, that talks only to the gateway. Keycloak (8180) handles login and roles. RabbitMQ (5672/15672) carries the six events.
- REST calls with 2 s timeouts and fallbacks, plus idempotent event consumers, so the Resilience Demo works: stop Lab, Patient, Consultation or RabbitMQ and the rest keeps working.
- Contracts first: 6 OpenAPI files, event JSON Schemas, mock servers (Prism), seed data with fixed ids, `scripts/e2e.sh`, tests per service, README, architecture diagram, `docs/PROMPTS.md`.

Explicitly out of scope: any deployment or cloud; Eureka/service discovery (static routes, D10); an outbox table (D12, documented limit); creating or disabling Keycloak users from the Staff service; the patient-service event consumers; the consultation consumers of `appointment.*` / `prescription.dispensed`; the FHIR device endpoint in Lab; supplier orders in Pharmacy; Playwright E2E tests; high availability of the gateway (explained, not built). All are "stretch" in **[Domain Model and Business Rules]**, the API Spec pages and **[Event Catalogue (RabbitMQ)]**.

What I (the lead) personally build: skeleton, infra, Keycloak realm, contracts, Patient reference service, a gateway, five stubs (or stub checks, see Q4), mock servers, the whole Angular app, the integration script and the documentation. What I do **not** build: the business logic of Reception, Consultation, Lab, Pharmacy and Staff.

---

## 2. Sources read

### 2.1 Notion: complete tree, 38 of 38 pages readable

Crawled root, then all 20 children, then all 17 grandchildren. No page has deeper children. Counts match the brief: 17 overview pages + 20 specification pages + the root. No page is missing or unreadable.
Fetched 2026-10-06 between 14:41Z and 14:55Z. Last-edited time is Notion's `page_last_edited_at` (UTC).

**Observation (live spec):** several pages were edited only 1 to 5 minutes before I fetched them (API Gateway and Security 14:53:47Z, Screens A 14:53:45Z, Timeline 14:53:02Z, Service 1 to 6 overviews 14:51 to 14:52Z). The spec is still being changed while we plan. Every phase therefore starts with a spec check (section 5, "Spec check").

| # | Page | URL | Last edited (UTC) |
|---|------|-----|-------------------|
| 0 | SGH - Hospital Management System (root) | https://app.notion.com/p/3f029a30745981808e7ce9464afe4cc6 | 2026-10-06 14:51:50 |
| 1 | Service 1 - Patient | https://app.notion.com/p/3f029a3074598158971dfae459201c8a | 2026-10-06 14:51:58 |
| 2 | Service 2 - Reception | https://app.notion.com/p/3f029a307459818186e0d4b7089fdbf5 | 2026-10-06 14:52:02 |
| 3 | Service 3 - Consultation | https://app.notion.com/p/3f029a30745981f6a600c5683f95e33e | 2026-10-06 14:52:07 |
| 4 | Service 4 - Lab | https://app.notion.com/p/3f029a30745981c4a9e7e4a7b2a35c1a | 2026-10-06 14:52:12 |
| 5 | Service 5 - Pharmacy | https://app.notion.com/p/3f029a30745981a89a34d5e0b2bd97cf | 2026-10-06 14:52:17 |
| 6 | Service 6 - Staff and Access (+ API Gateway) | https://app.notion.com/p/3f029a307459816a88e8f7c46946b2b2 | 2026-10-06 14:52:21 |
| 7 | Angular Front End | https://app.notion.com/p/3f029a307459819ca642efa7a6f4cd5c | 2026-10-06 14:51:54 |
| 8 | API Gateway and Security | https://app.notion.com/p/3f029a30745981898145c5973ab68bf7 | 2026-10-06 14:53:47 |
| 9 | API Contracts and Conventions | https://app.notion.com/p/3f029a30745981ba9611e41052bebcb0 | 2026-10-06 14:52:48 |
| 10 | Event Catalogue (RabbitMQ) | https://app.notion.com/p/3f029a30745981aa8a9be7cfdf207640 | 2026-10-05 22:28:32 |
| 11 | Resilience Demo | https://app.notion.com/p/3f029a307459818db329d7767fd3ed01 | 2026-10-06 14:52:59 |
| 12 | Local Setup | https://app.notion.com/p/3f029a307459814b9d1ae3347581b3ca | 2026-10-06 14:52:52 |
| 13 | GitHub Workflow | https://app.notion.com/p/3f029a307459811896bbe75723d70253 | 2026-10-06 14:52:54 |
| 14 | Testing and Quality | https://app.notion.com/p/3f029a30745981659085c66fa77cb0a2 | 2026-10-06 14:52:56 |
| 15 | Timeline and Milestones | https://app.notion.com/p/3f029a3074598121b249c9a98c02fee1 | 2026-10-06 14:53:02 |
| 16 | Decisions Log | https://app.notion.com/p/3f029a30745981928ccbd2449ff47088 | 2026-10-06 14:51:05 |
| 17 | Deliverables and Defence | https://app.notion.com/p/3f029a30745981618730f5f6799366c9 | 2026-10-05 22:37:34 |
| 18 | Domain Model and Business Rules | https://app.notion.com/p/3f129a307459817b8b91e35fe49d4207 | 2026-10-06 14:41:29 |
| 19 | Seed Data and Fixtures | https://app.notion.com/p/3f129a307459817fa9cef0cc0f4efd6f | 2026-10-06 14:41:29 |
| 20 | Claude Code Playbook | https://app.notion.com/p/3f129a3074598104b912c4b5fcce09aa | 2026-10-06 14:49:05 |
| 21 | CLAUDE.md (paste into the repository root) | https://app.notion.com/p/3f129a30745981e29968e3c7dd8cf7c8 | 2026-10-06 14:50:23 |
| 22 | Build Prompts by Phase | https://app.notion.com/p/3f129a307459818aa432d0251a1fa8f6 | 2026-10-06 14:50:23 |
| 23 | Patient Service - API Spec | https://app.notion.com/p/3f129a30745981a28d52e531c9c16ab7 | 2026-10-06 14:42:17 |
| 24 | Reception Service - API Spec | https://app.notion.com/p/3f129a30745981c0abe6c64992b68791 | 2026-10-06 14:42:19 |
| 25 | Consultation Service - API Spec | https://app.notion.com/p/3f129a3074598158badce47e73e9f5dd | 2026-10-06 14:43:32 |
| 26 | Lab Service - API Spec | https://app.notion.com/p/3f129a307459818aa69ffe61d357a2e9 | 2026-10-06 14:43:34 |
| 27 | Pharmacy Service - API Spec | https://app.notion.com/p/3f129a30745981afa320cbb911c3b216 | 2026-10-06 14:43:37 |
| 28 | Staff Service - API Spec | https://app.notion.com/p/3f129a307459814e99fdc53668394d0f | 2026-10-06 14:43:40 |
| 29 | Infra Files (docker-compose, SQL, env, scripts) | https://app.notion.com/p/3f129a30745981dbaebef18f8db1734f | 2026-10-06 14:45:36 |
| 30 | Stack Templates (how every service stub must look) | https://app.notion.com/p/3f129a307459816d87edde8b6bdbf924 | 2026-10-06 14:45:36 |
| 31 | Keycloak Setup | https://app.notion.com/p/3f129a30745981d78966cf47cc80219f | 2026-10-06 14:45:39 |
| 32 | Gateway Config | https://app.notion.com/p/3f129a307459810788d2d9ce6db3a93a | 2026-10-06 14:45:39 |
| 33 | Angular - Architecture and Shared Code | https://app.notion.com/p/3f129a30745981f98847d63bec51d8b9 | 2026-10-06 14:47:34 |
| 34 | Angular - Screens A (Layout, Patients, Reception, Staff) | https://app.notion.com/p/3f129a30745981c8baebcd16dbc208b8 | 2026-10-06 14:53:45 |
| 35 | Angular - Screens B (Consultation, Lab, Pharmacy, Patient portal) | https://app.notion.com/p/3f129a30745981b6b0d4c7f257046df3 | 2026-10-06 14:47:34 |
| 36 | Angular - Mock API | https://app.notion.com/p/3f129a307459811e886cf366da1a4db1 | 2026-10-06 14:47:34 |
| 37 | End-to-End Scenarios (curl) | https://app.notion.com/p/3f129a30745981b89dddd8866ebc8ea3 | 2026-10-06 14:49:02 |

Precedence when pages disagree, from **[Claude Code Playbook]**: Domain Model > the service's API Spec > Seed Data > API Contracts + Event Catalogue > Infra Files/Keycloak/Gateway Config/Stack Templates > Angular pages > Decisions Log > older overviews. (The Playbook also says the Decisions Log "resolved decisions override older text elsewhere": see finding C9.)

### 2.2 Repository and machine (read-only inspection)

- Repository: `C:\Users\Houssein\Desktop\Projects\Microservice` is **empty** and **not a git repository**. No CLAUDE.md, no docs/, nothing to reuse. (Project folder only contains the `.claude` memory area outside the repo.)
- Machine: Windows 11 Pro, about 23.7 GB RAM, Hypervisor present. Git Bash and PowerShell available.
- Installed: git 2.55, Node 24.19, npm/npx, curl, Python 3.12.10, JDK 17.0.20, winget.
- **Missing: Docker (`docker` not found), WSL (not installed), jq, psql, Maven/Gradle on PATH, Angular CLI (`ng`), .NET SDK (none installed), Podman.**
- Ports 4200, 5432, 5672, 15672, 8080 to 8086 and 8180 are all free right now (no listeners).

---

## 3. Spec findings

Format: ID, pages, exact text, proposed resolution. **QUESTION** = needs your decision (also in section 4). **NOTION EDIT** = you change the page, I do not.

### 3.1 Must resolve before coding

**M1. Reception's background job has no token to call Patient. QUESTION Q6.**
Pages: [Domain Model] X-4 and REC-6; [Decisions Log] D14; [Stack Templates] "Forward Authorization"; [Patient API Spec] "Every endpoint except /health requires a valid JWT".
Text: REC-6 "A background job runs every 60 seconds and re-checks appointments with patientVerified = false. On success it sets the flag to true." X-4 "Synchronous calls between services forward the caller's Authorization header". D14 "forward the caller's JWT".
Problem: a timer has no caller. Stored user tokens expire after 15 min ([Keycloak Setup] accessTokenLifespan 900), and the interesting case (Patient down for longer) outlives them. Without a fix, E2E Scenario 9 ("Within about 70 seconds the appointment's patientVerified becomes true") cannot pass.
Resolution (recommended): add a confidential Keycloak client `sgh-reception-svc` (service account, client_credentials) with the realm role RECEPTIONIST, used only by the REC-6 job. It adds one client and two env vars (`KEYCLOAK_TOKEN_URL`, client secret as a dev value in `.env.example`) and needs a Notion edit to Keycloak Setup, Infra Files (env registry) and REC-6 wording. Alternative: Patient exposes an unauthenticated internal summary (weakens X-1; I advise against).

**M2. docs/spec/ does not exist for teammates. QUESTION Q7.**
Pages: [Claude Code Playbook] section 2; [CLAUDE.md] "The specification is in docs/spec/ (exported from Notion)"; [Build Prompts by Phase] every prompt "Read docs/spec/ pages".
Problem: you read Notion directly, but each teammate's Claude Code reads `docs/spec/` (owner prompt). Notion MCP access for five other people is not guaranteed, and Notion pages change without versioning.
Resolution (recommended): at handoff, commit a dated snapshot in `docs/spec/` (one .md per page, with a header table of last-edited times). I can generate it from the same read-only fetch; you can also use Notion's Markdown export. CLAUDE.md then stays word-for-word as written. Teammates re-pull the snapshot when you tell them a page changed.

**M3. Folder layout is defined three different ways.**
Pages: [Local Setup] tree (`sgh/ infra gateway frontend services docs`), [CLAUDE.md] layout (adds `contracts/ tools/mock/ scripts/`), [Build Prompts] L0 acceptance "tree matches Local Setup, nothing else was created" while L1/L3/L4 create `scripts/`, `contracts/`, `tools/mock/`.
Resolution: skeleton = union of both (Local Setup + CLAUDE.md layout), repository root is the project root (no extra `sgh/` level). L0 acceptance becomes "tree matches CLAUDE.md layout". NOTION EDIT optional (Local Setup tree).

**M4. Two copies of each OpenAPI file.**
Pages: [Build Prompts] L3 writes `contracts/openapi/<service>.yaml`; L6 "a copy of its OpenAPI contract"; [Stack Templates] "services/<name>/openapi.yaml hand-written contract first"; [API Contracts] "Each owner writes openapi.yaml for their service before coding"; owner prompt "openapi.yaml consistent with contracts/openapi".
Problem: contract drift between two files, and conflicting "who writes it".
Resolution: `contracts/openapi/*.yaml` is canonical and written by me (L3). The service copy is a byte-identical copy, enforced by `scripts/check-contracts.sh` (a `diff` in the stub check and in CI). A teammate who needs a change edits the Notion API Spec (you), then I change contracts/. NOTION EDIT: API Contracts checklist line.

**M5. The stub's "protected placeholder endpoint" is not defined.**
Pages: [Stack Templates] section 3 "a protected placeholder endpoint returns 401 without a token, 403 with the wrong role, 200 with the right role"; [Build Prompts] L6.
Problem: no path, no role, so I cannot write one black-box check that works for six stacks.
Resolution: define `GET /api/_stub/ping`, role ADMIN, returns `{ "service": "<name>", "user": "<preferred_username>" }`; teammates remove it when the first real protected endpoint exists. Used by `scripts/stub-check.sh`. NOTION EDIT: Stack Templates section 3.

**M6. "Starts with the database down" is undefined at the HTTP level, and fights the default behaviour of every framework.**
Pages: [Domain Model] X-6 "Services start even if the database, RabbitMQ or another service is unavailable"; [Stack Templates] "Health ... must respond even if the database or broker is down"; "Use migrations (not auto-created tables)"; [Patient API Spec] Done when "Service starts with the database unreachable and recovers".
Problems: (1) not stated what a DB-backed endpoint returns while the DB is down; (2) migrate-at-startup (Flyway, EF migrate, Alembic) aborts boot if the DB is unreachable; Spring's Hikari pool and Actuator's DB health indicator add two more traps (`/health` would return 503 DOWN with the default DB indicator).
Resolution: rule added to the pattern in the Patient reference service and copied into every stub: (a) the HTTP server starts first; (b) a background loop (1, 2, 4, 8, 16, 30 s) runs migrations then seed, and sets a "ready" flag; (c) DB-backed endpoints return 503 with the shared error body (`message: "Database unavailable"`) until ready; (d) `/health` is an own handler that never touches dependencies. NOTION EDIT: add X-8 to [Domain Model] and a paragraph in [Stack Templates] section 1.

**M7. Events published before a consumer has ever started are lost.**
Pages: [Event Catalogue] "Each consuming service owns a durable queue ... bound to the exchange"; [Stack Templates] topology declared by each service at connect time; [Lab API Spec] test "Service stopped, event published, service started -> request appears"; [Event Catalogue] checklist "RabbitMQ and the exchange available from docker-compose.yml".
Problem: a topic exchange drops a message that matches no binding. If Consultation publishes before Lab has ever connected (fresh clone, first demo run, `down -v`), the lab order is silently lost. Compose as written does not create any exchange or queue.
Resolution (recommended): `infra/rabbitmq/definitions.json` loaded by RabbitMQ at boot (exchange `sgh.events`, `sgh.events.dlx`, `sgh.events.dlq`, the five consumer queues and bindings). Services still declare the same objects idempotently; the arguments must be identical across services or RabbitMQ answers PRECONDITION_FAILED. NOTION EDIT: [Infra Files] (rabbitmq mount) and [Event Catalogue] checklist. Needs your yes (Q8).

**M8. Ownership of the gateway and infra contradicts itself. QUESTION Q5.**
Pages: [Claude Code Playbook] section 4 "Project lead: ... infra, Keycloak realm, ... a minimal gateway"; [Build Prompts] L7 "Gateway (minimal, or complete if the Service 6 owner is not ready)"; [Service 6 overview] "This person carries ... staff service, gateway and Keycloak setup", checklist "Gateway routes for all six"; [GitHub Workflow] `infra` and `gateway` owned by "Service 6 owner"; [Decisions Log] silent.
Problem: you cannot hand out stubs (L10 checks Scenario 1 through the gateway) before a gateway exists, and the Service 6 owner is also a teammate with a stub to finish.
Resolution: you build the gateway (L7) as the checked reference, then hand `gateway/` to the Service 6 owner to harden only if they want it. Gateway stack open (Q5). CODEOWNERS: `infra/` and `contracts/` stay with you.

**M9. Consultation promises a backfill that no rule implements.**
Pages: [Service 3 overview] "create the consultation with the patient id only, mark the snapshot as missing, and fill it in later"; [Screens B] banner "They will appear when the Patient service is back"; [Domain Model] CON-2 only "stores patientSnapshot = null".
Problem: no rule, job or endpoint fills the snapshot (REC-6 exists only for Reception). The banner would promise something that never happens.
Resolution: choose one: (a) change the banner to "Patient details are unavailable" and keep `null` (cheapest, recommended); (b) add CON-11: on GET, if snapshot is null, try the Patient summary once and store it. NOTION EDIT either way.

**M10. Teacher approval is not secured.** Q1/Q2/Q3 are open in [Decisions Log]. See section 4 (Q1) and the contingency plan in section 4.2.

### 3.2 Can resolve during the build

**B1. Keycloak: custom attributes may be dropped.** [Keycloak Setup] "Known pitfall: custom user attributes" is correct in principle: current Keycloak uses a declarative user profile, unmanaged attributes are off by default, and the realm import must either declare `staffId`/`patientId` or set `unmanagedAttributePolicy` ENABLED inside the user-profile config component. [web] I could not retrieve the exact JSON key path from the docs page I fetched, so the exact realm-JSON syntax is UNVERIFIED and is the first thing P3 proves by importing and decoding a token. Do not trust the realm skeleton on the page until step 2 of its verification passes.

**B2. Keycloak image pinned to an old tag.** [Infra Files] `quay.io/keycloak/keycloak:26.0`. [web] latest is 26.7.0 (2026-07-09); 26.5.x and 26.6.x also exist. The bootstrap variable names (`KC_BOOTSTRAP_ADMIN_USERNAME`/`PASSWORD`) are valid from 26.0 onward. Resolution: pick one current 26.x tag in P2 and pin it exactly (not `latest`); re-run the seven verification steps on that tag.

**B3. RabbitMQ image `rabbitmq:3-management` is end-of-life.** [Infra Files]. [web] 3.13 is past end of life (2025), 4.0 is also deprecated, 4.1 and 4.2 are current. Resolution: `rabbitmq:4-management` pinned to a 4.x tag. All six client libraries in [Stack Templates] support 4.x; the only thing to check is classic-queue settings if a teammate uses exotic arguments (none are specified).

**B4. Spring Cloud Gateway property names changed.** [Gateway Config] sketch uses `spring.cloud.gateway.routes` and warns it may differ. [web] confirmed: in the 2025 release train the prefix is `spring.cloud.gateway.server.webflux.*` and the starter is `spring-cloud-starter-gateway-server-webflux` (a `-webmvc` flavour also exists). Resolution: check the docs of the exact Spring Boot/Cloud pair chosen, never copy the YAML as written.

**B5. Prism behaviour for the mocks.** [Angular - Mock API]. [web] Prism 5.15 runs on Node 24 (this machine: 24.19). Without a valid `Authorization: Bearer ...` it answers 401 "Invalid security scheme used", which is compatible with the mock token. It answers the first example by default (error examples need a `Prefer: code=NNN` header), validates request bodies (so request examples must be valid), and POST/PUT/DELETE are stateless (a created appointment never appears in a later list). Static routes (`/api/appointments/availability`, `/api/staff/directory`) must be declared before templated ones in each YAML. UNVERIFIED until P5.

**B6. `http-proxy-middleware` v3 changed path handling.** [Angular - Mock API] says "proxied with http-proxy-middleware". [web] In v3 the mount path is no longer patched into `req.url`; mounting `app.use('/api/patients', proxy)` strips the prefix and requests reach Prism as `/`. Resolution: mount at root with `pathFilter` per route, one proxy per service, test with `curl /api/patients` before building anything on it.

**B7. Compose file details.** [Infra Files]. (a) `ports: - 5432:5432` unquoted: Compose docs advise quoting (`"5432:5432"`) to avoid YAML number parsing surprises. (b) Keycloak has no healthcheck, so the check "brings up three healthy containers" can only ever show two "healthy" plus one "running". (c) Keycloak dev mode keeps its data in the container; the realm is re-imported after `down`/`up` (expected). (d) The init.sql runs only on an empty volume (the page says so). Resolution: quote ports; reword the check to "Postgres and RabbitMQ healthy, Keycloak running and `http://localhost:8180/realms/sgh` returns 200".

**B8. Windows and shell.** Scripts are bash; E2E needs bash, curl, jq and GNU `date -d` ([E2E Scenarios] says use Git Bash or WSL). Git Bash is present and its `date -d` works (tested: `date -u -d '+3 days 09:00'`). jq is missing: install with winget. Add `.gitattributes` with `*.sh text eol=lf` (not in the spec): Windows Git otherwise checks scripts out with CRLF and `#!/usr/bin/env bash^M` fails. [Infra Files] `.editorconfig` says LF but does not enforce Git's conversion.

**B9. E2E script is not re-runnable and has ambiguous lines.** [E2E Scenarios]. Scenario 2 creates the patient "Test Scenario" and a second run gets 409, so `PID` becomes empty and everything after it breaks. Scenario 4 "expect 422 or 409" cannot be a PASS/FAIL check: per [Lab API Spec] validate on IN_PROGRESS is 409 ("409 if not RESULT_ENTERED"), so expect 409. Seed-count checks ("8 patients", "7 staff", stock 491) only hold on a fresh seed. Scenarios 5 and 10 both dispense seeded prescription R1 and Scenario 5 expects Paracetamol stock 491, which breaks if run twice. Resolution: `scripts/e2e.sh` uses a unique suffix per run for created patients, and a `scripts/reset.sh` (documented: `down -v`, up, restart services) is required before the full run. Also: L11 builds the script from "scenarios 1 to 7"; the page has twelve (Scenario 12 patient portal is not mentioned in L11 or the Timeline). I include 12 in the automated run.

**B10. Publishing must not block the request.** [Stack Templates] "If publishing fails, retry 3 times with backoff ... Never fail the request that triggered it"; [E2E Scenario 11] expects 201. Three retries with 1, 2, 4 s backoff add about 7 s to the response, longer than the UI/gateway comfort. Resolution: publish from a background task after commit (queue in memory); the HTTP response never waits on the broker. Applies to Reception, Consultation, Lab, Pharmacy.

**B11. Seed timestamps are relative to each service's own first start.** [Seed Data] "Timestamps written as +1d, -2d are relative to the day the service first starts". If services are first started on different days, C1's `signedAt -2d 11:40` and A4's `-2d 11:00` disagree. Resolution: for demos, start all services on the same day after `reset.sh`; optional improvement: a shared env `SEED_BASE_DATE` (NOTION EDIT to Infra Files registry). Not blocking.

**B12. Seed gaps.** [Seed Data] "item 1: Paracetamol 500 mg ; 3 per day ; 5 days" has three values for four fields (drugName, dosage, frequency, duration); [Consultation API Spec] example gives dosage "1 tablet". Use the API Spec value (higher precedence). `patient1` is "(linked to P1)" with no name; Keycloak password grant needs a complete profile (first name, last name, email) or fails with "Account is not fully set up"; use Youssef Ben Salah, `patient1@sgh.local`. NOTION EDIT to Seed Data.

**B13. Tokens contain more roles than the seven.** [Keycloak Setup] tokens carry `realm_access.roles` including Keycloak's defaults (`default-roles-sgh`, `offline_access`, `uma_authorization`). [Staff API Spec] `/api/me` example returns `"roles": ["DOCTOR"]`. Resolution: services filter to the seven known roles when building `/api/me` and `Role[]`.

**B14. JWKS must be fetched lazily.** X-6 "start even if ... unavailable" plus Keycloak stopped: a service configured with Spring `issuer-uri` or an eager JWKS fetch can fail at boot. Resolution: use lazy fetching with cache (Spring `jwk-set-uri` + issuer validator; `jose` remote JWKS; PyJWKClient). Start order in the README: Keycloak first. Also: a service restarted while Keycloak is down cannot validate new tokens (only already-cached keys). Say this in the Resilience Demo notes.

**B15. Gateway status timing.** [Gateway Config] 1 s health timeout, 2 s cache; [Build Prompts] L7 and [E2E Scenario 8] "DOWN within 2 seconds". Connection refused is instant, so it holds for stopped processes, but a hung (not stopped) service can take 1 s + up to 2 s of cache. State the acceptance as "within 3 seconds" or drop the cache. Cosmetic for the demo.

**B16. PUT on consultation is ambiguous.** [Consultation API Spec] `ConsultationUpdate` has four optional fields and [E2E Scenario 3] sends only `assessment` and `plan`. Decide: partial update (missing = unchanged). NOTION EDIT one line.

**B17. Front-end calls that some roles are not allowed to make.** [Screens B] Consultation > Prescriptions tab calls `GET /api/prescriptions/{id}` for the dispensing badge for NURSE and DOCTOR; the gateway rule `/api/prescriptions/**` is PHARMACIST, DOCTOR, ADMIN, so a NURSE gets 403 and the error interceptor shows a snackbar. [Screens B] "Results section from GET /lab-results" does not say which path (it must be `/api/consultations/{id}/lab-results`). Resolution in the Angular build: only DOCTOR requests the pharmacy status; the lab results path is the consultation one. NOTION EDIT optional.

**B18. CORS in one place.** [Gateway Config] CORS only at the gateway. Services must not add their own CORS headers (duplicate `Access-Control-Allow-Origin` breaks browsers). Add to the stub checklist.

**B19. Stack-template libraries are suggestions.** [Stack Templates] fine, but versions are not pinned and Angular's current default runner is Vitest (Angular 21+, [web]), not Karma. [Angular - Architecture] says "Angular's default unit test runner", which is consistent. Check `ng new --help` at P10.

**B20. Lead stack for Spring Boot.** JDK 17 is installed. Choose the current Spring Boot release that supports 17 at P5; Maven wrapper is generated by the Spring Initializr download, so no global Maven needed.

### 3.3 Cosmetic (batch into one Notion edit session)

- C1. `CANCELLED` appears in PrescriptionStatus ([API Contracts] shared enums, [Service 3 overview], [Service 5 overview]) but not in [Domain Model] (Prescription status "ISSUED", PrescriptionCopy "ISSUED | PARTIALLY_DISPENSED | DISPENSED") nor the Angular models. Domain wins: no CANCELLED.
- C2. Reminder status `FAILED` ([Service 2 overview]) vs `CANCELLED` ([Domain Model]). Domain wins.
- C3. "Seed data (at least 10 patients)" ([Service 1 overview]) vs 8 patients and the check "GET /api/patients returns 8" ([Seed Data]). Seed wins.
- C4. Overviews list DB options (H2, MySQL, MongoDB, SQLite, SQL Server); [Decisions Log] D9 fixes Postgres.
- C5. [API Contracts] original call list still shows Reception -> Staff `GET /api/staff/{id}` (ADMIN only); the addendum corrects it to `/public`.
- C6. [Angular Front End] structure still labels features "(Service N owner)" and says "every feature owner must handle [degraded service]"; D13 says the lead owns all screens. [GitHub Workflow] table row "Shell owner (to assign)".
- C7. [Event Catalogue] payload examples use test code `CBC` and `12-16`, which are not in the Lab catalogue (HGB, WBC, GLU, CHOL, CRE, K).
- C8. [Local Setup] start-order list is mis-numbered ("1. Infrastructure ... 1. Services ... 2. Gateway ... 3. Angular").
- C9. [Claude Code Playbook] puts the Decisions Log 7th in precedence but says its resolved decisions override older text. I found no actual conflict between D9 to D20 and the API Specs (D19 arrays are consistent), so I follow the listed order and treat D9 to D20 as authoritative where an overview disagrees.
- C10. D19 "Top-level lists are paged" vs plain arrays for `GET /api/staff/directory`, `/api/roles`, `/api/stock/alerts`, `/api/tests`, `/api/consultations/{id}/lab-orders` (the API Specs say array). Put the exceptions list in `contracts/conventions.md`.
- C11. [Angular - Mock API] "login screen with a select of the eight seeded users" vs [Angular - Architecture] "seven roles plus a user choice". Use the eight users.
- C12. [Lab API Spec] `LabResultCopyDto` has no `id` although [Domain Model] LabResultCopy has one.
- C13. [Infra Files] script names appear as `token.sh`/`token.ps1` with Notion auto-links; harmless.
- C14. You wrote "Scenarios 1 to 11"; the page has 12 (1 to 7 functional, 8 to 11 resilience, 12 patient portal).
- C15. [Build Prompts] L1 says "Do not start Keycloak yet" while [Infra Files] check says "three healthy containers" (L2 then adds Keycloak). Fine, just sequence.

### 3.4 Web sources used

- Keycloak releases: https://skycloak.io/blog/keycloak-25-released-new-features-and-enhancements/ (lists 26.7.0 as latest, 2026-07-09), https://www.keycloak.org/archive/downloads-26.4.1.html, quay.io/keycloak/keycloak
- Keycloak user profile / unmanaged attributes: https://www.keycloak.org/docs-api/latest/javadocs/org/keycloak/representations/userprofile/config/UPConfig.html (the server admin guide page I fetched did not contain the import syntax)
- Spring Cloud Gateway 5.x property and starter changes: https://docs.openrewrite.org/recipes/java/spring/cloud2025/springcloudgatewayproperties and https://docs.spring.io/spring-cloud-gateway/reference/spring-cloud-gateway-server-webflux/configuration.html
- Prism 5.15 / Bearer 401: https://yrkan.com/tools-updates/prism-v5-15-whats-new/ and https://jvt.me/posts/2022/03/04/openapi-local-prism
- RabbitMQ lifecycle: https://www.aptible.com/docs/core-concepts/managed-databases/supported-databases/rabbitmq and https://docs.stackit.cloud/products/messaging/rabbitmq/reference/lifecycle/
- Angular 21 / Vitest: https://versionlog.com/angular/21.0/ and https://wallabyjs.com/whatsnew/angular-v21-vitest-support.html
- http-proxy-middleware v3: https://www.npmjs.com/http-proxy-middleware and https://unpkg.com/http-proxy-middleware@4.2.0/README.md
- Docker Desktop on Windows: https://docs.docker.com/desktop/install/windows-install/ and https://docs.docker.com/subscription/desktop-license/ (free for enrolled students in education; terms changed Dec 2024)

---

## 4. Questions for me

Only decisions that block something. Each one: options, recommendation, what is blocked.

**Q1. The teacher: is SGH accepted instead of JobBoard? (also Eureka, gateway technology, stack freedom, grading, deadlines)** [Decisions Log] Q1, Q2, Q5; [Root page] section 7.
- Options: (a) ask now by email, keep going only on teacher-independent work; (b) ask at the next session; (c) start without asking.
- Recommendation: (a), today. A reply to a 6-line email is the cheapest possible answer (draft below). Do P0 to P3 while waiting.
- Blocked until answered: P4 (contracts), P5 (Patient), P9 onward (anything domain-specific). Also decides Q5.

**Q2. Your operating system and Docker.** Detected: Windows 11 Pro, Hypervisor present, **no Docker, no WSL, no jq**.
- Options: (a) install WSL2 + Docker Desktop (needs a restart; licence is free for enrolled students, [web] terms narrowed to enrolled students in Dec 2024), then work from Git Bash; (b) Podman Desktop (same compose files, extra friction with the `name:` and health checks); (c) no containers: install Postgres, RabbitMQ and Keycloak natively (three installers, six databases by hand; breaks `docker compose` used throughout the spec).
- Recommendation: (a). Teammates will probably use Docker too and every spec command assumes it.
- Blocked: P2 (infra) and everything after it. Can you confirm that BIOS virtualization is enabled? (PowerShell reported the firmware flag as False while a hypervisor is present; I cannot tell which is right without trying the install.)

**Q3. Stack for each of the six services.** You choose Patient; teammates choose the rest ([Root page] "Each owner may choose ... at least 3 distinct technologies").
- Patient: **recommended Spring Boot** (JDK 17 already installed; [Stack Templates] Spring notes are the most detailed; the Staff service and gateway are also Spring in the page defaults, so what you learn is reused). Alternatives: NestJS or Express (Node is installed).
- Others: need a name per service by a date. Suggested menu from [Stack Templates]: Spring Boot, NestJS, Express, ASP.NET Core (needs the .NET SDK, absent here), FastAPI, Flask. Rule: at least three distinct stacks overall.
- Blocked: L6 stubs (P8), and the teammate message in section 6.

**Q4. Who builds the five stubs?** [Build Prompts] L6 says you do, in each teammate's stack.
- Option A (spec): you build five stubs in five stacks, about 4 to 8 h each = 20 to 40 h, and you become the stack expert for stacks you will never ship.
- Option B (recommended): you build the stub checker (`scripts/stub-check.sh`, 10 black-box checks from [Stack Templates] section 3 plus M5) and the Patient reference; each teammate builds their own stub from [Stack Templates] and must pass the checker before real work. You review five small PRs (1 to 2 h each).
- Hybrid: you do the stub only for a stack you already know. Your wording ("I build ... a stub for every other service") suggests A; B saves about 15 to 30 h and teammates start sooner. Your call.
- Blocked: P8 and P9 design (how teammates start).

**Q5. Gateway: who builds it and in which stack?**
- Options: (a) you, Spring Cloud Gateway (WebFlux flavour) (same ecosystem as Patient; the course may expect Spring); (b) you, Node (reuses the mock gateway route table and `jose`; faster); (c) Staff owner does it all (spec default; risks being late).
- Recommendation: (a) unless the teacher says Eureka/other. I will not start before Q1 and Q3 are answered because (b) is faster only if the teacher does not require Spring.
- Blocked: P7. P7 blocks the handoff check, so this is on the critical path.

**Q6. Reception's background token (finding M1).** Options: service account `sgh-reception-svc` with role RECEPTIONIST (recommended), or an unauthenticated internal endpoint. Blocked: realm file (P3) and Reception stub/owner prompt.

**Q7. Specification snapshot for teammates (finding M2).** Options: commit a generated `docs/spec/` snapshot at handoff (recommended), or give each teammate Notion MCP access. Blocked: P1 (L0 writes CLAUDE.md) and P9.

**Q8. Pre-declared RabbitMQ topology (finding M7).** Yes (recommended: `infra/rabbitmq/definitions.json`) or accept lost events on a first run. Blocked: P2.

**Q9. Dates and repository details.** (non-blocking for coding, blocking for the calendar) Final deadline and the Session 5 date ([Timeline]); the GitHub owner/repo name; the five teammates' GitHub usernames (CODEOWNERS, branch protection); whether you will `git init` this folder as the repository root. I need these in P0/P1.

### 4.1 Draft email for the teacher (send today; edit freely)

> Subject: Projet Applications Web Distribuees - sujet SGH a la place de JobBoard ?
> Bonjour, notre equipe (6 personnes) souhaite realiser SGH (gestion hospitaliere) au lieu de JobBoard : 6 microservices (Patient, Reception, Consultation, Lab, Pharmacie, Personnel/Acces), 1 API Gateway, 1 front Angular, Keycloak + JWT, RabbitMQ, Postgres, demo de resilience. Il couvre les memes exigences que JobBoard (REST/OpenAPI, gateway, sync + async, securite, resilience). Questions : 1) SGH est-il accepte ? 2) SGH est aussi le sujet du module d'architecture logicielle : reutilisation acceptable ? 3) Eureka obligatoire ou routes statiques acceptees ? 4) Stack libre par service (Spring Boot, NestJS, FastAPI, .NET...) ? 5) Dates de rendu et notation. Le schema d'architecture est joint. Merci.

### 4.2 If the teacher rejects SGH: what is lost and what is reusable

| Work | Reusable for JobBoard? | Notes |
|------|-----------------------|-------|
| Skeleton, `.editorconfig`, CODEOWNERS, `.gitattributes`, PROMPTS.md template, Playbook/CLAUDE.md rules (P1) | Yes, 100% | |
| `infra/` compose, Postgres init, RabbitMQ topology, scripts (P2) | Yes, about 90% | Rename the six databases and queues |
| Keycloak realm (P3) | About 60% | Keep structure, clients, mappers, test-user pattern; replace roles, users, ids |
| Stack-neutral patterns: error body, correlation id, lazy DB init, JWKS cache, consumer idempotency (P5 learnings) | Yes | Highest value learning |
| Gateway (P7) | About 85% | Route table is data |
| Mock tooling `tools/mock` (P6) | About 80% | Prism driver and mock gateway are generic |
| Angular shell: auth, interceptors, guards, status bar, shared components (P10) | About 80% | |
| OpenAPI contracts, seed, Patient service, all feature screens (P4, P5, P11) | 0% | Domain-specific, the biggest chunk of your hours |

Safe before the answer arrives: P0, P1, P2, P3 (pattern), and the generic parts of P6/P10 (mock gateway code, shell). Not safe: contracts, Patient, any feature screen, stubs. Cheapest way to get the answer first: the email above today, plus asking in the next session; do not wait for a reply to do P0 to P3 (about 14 to 26 focused hours, so the wait is free).

---

## 5. Build order

### Conventions used by every phase

- **Spec check (start of every phase):** re-fetch the pages named in "Notion pages" below, compare each `page_last_edited_at` with the table in section 2, and report any change before building. I record changes in `docs/spec-changes.md` (one line per change: page, old time, new time, what changed, whether code is affected). If a page the phase depends on changed, stop and tell you.
- **Evidence rule:** each acceptance check below must be run and shown (command + output). Nothing is "done" without it ([Playbook] section 5).
- **Commit style:** `<area>: message` ([GitHub Workflow]). Until the repository is on GitHub with branch protection (P1), commits go on `main`; after that, every phase is a branch `feature/<area>-<topic>` and a PR you review.
- **Hours are focused hours for you, with Claude Code doing the typing.** They include reading and verifying, as the course requires. They assume Windows, no prior run of any spec command.

### Phase overview

| Phase | Prompt | Goal | Hours | Risk |
|-------|--------|------|-------|------|
| P0 | - | Answers, tools, teacher email, repository decision | 3 to 6 | Low |
| P1 | L0 | Skeleton and rules | 2 to 4 | Low |
| P2 | L1 | Postgres, RabbitMQ, scripts | 5 to 12 (incl. Docker install) | Medium |
| P3 | L2 | Keycloak realm with working claims | 5 to 10 | **High** |
| P4 | L3 | OpenAPI contracts and event schemas | 12 to 20 | Medium |
| P5 | L5 | Patient reference service | 20 to 32 | **High** |
| P6 | L4 | Mock servers (can run in parallel with P5) | 4 to 7 | Medium |
| P7 | L7 | Gateway | 10 to 24 | Medium-high |
| P8 | L6 | Stubs (A) or stub checker (B) | A: 20 to 40; B: 8 to 14 | Medium |
| P9 | L10 | Handoff check and handoff | 3 to 5 | Medium |
| P10 | L8 | Angular shell | 16 to 26 | Medium |
| P11 | L9 | Seven feature areas | 66 to 102 | Medium |
| P12 | - | Mocks to real, one service at a time | 8 to 14 | Medium |
| P13 | L11 | Integration (`e2e.sh`, scenarios 1 to 7 and 12) | 15 to 28 | **High** |
| P14 | (Playbook) | Resilience scenarios 8 to 11 and rehearsal | 6 to 14 | Medium |
| P15 | L12 | Documentation and defence | 8 to 14 | Low |
| ongoing | - | Review of five teammates' PRs | 15 to 25 | Medium |

**Total about 215 to 370 focused hours** (about 205 to 345 with option B in P8). Critical path to unblock teammates: P0 to P5, P7, P8, P9 (about 75 to 140 h, with option B). P6 and P10 to P12 run while teammates work.

Dependency graph: P0 -> P1 -> P2 -> P3 -> P4 -> P5; P4 -> P6; P2/P3 -> P7; P5+P7 -> P8 -> P9; P6 -> P10 -> P11 (needs P4); P12 needs P7 plus each real service; P13 needs everyone; P14 needs P13; P15 last.

---

### P0. Pre-flight

- Goal: get the answers and the machine ready so P1 to P3 cannot stall.
- Notion pages: Decisions Log, Local Setup, GitHub Workflow, Timeline and Milestones.
- Creates: nothing in the repo (installs on your machine: WSL2, Docker Desktop, jq via winget). Sends the teacher email. Creates the GitHub repository and adds collaborators if Q9 is answered.
- Acceptance checks (run in Git Bash after install and restart):
  - `docker --version` and `docker compose version`
  - `docker run --rm hello-world`
  - `jq --version`
  - `git --version`; `git init` in the project folder when you agree
- Depends on: your answers to Q1 to Q9 (at least Q1 sent, Q2, Q3-Patient).
- Effort: 3 to 6 h (Docker/WSL install is the unknown).
- Risk: low. WSL2/Docker on a machine where the BIOS virtualization flag is unclear can cost an extra hour.
- Commit message: none (no repo content).

### P1. Repository skeleton (prompt L0)

- Goal: an empty but correct monorepo with the working rules in place.
- Notion pages: Claude Code Playbook, GitHub Workflow, Local Setup, Deliverables and Defence, CLAUDE.md (paste into the repository root).
- Creates: `CLAUDE.md` (root block from the page, unchanged; with the snapshot of Q7 the "docs/spec/" wording stays true), `README.md` (headings from Deliverables and Defence, placeholders only), `.gitignore`, `.editorconfig`, `.gitattributes` (`* text=auto`, `*.sh text eol=lf`; finding B8), `CODEOWNERS` (your username for `infra/`, `contracts/`, `docs/`, `frontend/`, `tools/`, `scripts/`; teammates for their service when known), `docs/PROMPTS.md` (template from Deliverables and Defence), `docs/PLAN.md` (this file), `docs/spec-changes.md`, `contracts/{openapi,events}/`, `infra/{postgres,keycloak,rabbitmq}/`, `gateway/`, `frontend/`, `services/{patient,reception,consultation,lab,pharmacy,staff}-service/` each with a README stub, `tools/mock/`, `scripts/`. GitHub: `main` protected, PR review required.
- Acceptance checks: `git ls-files` (or `find . -not -path './.git*' | sort`) shows exactly the CLAUDE.md layout; nothing else; `git log --oneline` shows one commit; a throwaway PR cannot be merged without review.
- Depends on: P0, Q7, Q9.
- Effort: 2 to 4 h. Risk: low.
- Commit: `chore: repository skeleton`

### P2. Infrastructure (prompt L1)

- Goal: Postgres and RabbitMQ running locally from one command, scripts usable on Windows.
- Notion pages: Infra Files (docker-compose, SQL, env, scripts), Keycloak Setup (run part only), Event Catalogue (topology), Stack Templates (RabbitMQ section).
- Creates: `infra/docker-compose.yml` (changes from the page: quoted ports, `rabbitmq:4-management` pinned, Keycloak tag pinned to a current 26.x, healthcheck note; Keycloak service present but started in P3), `infra/postgres/init.sql`, `infra/rabbitmq/definitions.json` + `rabbitmq.conf` mounting it (if Q8 yes), `scripts/token.sh`, `scripts/token.ps1`, `scripts/health.sh`, `scripts/reset.sh` (my addition, finding B9), `.env.example` registry copy.
- Acceptance checks (from Infra Files "Checks" and L1):
  - `docker compose -f infra/docker-compose.yml up -d postgres rabbitmq` then `docker compose -f infra/docker-compose.yml ps` shows both healthy
  - `docker exec sgh-postgres psql -U sgh -c "\l"` lists `sgh_patient sgh_reception sgh_consultation sgh_lab sgh_pharmacy sgh_staff`
  - `curl -s -u sgh:sgh_dev_password http://localhost:15672/api/overview` returns JSON
  - with Q8: `curl -s -u sgh:sgh_dev_password http://localhost:15672/api/exchanges/%2F/sgh.events` returns the exchange; `.../api/queues` lists the five queues and the DLQ
  - `docker compose -f infra/docker-compose.yml down` then `up -d` keeps data; `down -v` wipes it
  - `./scripts/health.sh` runs (all DOWN is expected at this point)
- Depends on: P1 (and Docker from P0).
- Effort: 5 to 12 h incl. Docker pulls. Risk: medium (first-ever run of the compose file; the Windows line-ending and port issues).
- Commit: `infra: postgres and rabbitmq compose, helper scripts`

### P3. Keycloak realm (prompt L2)

- Goal: a realm that imports on first start and issues tokens with `staffId`, `patientId`, `preferred_username` and realm roles, verified by decoding.
- Notion pages: Keycloak Setup, Seed Data and Fixtures, Infra Files, API Gateway and Security, Decisions Log (D16, D17).
- Creates: `infra/keycloak/sgh-realm.json` (realm `sgh`, seven roles, clients `sgh-frontend` (PKCE S256, redirect `http://localhost:4200/*`) and `sgh-dev-cli` (password grant), both with the `staffId` and `patientId` mappers, eight users with the fixed ids and `Sgh@dev2026`, full profile for patient1 (B12), the user-profile declaration or unmanaged-attribute policy (B1), and per Q6 the `sgh-reception-svc` service-account client with role RECEPTIONIST). Keycloak service enabled in compose. `docs/keycloak-notes.md` records the exact syntax that worked.
- Acceptance checks (the seven steps of Keycloak Setup, verbatim):
  1. `docker compose -f infra/docker-compose.yml up -d keycloak`; open http://localhost:8180 (admin/admin), realm `sgh` exists
  2. `./scripts/token.sh doctor1` prints a token; decode payload; `iss` = `http://localhost:8180/realms/sgh`, `realm_access.roles` contains DOCTOR, `staffId` = `b2b2b2b2-0000-4000-8000-000000000001`, `preferred_username` = `doctor1` (decode with `cut -d. -f2 | base64 -d | jq` in Git Bash)
  3. patient1 token has `patientId` = `a1a1a1a1-0000-4000-8000-000000000001` and role PATIENT
  4. admin1 token has role ADMIN and a `staffId`
  5. wrong password returns an error from the token endpoint
  6. `curl -s http://localhost:8180/realms/sgh/protocol/openid-connect/certs` returns keys
  7. `docker restart sgh-keycloak` keeps the realm working
  - plus: tokens fetched via `127.0.0.1` are rejected by a service (proves the "always localhost" rule); with Q6: client_credentials token for `sgh-reception-svc` carries role RECEPTIONIST.
- Depends on: P2, Q6.
- Effort: 5 to 10 h. Risk: **high** (UNVERIFIED realm JSON; attribute import is the known trap; if tokens lack `staffId` every later phase fails, so no phase continues until this passes).
- Commit: `infra: keycloak realm with fixed users and claim mappers`

### P4. Contracts (prompt L3)

- Goal: six OpenAPI files and event schemas that reproduce every API Spec endpoint, with seed-based examples.
- Notion pages: all six API Spec pages, API Contracts and Conventions, Event Catalogue (RabbitMQ), Seed Data and Fixtures, Domain Model and Business Rules.
- Creates: `contracts/openapi/{patient,reception,consultation,lab,pharmacy,staff}.yaml`, `contracts/events/envelope.schema.json` + six payload schemas, `contracts/conventions.md` (incl. C10 exceptions list), `scripts/check-contracts.sh` (finding M4), a table `docs/contracts-coverage.md` mapping each API Spec endpoint to its operation id (so the review is a checklist, not a read-through).
- Acceptance checks: `npx @redocly/cli lint contracts/openapi/*.yaml` exits 0; a script counts operations per file and compares with the endpoint list of the page (I will produce the count; I will not claim equality without showing both lists); every response has an example using seed ids; every example validates against its schema.
- Depends on: P1, Q1 (do not start before the teacher answer if you can wait; at minimum, Patient and Staff contracts are safe).
- Effort: 12 to 20 h. Risk: medium (volume; examples must be consistent across 6 files).
- Commit: `contracts: openapi for six services and event schemas`

### P5. Patient reference service (prompt L5)

- Goal: one fully finished service that defines the pattern every stub follows, including the failure-mode patterns (M6, B10, B13, B14).
- Notion pages: Stack Templates, Patient Service - API Spec, Domain Model and Business Rules (Patient section, PAT-1 to PAT-8, X-1 to X-7), Seed Data and Fixtures (patients, medical file), API Contracts and Conventions, Infra Files.
- Creates: `services/patient-service/` in the stack from Q3 (Spring Boot assumed): migrations (`patients`, `medical_file_entries`, `processed_events`), idempotent seed (8 patients, 4 medical file entries), 9 endpoints, rules PAT-1..8, shared edges (health, `/docs`, `/openapi.json`, JWT + roles, error body, correlation id, paging, request log), `openapi.yaml` copy, README, `.env.example`, tests listed on the API Spec page (10 test groups).
- Acceptance checks: documented test command passes (e.g. `./mvnw test`); the stub acceptance list (10 items) with evidence, especially item 1 (`docker compose stop postgres` then start the service: it boots, `/health` is 200 and a data call is 503 with the error body, then `start postgres` and it recovers); `curl -s http://localhost:8081/health`; `T=$(./scripts/token.sh reception1); curl -s -H "Authorization: Bearer $T" http://localhost:8081/api/patients | jq .totalElements` is 8; the "Checks after seeding" line for Patient; PATIENT token reading P2 returns 403; `scripts/check-contracts.sh` clean.
- Depends on: P3, P4, Q3.
- Effort: 20 to 32 h. Risk: **high** (X-6 is non-default in Spring: Flyway/Hikari/Actuator; first full use of the auth stack).
- Commit: `patient: reference service`

### P6. Mock servers (prompt L4)

- Goal: the whole Angular app can be built with no real service.
- Notion pages: Angular - Mock API, Gateway Config (route table, 503 body), API Contracts and Conventions.
- Creates: `tools/mock/package.json`, `start.mjs`, `gateway.mjs`, root `package.json` with `npm run mock`.
- Acceptance checks (the five Acceptance lines of Angular - Mock API, Angular halves wait for P10): `npm run mock` prints seven ports; `curl -H "Authorization: Bearer mock-token" http://localhost:8080/api/patients` returns the example; `curl -s -X POST http://localhost:8080/gateway/mock/down/lab` then `curl -s -H "Authorization: Bearer mock-token" http://localhost:8080/api/lab-requests` returns the structured 503 naming `lab` and `curl -s http://localhost:8080/gateway/health/services | jq` shows lab DOWN; `.../up/lab` restores; with Prism stopped for one port, the proxy still answers 503; stop Prism 8081, start Patient on 8081 (P5), the same curl works.
- Depends on: P4. Parallel with P5 (separate folders).
- Effort: 4 to 7 h. Risk: medium (B5, B6).
- Commit: `mock: prism servers and mock gateway`

### P7. Gateway (prompt L7)

- Goal: the single entry point with JWT, coarse roles, CORS, correlation id, structured 503 and aggregate health.
- Notion pages: Gateway Config, API Gateway and Security, Keycloak Setup, API Contracts and Conventions, Decisions Log (D10, D11, D18).
- Creates: `gateway/` (stack from Q5), route table and role rules as data, `GET /health`, `GET /gateway/health/services`, tests listed on Gateway Config (9 tests) against stub HTTP servers, README with "how to change a service URL".
- Acceptance checks: documented test command passes; `./scripts/health.sh` shows gateway UP; `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/patients` is 401; NURSE token on `/api/drugs` is 403; PATIENT/RECEPTIONIST on `/api/patients` is 200 with Patient running; stop Patient: `/api/patients` is 503 with `"service":"patient"` and a correlationId while `/gateway/health/services` shows patient DOWN; CORS preflight: `curl -i -X OPTIONS http://localhost:8080/api/patients -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: GET"` returns the allow-origin header, and with `Origin: http://evil.example` it does not; E2E Scenario 1.
- Depends on: P3 and P5 (needs a real service and real tokens); Q5.
- Effort: 10 to 24 h (Node about 10 to 14; Spring Cloud Gateway about 14 to 24 because of B4 and Java-config role rules). Risk: medium-high.
- Commit: `gateway: routes, jwt, coarse roles, 503 fallback, status endpoint`

### P8. Stubs for the five other services (prompt L6) or the stub checker (option B)

- Goal: each teammate starts from a service that already passes the ten stub checks.
- Notion pages: Stack Templates, the service's API Spec, Domain Model and Business Rules (that service plus X rules), Seed Data and Fixtures, Infra Files, Event Catalogue.
- Creates: option A: `services/<name>/` stub per service per stack, plus `docs/stub-notes.md`; option B (recommended): `scripts/stub-check.sh <port> <service-name>` implementing the ten checks as black-box curl tests, with `GET /api/_stub/ping` (M5), and a generated `docs/stub-checklist.md` for teammates; each teammate then creates their own stub.
- Acceptance checks: `./scripts/stub-check.sh 8081 patient` passes against the real Patient service (it defines the baseline; adjust for it having real endpoints). For each stub: the 10 checks of Stack Templates section 3 with evidence (for the broker checks: `docker compose -f infra/docker-compose.yml stop rabbitmq`, `start rabbitmq`, service log shows reconnect; `curl -s -u sgh:sgh_dev_password http://localhost:15672/api/queues | jq '.[].name'` lists its queue).
- Depends on: P5, P7, Q3, Q4 (and stacks of the teammates for option A).
- Effort: A: 20 to 40 h; B: 8 to 14 h (checker + five reviews). Risk: medium (five stacks, unknown to you).
- Commit: A: `<service>: stub` (five commits); B: `scripts: stub acceptance checker`

### P9. Handoff check and handoff (prompt L10)

- Goal: prove a stranger can clone and run, then give every teammate a working start.
- Notion pages: Local Setup, Deliverables and Defence (root README outline), End-to-End Scenarios (Scenario 1), Stack Templates (section 3).
- Creates: root README start-up section (tested), `docs/spec/` snapshot (M2) with a page/time table, per-service `CLAUDE.md` (second block of the CLAUDE.md page, placeholders filled), GitHub issues per checklist item (optional), message to each teammate (section 6).
- Acceptance checks: in a fresh temporary clone (e.g. `git clone <repo> $TMP/sgh-clean`), only the root README: infra up, Keycloak up, six stubs up, gateway up, `./scripts/health.sh` all UP, `./scripts/stub-check.sh` for each service, Seed checks from Seed Data, Scenario 1 passes. Any README gap found is fixed in the real repository and noted.
- Depends on: P8.
- Effort: 3 to 5 h. Risk: medium (first fresh-clone run).
- Commit: `docs: root README start-up and spec snapshot` (and `chore: per-service CLAUDE.md`)

### P10. Angular shell (prompt L8)

- Goal: auth, interceptors, guards, status bar, role menu and shared components, working in mock mode and with real Keycloak.
- Notion pages: Angular - Architecture and Shared Code, Angular - Mock API, Seed Data and Fixtures, API Contracts and Conventions, Angular Front End.
- Creates: `frontend/` per the structure page: environments (`environment.ts`, `environment.mock.ts`), models, `AuthService` (keycloak-js, PKCE S256, mock mode), interceptors, guards, `ServiceStatusService` + bar, layout shell, menu, shared components and pipes, lazy routes with placeholders for every route in the routing table, forbidden and not-found pages, unit tests, scripts `start`, `start:mock`, `test`, `build`, `lint`; ESLint + Prettier.
- Acceptance checks: `cd frontend && npm test`, `npm run build`, `npm run lint` pass; `npm run start:mock` with mock login: doctor1 menu = "My agenda, Patients, Consultations, Lab results, Prescriptions status, Status", reception1 = "Patients, Appointments, Invoices, Status", patient1 = "My appointments, My invoices, My consultations" (table "Menu by role"); `curl -X POST http://localhost:8080/gateway/mock/down/lab` flips the status bar dot within 5 s. **Real login early check (my addition):** with Keycloak + the real gateway + the Patient service up, `npm start` logs in as reception1 through Keycloak and `/patients` loads real data. This de-risks the biggest integration seam before any feature screen exists.
- Depends on: P6 (mock) and P3 (Keycloak); P7 and P5 for the real-login check.
- Effort: 16 to 26 h. Risk: medium (keycloak-js with PKCE and silent refresh; third-party-cookie iframe checks are a common source of "login loop" bugs, so I will use `checkLoginIframe: false`; UNVERIFIED).
- Commit: `frontend: shell, auth, interceptors, shared components`

### P11. Angular features (prompt L9, one run per feature)

- Goal: all screens of Screens A and B working against the mocks, with service-down handling.
- Notion pages: Angular - Architecture and Shared Code, Screens A or Screens B (the section), the service's API Spec, Seed Data and Fixtures.
- Order and hours: (1) patients 8 to 12; (2) reception: appointments, then invoices 14 to 22; (3) consultation 16 to 24; (4) lab 8 to 12; (5) pharmacy 10 to 16; (6) staff 5 to 8; (7) patient portal 5 to 8. Reasoning in section 7.
- Creates: `frontend/src/app/features/<feature>/` and unit tests named on the Screens pages.
- Acceptance checks per feature: lint, tests, build; run with `npm run start:mock`, walk every screen for each allowed role (reported with what I saw, you check at least one flow yourself); `curl -X POST http://localhost:8080/gateway/mock/down/<service>` then the feature's pages show ServiceUnavailable and other features still work.
- Depends on: P10, P4. Commit per feature: `frontend: <feature> screens`.
- Effort: 66 to 102 h total. Risk: medium (volume; mocks cannot exercise stateful flows).

### P12. Switch from mocks to real services, one at a time

- Goal: replace each Prism instance by the real service as teammates finish, with no Angular change.
- Notion pages: Angular - Mock API (contract check section), Testing and Quality.
- Creates: `tools/contract-check.mjs` (promoted from stretch, my addition) or a Prism proxy-mode check; a table in `docs/integration-log.md` of which services are real.
- Acceptance checks: per service: stop its Prism port, start the real service on the same port, repeat the feature walk-through in the browser, run the contract check (GET shapes against the OpenAPI examples), fix drift by raising it with the owner, never by editing their folder.
- Depends on: P7, P11 and each teammate's service. Effort: 8 to 14 h. Risk: medium (contract drift). Commit: `frontend: fixes after switching to real <service>`.

### P13. Integration (prompt L11)

- Goal: the whole system passes the functional scenarios from one command.
- Notion pages: End-to-End Scenarios (curl), Event Catalogue, Resilience Demo, Testing and Quality.
- Creates: `scripts/e2e.sh` (scenarios 1 to 7 and 12 with a PASS/FAIL `check` helper, unique names per run, B9), `scripts/reset.sh`, `docs/integration-log.md` updates.
- Acceptance checks: `./scripts/reset.sh && ./scripts/e2e.sh` prints a PASS/FAIL line per expectation and a summary with zero FAIL; run twice in a row (second run via the reset). Each FAIL is attributed to a service and API Spec rule and reported to the owner (I do not edit their folder).
- Depends on: P12 (all real services). Effort: 15 to 28 h (writing 5 to 8; chasing failures 10 to 20). Risk: **high** (first time all services run together).
- Commit: `scripts: e2e scenarios 1-7 and 12`.

### P14. Resilience and rehearsal

- Goal: every row of the Resilience Demo table tested by really stopping the thing.
- Notion pages: Resilience Demo, End-to-End Scenarios (8 to 11), Deliverables and Defence.
- Creates: `docs/resilience-results.md` (one line per row: what I stopped, what I observed, what degraded), screenshots or a short screen recording as backup.
- Acceptance checks: Scenarios 8, 9, 10, 11 by hand exactly as written; plus the rows without a scenario: Reception, Pharmacy, Staff, Keycloak (users already logged in keep working; new login fails) and "gateway starts with all services stopped"; demo script of about 5 minutes run twice in a row; fresh-clone run on a machine that is not yours.
- Depends on: P13. Effort: 6 to 14 h. Risk: medium. Commit: `docs: resilience test results`.

### P15. Documentation and defence (prompt L12)

- Goal: a stranger can clone, run and understand.
- Notion pages: Deliverables and Defence, Decisions Log, Resilience Demo, Testing and Quality.
- Creates: completed `README.md`, `docs/architecture.md` (Mermaid, solid arrows for REST, dashed for events, stack and DB per service), `docs/technical-choices.md` (the justification list), `docs/PROMPTS.md` completed, Postman collections present per service, exported spec/contracts in `docs/`.
- Acceptance checks: the checklist in section 11.
- Depends on: P14. Effort: 8 to 14 h. Risk: low. Commit: `docs: readme, architecture, technical choices`.

---

## 6. Handoff plan

### 6.1 What must be true before I give anyone a stub (all checked in P9)

1. `main` is protected; CODEOWNERS lists each owner's service; teammates are collaborators.
2. `docker compose -f infra/docker-compose.yml up -d` gives Postgres (healthy), RabbitMQ (healthy), Keycloak (running) and, if Q8, the full RabbitMQ topology.
3. `./scripts/token.sh doctor1` returns a token with `staffId`, `realm_access.roles`, issuer `http://localhost:8180/realms/sgh`.
4. Gateway starts with all services stopped and routes to a running Patient.
5. For their service: stack decided; stub passes all 10 checks of **[Stack Templates]** section 3 plus M5 (`GET /api/_stub/ping` 401/403/200); stub CORS-free (B18).
6. `contracts/openapi/<service>.yaml` linted, equal to the service's `openapi.yaml`.
7. Seed rows for that service from Seed Data load idempotently and the "Checks after seeding" line for it passes.
8. `services/<name>/CLAUDE.md` filled in; root CLAUDE.md present; `docs/spec/` snapshot committed with the time table (Q7); `docs/PROMPTS.md` template present.
9. Fresh-clone run of P9 passed.

### 6.2 Message to each teammate (replace the brackets)

> Hi [name], we are building SGH (hospital management, microservices). You own **[service name]** (port [port], stack [stack]).
> Repository: [GitHub link]. Clone it and read `README.md` and `CLAUDE.md` first. Your folder is `services/[service-name]`. Do not edit anything outside it. If a contract looks wrong, tell me; I change the Notion spec, then the contract.
> Start: `docker compose -f infra/docker-compose.yml up -d`, then your stub: `[run command]`. Before real work, run `./scripts/stub-check.sh [port] [service-name]` and send me the output. [Option B only: build your stub from `docs/spec/Stack Templates...md` section 3 first.]
> Branch: `feature/[service-name]-<topic>`, one PR per step, I review every PR. Log every significant AI prompt in `docs/PROMPTS.md` and be ready to explain every line at the defence.
> Paste this into your Claude Code session from the repository root:
>
> ```
> I own services/[service-name]. Read CLAUDE.md first. Then read, from docs/spec/: [Service] API Spec, Domain Model and Business Rules
> (this service's section and the cross-cutting rules X-1 to X-7), Seed Data and Fixtures (this service's rows), API Contracts and Conventions,
> Event Catalogue, Stack Templates, and the row for this service in Resilience Demo.
> Implement everything on the [Service] API Spec page, in services/[service-name] only, in this order:
> 1 models, migrations and the seed check; 2 read endpoints; 3 write endpoints with every business rule; 4 events (publish and consume,
> idempotent); 5 outgoing calls with the documented fallbacks; 6 the tests listed on the API Spec page; 7 the README.
> After each step run the tests and show me the output. Do not change any other folder. If the contract looks wrong or unclear, stop and tell
> me instead of changing behaviour. When finished, go through the 'Done when' list of the API Spec page and report every item with evidence.
> ```
> (The owner prompt above is copied verbatim from **[Build Prompts by Phase]**.) Service-specific extra for [Reception]: it also needs `sgh-reception-svc` credentials (Q6) for the 60-second verification job.

Service-specific notes I will add per message: Lab and Pharmacy must also pass the "stop the service, publish, restart, message processed" test; Consultation and Reception need the Patient fallback test with a stopped Patient; Staff must make `/api/staff/directory` match before `/{id}`; Pharmacy needs the row-lock/atomic update on stock.

### 6.3 How I check a teammate's work without editing their folder

1. **Their PR:** I read the diff for the review points in section 10 and run their documented test command myself.
2. **Stub gate:** `./scripts/stub-check.sh <port> <service>` (10 checks).
3. **Contract gate:** `./scripts/check-contracts.sh` (service copy equals `contracts/`), then `tools/contract-check.mjs` or Prism in proxy mode against the running service to find responses that differ from the OpenAPI examples. (Prism proxy-mode validation: UNVERIFIED, I will test it on Patient first.)
4. **Rule gate:** the "Tests that must exist (minimum)" list on their API Spec page; I tick each line with evidence; "Done when" list from the same page.
5. **Scenario gate:** the scenario slices from **[End-to-End Scenarios (curl)]** that touch their service (Reception: 2, 6, 9; Consultation: 3, 4, 8, 10; Lab: 4, 8; Pharmacy: 5, 10; Staff: 7, 12; Patient: 1, 2) after `./scripts/reset.sh`.
6. **Resilience gate:** their row in **[Resilience Demo]** by really stopping what it names.
7. **Understanding gate (course requirement):** each teammate walks me through one rule and one test of their service; I ask them to explain one flow that crosses another person's service.

---

## 7. Front-end plan

Principles from **[Angular - Architecture and Shared Code]**: standalone components, Angular Material, reactive forms, signals, keycloak-js, one lazy route file per feature, no imports between features, every list page has loading/empty/error/ServiceUnavailable states, no raw UUIDs as labels.

1. **Before any real service exists (P10, P11 against P6 mocks):** the whole shell and all seven feature areas. Mock mode gives a login select of the eight users and the token `mock-token`, so role menus, guards and the degraded-service banner can be built and demonstrated alone.
2. **Order of features and why:**
   1. Patients (Screens A): simplest CRUD, defines the DataTable/form patterns, and the first real service (Patient) exists first.
   2. Reception: appointments then invoices: biggest of Screens A; slot grid and 409 handling are the first stateful interactions.
   3. Consultation: the core clinical flow (SOAP, vitals, prescription builder, lab order); depends on patterns from 1 and 2.
   4. Lab: queue, result entry, validation (forms with flags).
   5. Pharmacy: queue, dispensing with stock check.
   6. Staff: admin CRUD (small, reuses the form pattern).
   7. Patient portal: read-only, reuses earlier components; last because it needs the other services' patient-restricted lists.
3. **Mocks cannot show:** a created appointment appearing in a list, a real 409, a flag computed by Lab, or event-driven changes (lab result arriving later). These are verified only after the switch (P12), so the unit tests named on the Screens pages (form validators, dispense quantity rule, flag badge mapping, role-based action visibility) are the safety net before then.
4. **Switch point:** do the real-login check at the end of P10 (Keycloak + real gateway + real Patient). After that, per service in the order the real services arrive (Patient first, Staff second, then as teammates finish): stop its Prism port, start the real service on the same port, repeat the walk-through, run the contract check. Keep `npm run start:mock` working until the end for demos without services.
5. **Resilience in the UI:** the `ServiceStatusService` polls `/gateway/health/services` every 5 s; the same mock `down/up` control and the real "stop the process" scenario must produce the same screens. Both are tested in P11 and P14.

---

## 8. Integration and resilience plan

**First whole-system run:** P9 (stubs + gateway + infra, Scenario 1 and health). It proves routing, tokens and 401/403 through the gateway before any business logic exists.

**Integration checkpoints** (from **[GitHub Workflow]**):
1. Skeleton check: every service starts and answers `/health` (P9).
2. Contract check: gateway reaches every service; contract checker green (P12).
3. Event check: Consultation -> Lab -> Consultation and Consultation -> Pharmacy flow through RabbitMQ (Scenarios 3, 4, 5, P13).
4. Demo check: resilience script from a clean clone (P14).

**How the scenarios are used:** Scenarios 1 to 7 and 12 are automated in `scripts/e2e.sh` (P13) and run before every checkpoint and before the demo; 8 to 11 are run by hand against really stopped services (P14). Each FAIL maps to a rule id in **[Domain Model and Business Rules]** and a line in the owner's API Spec "Tests that must exist".

**Failures to test first (ordered by chance of breakage and cost of discovering late):**
1. Every service started with Postgres stopped, then Postgres started (X-6, M6): fails in most frameworks by default.
2. Every service started with RabbitMQ stopped, then RabbitMQ started: reconnect loop and queue declaration (M7, Stub check 8).
3. Lab stopped, order a test, restart Lab (Scenario 8): proves the headline demo and the queue-exists race.
4. Patient stopped (Scenario 9): Reception 201 with `patientVerified=false`, then flips within about 70 s (needs M1 solved).
5. Consultation stopped (Scenario 10): Pharmacy dispenses from its local copy.
6. RabbitMQ stopped (Scenario 11): 201 returned quickly (B10), error logged, lost event documented.
7. Keycloak stopped: logged-in users keep working until token expiry (15 min), new logins fail; a service restarted during that outage cannot fetch keys (B14).
8. Gateway started with all downstream services stopped.
9. Duplicate event delivery (replay a message from the management UI): one row only (X-5).
10. Token expiry during a session: silent refresh works, no logout loop.

---

## 9. Risks and mitigations (top ten)

1. **Keycloak claims missing or wrong (M1/B1).** Unverified realm JSON and user-profile handling. Mitigation: P3 does not end until `staffId`, `patientId`, `preferred_username` and roles are decoded for three users and the issuer matches; write the working syntax in `docs/keycloak-notes.md`; pin the image tag.
2. **Token issuer mismatch (`localhost` vs `127.0.0.1` vs container name).** Mitigation: `KEYCLOAK_ISSUER_URL` fixed to `http://localhost:8180/realms/sgh` in every `.env.example`; a negative test in P3; README troubleshooting line; never run a service inside a container.
3. **Teacher rejects SGH, or requires Eureka/Spring Cloud.** Mitigation: send the email today; do only P0 to P3 and generic tooling until answered; the reuse table in 4.2; gateway choice tied to the answer (Q5).
4. **Contract drift** (service differs from OpenAPI, or two copies differ). Mitigation: `contracts/` canonical, `check-contracts.sh` in the stub gate and in CI; Prism proxy/contract check each time a teammate merges; only I (via Notion edit) change contracts.
5. **A service cannot start without its database or broker (M6/M7).** Mitigation: the Patient reference sets the pattern; check #1 and #7/#8 of the stub list run before accepting any PR; pre-declared RabbitMQ topology.
6. **A teammate blocked by a missing contract or silent spec change.** Mitigation: contracts frozen at P4 with a change rule (Notion edit, then contracts PR, tag the owner); `docs/spec/` snapshot with a time table; spec check at the start of every phase; a "blocked" template message with the exact page and line.
7. **Gateway owner (or any teammate) running late.** Mitigation: you build the gateway (P7); the Staff owner is not on the critical path; mock gateway keeps the front end moving; each service is independently runnable so partial demos still work; weekly status table in `docs/integration-log.md`.
8. **Notion pages edited mid-build.** Mitigation: record last-edited times (section 2), spec check each phase, snapshot for teammates with dates, `docs/spec-changes.md`; if a change touches a finished phase, I list the impact before touching code.
9. **Windows/Docker environment problems** (WSL, CRLF scripts, jq, port clashes, 23 GB RAM budget with six JVM/Node/Python processes plus Keycloak and Angular). Mitigation: Q2 resolved in P0; `.gitattributes`; `reset.sh`; `health.sh`; start only the services needed for the task; document the minimum commands per stack.
10. **Scope and hours.** About 215 to 370 focused hours for you, and Angular alone is 80 to 130. Mitigation: option B for stubs, strict "no stretch goals" rule, features built in value order (section 7) so a cut loses the portal and staff screens first, and the Playbook rule "do not add features not in the spec".

Also tracked: your own understanding. The defence asks every member to explain the whole system, so each phase ends with me explaining to you what was built and you answering in your own words before commit (section 10).

---

## 10. Daily working loop

For each step (one phase, or one feature within P11):

1. **Spec check:** re-fetch the Notion pages the step names; compare times with section 2; stop and report if anything changed.
2. **Prompt:** start Claude Code in the repository root (CLAUDE.md is loaded) and name the pages in the prompt, as the Build Prompts page prescribes ("Name the pages to read in every prompt"). Use the L-prompt from **[Build Prompts by Phase]** when it exists; do not combine prompts.
3. **Evidence to demand:** the exact command, its output, and for failures the exact error. "It works" without output is rejected ([Playbook] section 5). For acceptance checks, I show the list from section 5 line by line.
4. **Review the diff before every commit.** Check for: invented ids (compare with Seed Data), extra endpoints or fields not on the API Spec page, missing rules (compare with rule ids PAT/REC/CON/LAB/PHA/STF/X), missing role checks (403 vs 401), hard-coded secrets (only the dev values from Infra Files), swallowed errors, `console.log` of tokens or bodies (X-7), untested branches, copies of OpenAPI that differ from `contracts/`.
5. **Understand it:** you explain back one new function or rule per step; anything you cannot explain gets simplified or removed.
6. **Commit** after the acceptance checks pass: `<area>: message`, one phase per commit (feature branch + PR once the repo is on GitHub).
7. **When the spec is wrong or unclear:** stop, write the finding in `docs/spec-changes.md`, and tell you the exact page and replacement text. You edit Notion; then I re-fetch, update the `docs/spec/` snapshot and `contracts/`, then fix the code. I never edit Notion.
8. **Log in `docs/PROMPTS.md`:** every significant prompt (any prompt that generated code you merged): context, exact prompt, output used, verification, corrections, decision ([Deliverables and Defence] template). Small clarifications are not logged. At minimum one entry per phase.
9. **End of day:** update `docs/integration-log.md` (what runs, what is mocked, what is blocked) so the next session starts from facts.

---

## 11. Definition of done for the whole project

Mapped to the success criteria of the root page (**[SGH - Hospital Management System]** section 2) and to **[Deliverables and Defence]**.

| # | Item | Proof |
|---|------|-------|
| 1 | All 6 services start locally with one documented command each | each service README; `./scripts/health.sh` prints UP for gateway and six services |
| 2 | Angular logs in and reaches every service through the gateway | `npm start`; log in as reception1, doctor1, lab1, pharmacist1, admin1, patient1; open one screen per service; browser network tab shows only `localhost:8080` |
| 3 | At least 3 different back-end technologies | a table in `docs/architecture.md` listing stack per service (needs at least 3 distinct) |
| 4 | Each service has its own database, no shared tables | `docker exec sgh-postgres psql -U sgh -c "\l"` shows six `sgh_*`; each service `.env.example` points only to its own `DB_NAME` (grep) |
| 5 | Every service exposes OpenAPI/Swagger | `curl -s http://localhost:<port>/openapi.json` and `/docs` for all six; `./scripts/check-contracts.sh` clean |
| 6 | Sync (REST) and async (RabbitMQ) both work end to end | `./scripts/e2e.sh` Scenarios 2 to 5 PASS (sync: Reception->Patient, Pharmacy->Consultation; async: lab and prescription flows); RabbitMQ UI shows `sgh.events` and queues |
| 7 | Stopping any one service does not take down the others | `docs/resilience-results.md` has all Resilience Demo rows tested; Scenarios 8 to 11 results; demo script run twice |
| 8 | JWT authentication with roles protects the API | Scenario 1 PASS; no token 401, wrong role 403, right role 200 on the gateway and directly on each service; Postman 401/403/200 collection |
| 9 | README, architecture diagram and PROMPTS.md in the repo | `README.md` sections from Deliverables list present; `docs/architecture.md` Mermaid with solid (REST) and dashed (events) arrows, stack and DB per service; `docs/PROMPTS.md` has entries per phase |
| 10 | Each member can explain the full architecture | two timed rehearsals, each person presents a part they did not build; question list from Deliverables answered; recorded in `docs/defence-rehearsal.md` |
| 11 | Deliverable: `openapi.yaml`, `.env.example`, README, Postman per service folder | `ls services/*/{README.md,.env.example,openapi.yaml}` and Postman collection file present in each |
| 12 | Deliverable: tests and the command to run them | each service README test command passes; `frontend`: `npm test`, `npm run build`, `npm run lint` pass |
| 13 | Deliverable: event catalogue and contract conventions in `docs/` | `contracts/events/*`, `contracts/conventions.md`, plus Notion export copy in `docs/spec/` |
| 14 | Deliverable: justification of technical choices | `docs/technical-choices.md` answers each bullet of the Deliverables list |
| 15 | Deliverable: readable Git history with pull requests | `git log --oneline` shows area-prefixed commits; GitHub shows reviewed PRs from each teammate |
| 16 | Fresh-clone run on a machine that is not the author's | a teammate follows only the README; the result and time are noted in `docs/defence-rehearsal.md` |
| 17 | Backup if the demo fails | screenshots or a recording of the successful resilience run in `docs/demo/` |
| 18 | Known limits stated | README "Known limits": gateway single point of failure, events lost during broker outage (D12), eventual consistency, seed timestamps relative to first start |
