# Linux setup for SGH (handoff from Windows)

Written 2026-10-17. Open Antigravity on your Linux machine, paste the prompt at the bottom, and it will pick up from T0/T1.

---

## 1. Install prerequisites

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y openjdk-17-jdk nodejs npm python3 python3-pip python3-venv \
  jq curl git docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# LOG OUT AND LOG BACK IN (so the docker group takes effect)
docker run --rm hello-world   # must print "Hello from Docker!"
```

### EndeavourOS / Arch
```bash
sudo pacman -Syu --noconfirm jdk17-openjdk nodejs npm python python-pip jq curl git docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# LOG OUT AND LOG BACK IN
docker run --rm hello-world
```

### Verify all tools
```bash
docker --version          # >= 24
docker compose version    # >= 2
node --version            # >= 20
java -version             # 17.x
python3 --version         # >= 3.10
jq --version              # any
git --version             # any
```

---

## 2. Clone the repository

```bash
git clone https://github.com/HousseinTlili/SGH.git ~/Projects/Microservice
cd ~/Projects/Microservice
git checkout feature/platform
```

---

## 3. What was done on Windows (T0 status)

- Read AGENTS.md, CLAUDE.md, docs/ANTIGRAVITY-HANDOFF.md, docs/MASTER-PLAN.md, docs/PLAN.md
- Verified all tools present (jq, Node 24.19, JDK 17, Python 3.12, Docker CLI 29.8)
- Docker engine could NOT start because WSL2 was not installed on Windows
- No code was written. No commits were made. No branch created beyond `feature/platform`.
- Notion MCP: the SGH pages were NOT accessible (404 — pages not shared with the "AGY" integration). The spec was read from the repo docs instead.

**Resume point: T0 (verify Docker works) then T1 (infra up and Keycloak verified).**

---

## 4. Prompt to paste into Antigravity on Linux

Copy everything below the line and paste it as your first message:

---

You are continuing the SGH hospital management system, a university microservices project (ESPRIT, "Applications Web Distribuees"). Six services (patient, reception, doctor = consultation, lab, pharmacy, staff) behind one gateway, one Angular front end, Keycloak, RabbitMQ, Postgres, all local. I am the project lead. You build and verify; I review every pull request.

Before doing anything, read these files in the repository, in this order, completely:
1. `AGENTS.md`
2. `CLAUDE.md` (working rules, layout, conventions)
3. `docs/ANTIGRAVITY-HANDOFF.md` (what exists, the task list T0 to T13, known traps, how to report)
Then skim `docs/MASTER-PLAN.md` and `docs/PLAN.md` section 3 for background. Do not re-plan: execute the handoff.

The specification is in Notion, and you have read access. The root page is "SGH - Hospital Management System (Microservices Project)": https://app.notion.com/p/3f029a30745981808e7ce9464afe4cc6. The handoff lists the key page URLs. Notion is read only for you: never create, edit, move or delete a page; if a page needs a change, write it in `docs/spec-changes.md` and tell me. Decisions D21 to D32 in the Notion Decisions Log are final defaults.

**Context from prior session (Windows):** T0 environment check was done. All tools were verified present. Docker was blocked on Windows due to missing WSL2. We moved to Linux to avoid that. Docker should now be working — verify with `docker run --rm hello-world` and proceed.

Start now with T0 (quick re-verify on this Linux machine) and T1 of the handoff:
- T0: check the environment (Docker engine, docker compose, jq, Node, JDK, Python). If Docker is not working, stop and tell me exactly what is missing. Do not substitute another database.
- T1: bring the infrastructure up (`docker compose -f infra/docker-compose.yml up -d`) and verify it for real: the six Postgres databases, the RabbitMQ exchange and queues, the Keycloak realm, and above all that a token from `./scripts/token.sh doctor1` decodes with `iss`, `realm_access.roles`, `staffId` and `preferred_username`, and that `patient1` carries `patientId`. The files in `infra/` were written but never run, so expect to fix them; fix `infra/` only, on a branch `feature/infra`, and write the working Keycloak syntax in `docs/keycloak-notes.md`. Finish by proving `./scripts/reset.sh` works from a clean state.

Rules for this task:
- Do the spec check first (re-read the Notion pages the task names and compare their last-edited times with the handoff).
- Show real command output for every acceptance check. Say plainly what you did not run or what failed. Never claim something works that you did not run.
- Commit with `infra: ...` messages. Do not push to `main`, and do not merge anything. Push `feature/infra` only when all T1 checks pass, then give me the PR description.
- Do not start T2 (patient-service) until I answer.

When finished, report exactly as in section 9 of the handoff: what you built, commands and outputs, checks passed or failed, anything in the spec that looked wrong, branch and PR, and what you need from me for T2.
