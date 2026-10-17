# Doctor module: what is left and how to do it

Written 2026-10-08. Scope: everything a doctor does in SGH, from the screen to the service behind it.
Cites Notion page titles for every spec claim. **UNVERIFIED** = never run by anyone.

## 0. Spec check status (read this first)

The Notion connection was lost during this session, and the page URL cannot be read without a login. **The Notion re-check requested for this plan has NOT been done.** Everything below comes from my read of the pages on **2026-10-06 (14:41Z to 14:55Z)**, and the front end was built against that read.

Step 1 of the plan is therefore the spec check. Pages the doctor module depends on, with the last-edited time I recorded. Any page whose time is later than this has changed and must be diffed before building:

| Page | Last edited (UTC) recorded |
|------|----------------------------|
| Consultation Service - API Spec | 2026-10-06 14:43:32 |
| Domain Model and Business Rules | 2026-10-06 14:41:29 |
| Seed Data and Fixtures | 2026-10-06 14:41:29 |
| Event Catalogue (RabbitMQ) | 2026-10-05 22:28:32 |
| API Contracts and Conventions | 2026-10-06 14:52:48 |
| Stack Templates | 2026-10-06 14:45:36 |
| Infra Files | 2026-10-06 14:45:36 |
| Keycloak Setup | 2026-10-06 14:45:39 |
| Gateway Config | 2026-10-06 14:45:39 |
| Angular - Architecture and Shared Code | 2026-10-06 14:47:34 |
| Angular - Screens A (patients, reception) | 2026-10-06 14:53:45 |
| Angular - Screens B (consultation, lab, pharmacy) | 2026-10-06 14:47:34 |
| Angular - Mock API | 2026-10-06 14:47:34 |
| Decisions Log (D9 to D20) | 2026-10-06 14:51:05 |
| Resilience Demo | 2026-10-06 14:52:59 |
| End-to-End Scenarios (curl) | 2026-10-06 14:49:02 |
| Patient / Reception / Lab / Pharmacy / Staff API Specs | 14:42:17 / 14:42:19 / 14:43:34 / 14:43:37 / 14:43:40 |

How to do the check: re-connect Notion (the sign-in link is in the chat), fetch these pages, compare times, then diff only the pages that changed against section 3 (endpoints, rules, events) of this plan. Record every change in `docs/spec-changes.md`.

## 1. What "the doctor module" is

**For the user (what a doctor can do):** see their own agenda, find patients and read their file, start a consultation (from the agenda or a patient), write SOAP notes, record vital signs, prescribe, order lab tests, read validated lab results, check whether a prescription was dispensed, and sign the consultation.

**Services that make this work** (Service 3 Consultation is the doctor's own service per the Consultation overview page):

| Piece | Owner in the spec | Doctor's use |
|-------|-------------------|--------------|
| Consultation service (8083, `sgh_consultation`) | **the doctor module** | everything above |
| Patient service (8081) | Patient owner | patient summary and file |
| Reception service (8082) | Reception owner | the agenda, "Complete" |
| Lab service (8084) | Lab owner | receives lab orders, returns results |
| Pharmacy service (8085) | Pharmacy owner | receives prescriptions, dispensing status |
| Staff service (8086) | Staff owner | doctor names, `/api/me` |
| Gateway (8080), Keycloak (8180), RabbitMQ (5672) | lead / Staff owner | routing, login with the `staffId` claim, events |

## 2. Where we are

**Front end (doctor screens), built against mocks, 266 unit tests pass, lint and build clean:**

| Screen | State |
|--------|-------|
| Agenda `/appointments` (doctor forced to own appointments, Complete, Start consultation) | built; no tests for the screen itself |
| Patients list, detail with 4 tabs, medical-file note | built; no tests for patient detail |
| Consultation list (defaults to own) and workspace (SOAP, vitals, prescriptions, lab, sign) | built; workspace has 3 tests, rules have 15 |
| Vitals page | built, tested |
| Lab results, lab request detail, Prescriptions status, prescription detail | built this week, read-only, tested |
| Profile, status bar, theme | built |

**Known gaps in what exists:**
1. Actions never submitted in a browser by me: Save draft, Sign, 409 "already signed", prescription submit, lab order submit, vitals submit, Add note, New consultation, Start consultation, Complete.
2. Workspace shows "Issued" for a prescription when Pharmacy is stopped (expected "Pharmacy status unavailable"). Probably a cached status. Unconfirmed.
3. Agenda and patient detail have no component tests.
4. "Record new vital signs" heading sits tight against its fields.
5. The login and landing pages carry invented content (hospital name, phone numbers, "accredited", fake telemetry), a blue-to-green logo gradient and 69 hard-coded colours, against your brief.
6. The pharmacy queue sends two statuses in one parameter, which the Pharmacy API Spec does not define.
7. The doctor work is on `feature/doctor-polish`, not merged.

**Backend:** nothing exists. No service, infra, Keycloak realm, contracts, gateway or Docker (not installed on this machine). The only server-side thing in the repo is `tools/mock`, which replays fixed examples.

## 3. The Consultation service, specified (source for track B)

All from **Consultation Service - API Spec**, **Domain Model and Business Rules**, **Seed Data and Fixtures**, **Event Catalogue**, **Stack Templates**.

**Endpoints** (base `/api`, all need a JWT except `/health`):

| Method and path | Roles | Notes |
|-----------------|-------|-------|
| `POST /consultations` | DOCTOR | body `patientId`, optional `appointmentId` and notes. 201 + Location. `doctorId` from token `staffId` (CON-1, 403 if missing). Calls Patient summary (CON-2). |
| `GET /consultations?patientId&doctorId&status&page&size` | DOCTOR, NURSE, ADMIN; PATIENT forced to own | paged, newest first (CON-9) |
| `GET /consultations/{id}` | same visibility | 404 / 403 |
| `PUT /consultations/{id}` | DOCTOR, own only | 409 when SIGNED (CON-3), 403 for another doctor |
| `POST /consultations/{id}/sign` | DOCTOR, own | 422 if assessment or plan blank, 409 if already signed (CON-4) |
| `POST /vitals`, `GET /vitals?patientId&consultationId` | NURSE, DOCTOR (GET also ADMIN) | at least one value, ranges (CON-8), `recordedBy` from token |
| `POST/GET /consultations/{id}/prescriptions` | POST DOCTOR own; GET DOCTOR, NURSE, ADMIN, PHARMACIST, PATIENT own | 1 to 20 items (CON-5); publishes `prescription.created`; GET is a plain array; PHARMACIST only this endpoint (CON-10, D20) |
| `POST/GET /consultations/{id}/lab-orders` | POST DOCTOR own; GET DOCTOR, NURSE, ADMIN | 1 to 10 tests, unique codes (CON-6); publishes `lab.request.created` after commit; works with Lab down |
| `GET /consultations/{id}/lab-results` | DOCTOR, NURSE, ADMIN, PATIENT own | plain array, empty until results arrive |
| `GET /health`, `/docs`, `/openapi.json` | none | health reports the process only (X-6) |

**Rules to implement and test:** CON-1 to CON-10 and X-1 to X-7 (Domain Model). Highlights: 2 s timeout on the Patient call with `patientSnapshot = null` fallback (never blocks creation); consumer idempotent via `processed_events` (CON-7, X-5); service starts with DB, broker and peers down (X-6); never log tokens (X-7).

**Database** `sgh_consultation`: `consultations`, `vital_signs`, `prescriptions`, `prescription_items`, `lab_orders`, `lab_order_tests`, `lab_result_copies`, `processed_events`. Migrations create them; an idempotent seed loads C1, C2, V1, V2, R1 (+ 2 items), L1 (VALIDATED), L2 (REQUESTED), and the lab result copy of L1 with the fixed ids from Seed Data.

**Events:** exchange `sgh.events` (topic, durable). Publishes `lab.request.created` (payload `labRequestId` = the order id) and `prescription.created`. Consumes `lab.result.ready` from queue `consultation.lab.result.ready` with dead-letter exchange `sgh.events.dlx` to `sgh.events.dlq`; manual ack after saving the effect and the `eventId`; prefetch 10; reconnect with backoff 1, 2, 4, 8, 16, 30 s; publish retries 3 times in the background, never blocking the request.

**Env:** `PORT=8083`, `DB_NAME=sgh_consultation`, `PATIENT_SERVICE_URL=http://localhost:8081`, `HTTP_TIMEOUT_MS=2000`, `RABBITMQ_URL`, `KEYCLOAK_ISSUER_URL=http://localhost:8180/realms/sgh`, `KEYCLOAK_JWKS_URL`, `SEED=true` (Infra Files registry).

**Minimum tests (from the API Spec page):** doctorId from token even if the body sends another; NURSE creating a consultation 403; Patient down gives snapshot null and unknown patient gives 422; PUT on SIGNED 409, sign with blank plan 422, sign twice 409; prescription with zero items 422 and one valid prescription publishes one event; lab order with the broker down still returns 201; `lab.result.ready` delivered twice gives one copy and a VALIDATED order; vitals rules (diastolic >= systolic 422, temperature 50 422, empty 422); PHARMACIST can GET prescriptions but not POST (403) and not GET consultations (403); PATIENT sees only own.

## 4. The plan

Four tracks. A can start now with no backend. B needs a decision (section 6) and some shared infra. C and D need other people's work. E runs throughout.

### Track A: finish and prove the doctor front end (no backend needed)

| # | Task | How | Done when | Hours |
|---|------|-----|-----------|-------|
| A0 | Spec check | re-connect Notion, compare times (section 0), diff changed pages against `docs/FRONTEND-DECISIONS.md` and section 3 | table in `docs/spec-changes.md`; nothing changed, or changes triaged | 0.5-2 |
| A1 | Click-through of every doctor action | Playwright script in the scratchpad against `npm run start:mock`: Save draft, Sign (confirm, 409 path with `Prefer: code=409`), prescription, lab order (Lab up and down), vitals (valid, invalid), Add note, New consultation, Start consultation, Complete; save screenshots | each action works or becomes a bug in A2; results in `docs/doctor-walkthrough.md` | 3-5 |
| A2 | Fix what A1 finds, and gaps 2 and 4 | fix, add a regression test per bug | tests green, walkthrough re-run clean | 2-5 |
| A3 | Missing component tests | agenda (doctor forced to self, Complete, Start consultation), patient detail (tabs degrade independently, Add note, role-based buttons), workspace (owner vs other doctor read-only, sign disabled until assessment and plan, 409 handling, Pharmacy down, Lab down fallback) | 266 grows by about 30; mutation spot-check as before | 4-6 |
| A4 | Design drift on the doctor's path | remove invented content from login and landing (name "SGH", no phone numbers, no "accredited", no fake telemetry) or delete `/landing`; one brand blue (drop the green gradient); move literal colours into `_tokens.scss`; set `endOfLine: auto` so `format:check` passes on Windows | `grep` for literal colours in components returns only tokens; screenshots reviewed | 3-5 |
| A5 | Accessibility pass | keyboard-only walkthrough of the doctor flows, focus order in dialogs, labels, contrast check in both themes, `design:accessibility-review` skill | no blocking issue; findings logged | 2-3 |
| A6 | Merge | branch `feature/doctor-polish` into the working branch via PR; `main` currently holds Antigravity's direct commits | clean history | 0.5-1 |

### Track B: build the Consultation service (the doctor's backend)

Order follows the owner prompt in **Build Prompts by Phase**: models and seed, read endpoints, write endpoints with rules, events, outgoing call with fallback, tests, README. After each step run the tests and show the output.

| # | Task | How | Acceptance (commands) | Hours |
|---|------|-----|-----------------------|-------|
| B0 | Prerequisites | decisions in section 6; Docker; `infra/` with Postgres and RabbitMQ; Keycloak realm with `staffId`; `contracts/openapi/consultation.yaml`; stub from Stack Templates | `docker compose -f infra/docker-compose.yml up -d`; `./scripts/token.sh doctor1` decodes with `staffId`; stub passes the 10 checks | shared with lead phases P2 to P4, P8 (see section 5) |
| B1 | Models, migrations, seed | tables in section 3; idempotent seed with fixed ids | restart twice, row counts unchanged; "Checks after seeding" for consultation data | 3-5 |
| B2 | Auth and shared edges | JWT via JWKS (lazy), roles from `realm_access.roles`, error body, correlation id, paging helper, request log without tokens | no token 401, wrong role 403, right role 200 on a placeholder; `/health` with DB stopped returns 200 | 3-5 |
| B3 | Read endpoints | list, get, vitals list, sub-collections (arrays), visibility rules (CON-9) | curl as doctor1, nurse1, patient1, pharmacist1 against the seed; PHARMACIST gets 403 on `/consultations` | 3-4 |
| B4 | Write endpoints and rules | create (CON-1, CON-2), update (CON-3), sign (CON-4), vitals (CON-8), prescription (CON-5), lab order (CON-6) with ownership checks | every rule has a failing-then-passing test; 409 and 422 bodies match the shared error shape | 6-10 |
| B5 | Outgoing call and fallbacks | Patient summary: 2 s timeout, forward `Authorization` and `X-Correlation-Id`; 404 gives 422; timeout, refused or 5xx gives `patientSnapshot = null` | stop Patient: create still returns 201 with snapshot null | 2-3 |
| B6 | Events | publish after commit on a background queue with 3 retries; consume `lab.result.ready` idempotently; topology and dead-letter queue | replay a message: one copy; stop Lab, order, restart Lab: request appears; stop RabbitMQ: order still 201, error logged | 5-8 |
| B7 | Tests and docs | the minimum tests of section 3; README with run and test commands, env vars, seed note, link to the API Spec page, known limits | one documented command runs everything; "Done when" list ticked with evidence | 3-5 |

### Track C: connect the doctor module to the rest

| # | Task | How | Done when | Hours |
|---|------|-----|-----------|-------|
| C1 | Contract match | compare `contracts/openapi/consultation.yaml` and the mock `consultation.yaml` with the real service responses (Prism proxy mode or a small script) | shapes equal; mock updated where it drifted | 2-3 |
| C2 | Switch mocks to real, one service at a time | order: Staff (me, directory), Patient, Consultation, Reception (agenda), Lab, Pharmacy; stop each Prism port, start the real service, rerun the A1 walkthrough | doctor screens work with no Angular change | 3-5 |
| C3 | Real login | `KeycloakAuthBackend` (keycloak-js, PKCE) behind the existing `AuthBackend` interface; check `staffId` drives the ownership rules | doctor1 logs in; Sign works only on own consultations | 3-5 |
| C4 | E2E Scenarios 3, 4, 8, 10 (doctor path) | End-to-End Scenarios (curl) plus a UI run | each expectation PASS | 2-3 |

### Track D: resilience for the doctor

From **Resilience Demo** and Scenarios 8 to 11, tested by really stopping the thing:

| Stop | Doctor must still be able to | Check |
|------|------------------------------|-------|
| Lab | order tests (queued), do everything else | order returns 201, appears in Lab after restart |
| Patient | create a consultation (snapshot null, banner), see the agenda ("Patient unavailable") | Scenario 9 |
| Pharmacy | prescribe; status shows "Pharmacy status unavailable" | confirm gap 2 is fixed |
| RabbitMQ | write notes, sign, order (event lost, error logged, documented limit D12) | Scenario 11 |
| Keycloak | keep working while logged in; new logins fail | token validated locally |
| Consultation (the doctor's own service) | other roles keep working; doctor sees only the Consultation screens unavailable | Scenario 10 slice |

Hours 3-6 once B and C exist.

### Track E: quality, traceability, defence

- `docs/PROMPTS.md` entry per significant prompt (context, exact prompt, output used, verification, corrections, decision). 2-3 h across the work.
- Be able to explain, without notes: a doctor request from browser to database and back; why the order is an event and the patient lookup is REST; what happens with the broker down; where `doctorId` comes from and why the client never sends it; how idempotency works. 2 h to rehearse.
- A 5-minute doctor demo script: log in, agenda, start consultation, vitals, order lab, prescribe, sign, stop Lab and order again, restart, see results. 1 h, rehearsed twice.

## 5. Order, effort and critical path

```
A0 spec check ──> A1 ──> A2 ──> A3 ──> A4 ──> A5 ──> A6          (front end, about 15-27 h)
      │
      └──> decisions (section 6) ──> B0 prerequisites ──> B1 ──> B2 ──> B3 ──> B4 ──> B5 ──> B6 ──> B7
                                                                                              │
                              Patient, Lab, Pharmacy, Staff services (teammates) ──> C1 ──> C2 ──> C3 ──> C4 ──> D
```

| Track | Hours (focused) |
|-------|-----------------|
| A front end | 15-27 |
| B Consultation service | 25-40 (plus B0 prerequisites) |
| C integration | 10-16 |
| D resilience | 3-6 |
| E | 5-6 |
| **Total** | **about 58-95** |

B0 depends on shared phases: Docker and Postgres/RabbitMQ (infra), the Keycloak realm (the doctor needs `staffId`), the consultation contract, and the gateway routes for `/api/consultations/**` and `/api/vitals/**`. Until those exist, B can run against a local Postgres/RabbitMQ and tests that sign their own JWTs, and connect to the real realm later. Track A has no dependency and should start first.

**Risks:** (1) Keycloak `staffId` claim not appearing, which would break ownership checks (the realm JSON is UNVERIFIED); (2) the service failing to start without Postgres or RabbitMQ (X-6 is not the default in any framework); (3) a lab order lost when the Lab queue does not yet exist (topology must be created in advance); (4) a teammate's service differing from the contract; (5) Notion edited while building (mitigation: A0 at the start of every task); (6) the Docker install on this Windows machine.

## 6. Decisions I need from you

1. **Is the Consultation service your backend module as well as the doctor screens?** I assumed yes. If another teammate owns the service, Track B becomes a review role and the plan shrinks by 25-40 h.
2. **Stack for the Consultation service.** The spec suggests .NET or Express. My recommendation is Express with TypeScript: Node 24 is installed, the language matches the front end, and Stack Templates lists the libraries (express, jose, zod, node-pg-migrate, amqplib, swagger-ui-express, pino, vitest, supertest). Spring Boot is the alternative (JDK 17 installed, richest template). .NET would need an SDK install.
3. **Docker on this machine** (WSL2 and Docker Desktop, not installed) or no containers.
4. **Landing page:** remove it, or keep a plain version without invented content (A4).
5. **Pharmacy status filter** (gap 6): it needs the Pharmacy owner's agreement on `status=A,B`.

## 7. How I will work on each task

1. Spec check of the pages the task names (A0 procedure).
2. Contracts first: change the API Spec page or `contracts/` before behaviour; tell you what to edit in Notion (I do not edit it).
3. Small steps; for each: implement, run, show the command and its output, then commit with a prefix (`consultation:`, `frontend:`).
4. Tests with every change; I break the code on purpose to confirm they fail.
5. Browser or curl evidence for each acceptance line; anything not run is reported as not run.
6. Review the diff for invented ids, extra endpoints, missing rules and secrets before each commit.
7. Log significant prompts in `docs/PROMPTS.md`.
