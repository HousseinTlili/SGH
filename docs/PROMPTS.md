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
