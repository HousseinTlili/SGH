# AI use log

One entry for every significant use of an AI assistant (course requirement, see Deliverables and Defence). Verify and understand everything before it is merged.

Template:

```
## Entry <number>
Context:      what I was working on
Prompt:       the exact prompt
Output used:  which part of the answer I used
Verification: how I checked it (ran it, tested it, read the docs)
Corrections:  what I had to fix or reject
Decision:     what I kept and why
```

## Entry 1
Context:      planning and Notion spec review, 2026-10-06 to 2026-10-17 (Claude Code)
Prompt:       "You are the lead engineer on the SGH hospital management project ... plan only" (full text in the session)
Output used:  docs/PLAN.md (findings M1-M10, B1-B20, phases), docs/DOCTOR-PLAN.md, docs/MASTER-PLAN.md, Decisions Log D21-D32 and the addenda in docs/NOTION-ADDENDA.md
Verification: every Notion page re-read and its last-edited time compared; web checks for Keycloak, Spring Cloud Gateway, Prism, RabbitMQ and Angular versions
Corrections:  spec gaps found by reading (for example the Reception job without a token, queues created too late) were written up as decisions
Decision:     decisions D21-D32 adopted as defaults

## Entry 2
Context:      review of the repository and fixes on branch fix/doctor-service-hardening, 2026-10-19 (Claude Code)
Prompt:       "check it and tell me if it's well done and what needs to be fixed" (review only), then "fix everything that needs fixing and make sure it's well done"
Output used:  services/doctor-service (shared error helpers, input validation, RabbitMQ publisher and consumer rewrite, versioned migrations, tests), scripts/stub-check.sh, .github/workflows/ci.yml, README and executable-bit fixes
Verification: ran the doctor-service suite against a local PostgreSQL 16 (55 tests), a real RabbitMQ (events validated against contracts/events/*.json, idempotent consumer, dead-letter queue), and a live service process through a forced disconnect and a full broker stop/start; ran scripts/stub-check.sh against the running service; built, linted and tested the frontend (266 tests) on Node 24; linted the OpenAPI contracts
Corrections:  an early review point was wrong: the _stub/ping endpoint is removed by design once real endpoints exist (D25). Wrong-parameter-type errors were first mapped to 404/422 and then changed to 400 after re-reading Stack Templates. Not verified: the GitHub Actions workflow (not run), real Keycloak (tests use a local token signer), RabbitMQ 4.x (tested on 3.12)
Decision:     publishing keeps retrying while the process lives instead of the 3 attempts in Stack Templates, because three attempts lose events during any broker outage longer than a few seconds; revert if the course rule must be followed literally

## Entry 3
Context:      Phase 1-5 completion: service build fixes, end-to-end integration, full frontend screen completion, resilience verification, and documentation, 2026-11-02 (Antigravity)
Prompt:       "ok start with that plan"
Output used:  
- scripts/dev-services.sh fixes (permissions, virtualenv dependency install for lab-service)
- frontend components: LabQueueComponent, LabRequestDetailComponent technician actions, DrugListComponent, StockAlertsComponent, StockDialogComponent, DrugDialogComponent, PrescriptionDetailComponent dispensing panel, MyAppointmentsComponent, MyInvoicesComponent, MyConsultationsComponent
- frontend cleanup: removed FeaturePlaceholderComponent
- documentation: docs/architecture.md (Mermaid topology, ports, RBAC, messaging), docs/technical-choices.md (architecture justifications), docs/resilience-results.md (automated resilience scenarios 8-11 and demo matrix), Postman collections for all 6 microservices
Verification: 
- Ran all 6 microservices + Spring Cloud Gateway via ./scripts/dev-services.sh
- Black-box stub acceptance check passed for all 6 services (./scripts/stub-check.sh)
- Full E2E test suite passed with 61/61 assertions (./scripts/e2e.sh)
- Automated resilience suite passed with 77/77 assertions (./scripts/e2e.sh --resilience)
- Frontend Vitest suite passed with 284/284 tests; ng lint passed with 0 errors; ng build production bundle generated cleanly
Corrections:  
- Fixed missing executable bits on Maven wrapper scripts (mvnw) for patient-service and staff-service
- Resolved missing Python dependencies (swagger-ui-bundle, alembic, jsonschema) in lab-service virtualenv
- Resolved hanging Angular CLI interactive analytics prompt during background tests
- Corrected type signatures and missing providers in frontend unit tests (provideFakeAuth, signInAs)
Decision:     
- Implemented real-time reference range flag computation in Lab technician view using biological thresholds
- Provided atomic inventory validation and confirmation dialog before dispensing in Pharmacy
- Preserved strict role-based route guards and zoneless Angular 22 signals architecture

## Entry 4
Context:      Patient statistics dashboard on feature/patient-statistics, 2026-11-10
Prompt:       Validate phase 4: GET /api/patients/statistics, roles RECEPTIONIST/DOCTOR/NURSE/ADMIN, OpenAPI Patient only, incomplete files = missing phone/email/address, insurance only if declared insured, keep similar-detection work, branch from current uncommitted work, no commit
Output used:  OpenAPI path + Patient copies, PatientStatisticsService, Angular SVG dashboard, completeness rule without an insured flag
Verification: Maven patient-service tests and Angular patient specs (see session)
Corrections:  none at write time
Decision:     declared insured = at least one of insuranceProvider / insuranceNumber filled; both empty is uninsured and not incomplete

## Entry 5
Context:      Opaque QR for Smart Allergy Passport, 2026-11-13
Prompt:       ajouter le qr
Output used:  patients.passport_token (V4), GET /api/patients/passport/{token}, Angular SVG QR + /patients/passport/:token
Verification: Maven Patient allergy tests + Angular patient/qr specs
Corrections:  none at write time
Decision:     QR encodes only opaque deep-link/token; clinical data loaded after authentication

## Entry 6
Context:      OpenFeign integration (course requirement), 2026-11-13
Prompt:       its a course req, so add it even just in the sake of adding it, even if it doesnt really do a thing, and tell me how to test and what to expect
Output used:  contracts/openapi/patient.yaml (+ 2 copies): GET /api/patients/staff/{staffId}, schema StaffLookup; patient-service StaffClient (@FeignClient, static URL), FeignForwardingConfig (token + X-Correlation-Id), StaffLookupService (404 kept, any other failure -> fallback), StaffLookupFeignTest (JDK HttpServer stub)
Verification: mvnw test 55/55 (6 new); live: found 200 direct and via gateway, 404, 403 pharmacist, 401, staff-service stopped -> 200 fallback
Corrections:  none at write time
Decision:     Feign only where Spring MVC runs (patient-service); try/catch fallback instead of Resilience4j circuit breaker to keep one dependency and an explicit 2 s timeout
