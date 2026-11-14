# First prompt for Antigravity

Paste the text below into Antigravity (workspace = the repository folder, branch `feature/platform` checked out). Antigravity needs access to Notion (read only) and to a terminal with Git Bash and Docker.

---

You are continuing the SGH hospital management system, a university microservices project (ESPRIT, "Applications Web Distribuees"). Six services (patient, reception, doctor = consultation, lab, pharmacy, staff) behind one gateway, one Angular front end, Keycloak, RabbitMQ, Postgres, all local. I am the project lead. You build and verify; I review every pull request.

Before doing anything, read these files in the repository, in this order, completely:
1. `AGENTS.md`
2. `CLAUDE.md` (working rules, layout, conventions)
3. `docs/ANTIGRAVITY-HANDOFF.md` (what exists, the task list T0 to T13, known traps, how to report)
Then skim `docs/MASTER-PLAN.md` and `docs/PLAN.md` section 3 for background. Do not re-plan: execute the handoff.

The specification is in Notion, and you have read access. The root page is "SGH - Hospital Management System (Microservices Project)": https://app.notion.com/p/3f029a30745981808e7ce9464afe4cc6. The handoff lists the key page URLs. Notion is read only for you: never create, edit, move or delete a page; if a page needs a change, write it in `docs/spec-changes.md` and tell me. Decisions D21 to D32 in the Notion Decisions Log are final defaults.

Start now with **T0 and T1** of the handoff:
- T0: check the environment (Docker engine, `docker compose`, jq, Node, JDK, Python). If Docker is not working, stop and tell me exactly what is missing. Do not substitute another database.
- T1: bring the infrastructure up (`docker compose -f infra/docker-compose.yml up -d`) and verify it for real: the six Postgres databases, the RabbitMQ exchange and queues, the Keycloak realm, and above all that a token from `./scripts/token.sh doctor1` decodes with `iss`, `realm_access.roles`, `staffId` and `preferred_username`, and that `patient1` carries `patientId`. The files in `infra/` were written but never run, so expect to fix them; fix `infra/` only, on a branch `feature/infra`, and write the working Keycloak syntax in `docs/keycloak-notes.md`. Finish by proving `./scripts/reset.sh` works from a clean state.

Rules for this task:
- Do the spec check first (re-read the Notion pages the task names and compare their last-edited times with the handoff).
- Show real command output for every acceptance check. Say plainly what you did not run or what failed. Never claim something works that you did not run.
- Commit with `infra: ...` messages. Do not push to `main`, and do not merge anything. Push `feature/infra` only when all T1 checks pass, then give me the PR description.
- Do not start T2 (patient-service) until I answer.

When finished, report exactly as in section 9 of the handoff: what you built, commands and outputs, checks passed or failed, anything in the spec that looked wrong, branch and PR, and what you need from me for T2.
