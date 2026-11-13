# SGH: how to launch and test everything

Local development only. Every value below is a development value from `infra/`.

Every command in this guide is for the Windows **Command Prompt (cmd.exe)**. Run them from the repository root, `C:\Users\Mehdi\Desktop\SGH`, unless a command starts with `cd`.

The test scripts in `scripts\*.sh` are Bash scripts. cmd runs them through `bash` (`bash scripts/e2e.sh`), which needs Git for Windows' `bash.exe` on your `PATH`. Those scripts also need `curl` and `jq`.

## 1. What is in the repo

| Part | Port | Stack | Swagger UI | Health |
|---|---|---|---|---|
| **API Gateway** | 8080 | Spring Cloud Gateway | none | `/health`, `/gateway/health/services` |
| patient-service | 8081 | Spring Boot | `/docs` | `/health` |
| reception-service | 8082 | Express (TS) | `/docs` | `/health` |
| doctor-service (consultation) | 8083 | Express (TS) | `/docs` | `/health` |
| lab-service | 8084 | FastAPI | `/docs` | `/health` |
| pharmacy-service | 8085 | Express (TS) | `/docs` | `/health` |
| staff-service | 8086 | Spring Boot | `/docs` | `/health` |
| notification-service | 8087 | Express (TS) | none | `/health` |
| Angular frontend | 4200 | Angular | none | none |

- Swagger UI for a service: `http://localhost:<port>/docs` (for example http://localhost:8081/docs).
- Raw spec for a service: `http://localhost:<port>/openapi.json`.
- Source specs: `contracts\openapi\`. Event schemas: `contracts\events\`.

### Modules, databases and stacks

Every backend service uses **PostgreSQL 16**, each with its own database in the single `sgh-postgres` container. All of them use RabbitMQ for events.

| Module | Folder | Port | Database | Stack |
|---|---|---|---|---|
| **Patient** | `services/patient-service` | 8081 | `sgh_patient` | Java · Spring Boot 3.4.3 · Spring Data JPA · Flyway migrations |
| **Reception** | `services/reception-service` | 8082 | `sgh_reception` | Node · Express 5 · TypeScript 5.8 · `pg` · `amqplib` |
| **Consultation** (doctor) | `services/doctor-service` | 8083 | `sgh_consultation` | Node · Express 5 · TypeScript 5.8 · `pg` · `amqplib` |
| **Lab** | `services/lab-service` | 8084 | `sgh_lab` | Python · FastAPI · SQLAlchemy 2 · psycopg2 · aio-pika |
| **Pharmacy** | `services/pharmacy-service` | 8085 | `sgh_pharmacy` | Node · Express 5 · TypeScript 5.8 · `pg` · `amqplib` |
| **Staff** | `services/staff-service` | 8086 | `sgh_staff` | Java · Spring Boot 3.4.3 · Spring Data JPA · Flyway migrations |
| **Notification** | `services/notification-service` | 8087 | `sgh_notification` | Node · Express 5 · TypeScript 7 · `pg` · `amqplib` |
| **API Gateway** | `gateway` | 8080 | none | Java · Spring Cloud Gateway (Spring Boot 4.0.8) |
| **Frontend** | `frontend` | 4200 | none | Angular 22 · TypeScript 6 |

| Component | Port | Image | Storage |
|---|---|---|---|
| PostgreSQL | 5432 | `postgres:16.15` | Holds the 7 `sgh_*` databases, created by `infra/postgres/init.sql` |
| RabbitMQ | 5672 for the broker, 15672 for the web UI | `rabbitmq:4.3.6-management` | Exchange `sgh.events`, set up from `definitions.json` |
| Keycloak | 8180 | `keycloak:26.8.1` | Its own built-in development database inside the container, not Postgres. The realm is re-imported from `sgh-realm.json` at startup |

### Docker infrastructure (`infra\docker-compose.yml`)

| Container | Address | Login |
|---|---|---|
| PostgreSQL 16 (`sgh-postgres`) | `localhost:5432` | `sgh` / `sgh_dev_password` |
| RabbitMQ (`sgh-rabbitmq`) | broker `localhost:5672`, management UI http://localhost:15672 | `sgh` / `sgh_dev_password` |
| Keycloak 26 (`sgh-keycloak`) | http://localhost:8180, realm `sgh` | admin console: `admin` / `admin` |

- **Postgres:** one database per service (`sgh_patient`, `sgh_reception`, `sgh_consultation`, `sgh_lab`, `sgh_pharmacy`, `sgh_staff`, `sgh_notification`), created by `infra\postgres\init.sql`.
- **RabbitMQ:** loaded from `infra\rabbitmq\definitions.json`.
  - Exchanges: `sgh.events` (topic) and `sgh.events.dlx` (fanout, dead letters).
  - Queues: `lab.lab.request.created`, `pharmacy.prescription.created`, `consultation.lab.result.ready`, `notification.appointment.events`, `sgh.events.dlq`.
- **Keycloak:** realm imported from `infra\keycloak\sgh-realm.json`.
  - Clients: `sgh-frontend`, `sgh-dev-cli`, `sgh-reception-svc`.
  - Users: `doctor1`, `doctor2`, `nurse1`, `lab1`, `pharmacist1`, `reception1`, `admin1`, `patient1`.
  - Password for every user: `Sgh@dev2026`.

## 2. Prerequisites

- Docker Desktop
- JDK 17 or later
- Node 22 or later, with npm
- Python 3.12 or later
- Git for Windows, with `bash` on `PATH`, plus `curl` and `jq` (only for the `.sh` scripts)

`curl.exe` is built into Windows 10 and 11.

## 3. Launch

### 3.1 Start the infrastructure

```bat
docker compose -f infra\docker-compose.yml up -d --wait
docker compose -f infra\docker-compose.yml ps
```

`--wait` returns when the containers are healthy.

### 3.2 First run only: install dependencies

```bat
cd services\reception-service    && npm ci && cd ..\..
cd services\doctor-service       && npm ci && cd ..\..
cd services\pharmacy-service     && npm ci && cd ..\..
cd services\notification-service && npm install && cd ..\..
cd frontend                      && npm ci && cd ..

cd services\lab-service
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\..
```

The Spring Boot projects (patient, staff, gateway) download their dependencies the first time `mvnw.cmd` runs.

### 3.3 Start the services, the gateway and the frontend

Each line opens its own window, so every service keeps its log visible. Close a window to stop that service.

```bat
start "patient 8081"      /D services\patient-service      cmd /k mvnw.cmd spring-boot:run
start "reception 8082"    /D services\reception-service    cmd /k npm start
start "consultation 8083" /D services\doctor-service       cmd /k npm start
start "lab 8084"          /D services\lab-service          cmd /k .venv\Scripts\python.exe -m uvicorn app.main:app --port 8084
start "pharmacy 8085"     /D services\pharmacy-service     cmd /k npm start
start "staff 8086"        /D services\staff-service        cmd /k mvnw.cmd spring-boot:run
start "notification 8087" /D services\notification-service cmd /k npm start
start "gateway 8080"      /D gateway                       cmd /k mvnw.cmd spring-boot:run
start "frontend 4200"     /D frontend                      cmd /k npm start
```

Then open http://localhost:4200.

- Spring Boot services take about a minute to start the first time.
- Services start even while Postgres, RabbitMQ or other services are down. Their data endpoints return 503 "Database unavailable" until the database is ready.

### 3.4 Frontend without any backend (mock mode)

```bat
cd frontend
npm run start:mock
```

## 4. Test each part

### 4.1 Infrastructure

- **Postgres:** `docker exec -it sgh-postgres psql -U sgh -l` should list the `sgh_*` databases.
- **RabbitMQ:** open http://localhost:15672. Under Exchanges you should see `sgh.events`; under Queues you should see the five queues from section 1.
- **Keycloak:** open http://localhost:8180, switch to the `sgh` realm and open Users.

To get a token into the `TOKEN` variable:

```bat
for /f "delims=" %i in ('bash scripts/token.sh doctor1') do set TOKEN=%i
echo %TOKEN%
```

> In a `.bat` file, write `%%i` instead of `%i`.

To do it without Bash, call Keycloak directly and copy `access_token` from the JSON:

```bat
curl.exe -s -X POST http://localhost:8180/realms/sgh/protocol/openid-connect/token -d grant_type=password -d client_id=sgh-dev-cli -d username=doctor1 -d "password=Sgh@dev2026"
```

Paste the token into https://jwt.io. You should see `realm_access.roles`, `preferred_username` and `staffId` or `patientId`.

### 4.2 Health of everything at once

```bat
for %p in (8080 8081 8082 8083 8084 8085 8086 8087) do @curl.exe -s -m 2 http://localhost:%p/health && echo  ^<- %p
curl.exe http://localhost:8080/gateway/health/services
```

- A service that is up prints `{"status":"UP"}`.
- The second command shows the gateway's view of every service.
- `bash scripts/health.sh` prints a tidier UP/DOWN list, if Bash is installed.

### 4.3 Swagger

1. Open `http://localhost:808X/docs` for a service.
2. Click **Authorize** and paste a token from section 4.1.
3. Call the protected endpoints. The services check the role, so use the right user: for example `lab1` for lab and `pharmacist1` for pharmacy.

### 4.4 API Gateway

All client calls go through `http://localhost:8080`.

```bat
for /f "delims=" %i in ('bash scripts/token.sh doctor1') do set TOKEN=%i
curl.exe -H "Authorization: Bearer %TOKEN%" http://localhost:8080/api/consultations
curl.exe -H "Authorization: Bearer %TOKEN%" http://localhost:8080/api/patients

rem no token: 401
curl.exe -i http://localhost:8080/api/patients

rem wrong role: 403
for /f "delims=" %i in ('bash scripts/token.sh pharmacist1') do set PTOKEN=%i
curl.exe -i -H "Authorization: Bearer %PTOKEN%" http://localhost:8080/api/vitals
```

| Path | Service | Roles allowed at the gateway |
|---|---|---|
| `/api/patients/**` | patient | all seven roles |
| `/api/appointments/**` | reception | RECEPTIONIST, DOCTOR, ADMIN, PATIENT |
| `/api/invoices/**` | reception | RECEPTIONIST, ADMIN, PATIENT |
| `/api/consultations/**` | consultation | DOCTOR, NURSE, ADMIN, PATIENT, PHARMACIST |
| `/api/vitals/**` | consultation | DOCTOR, NURSE, ADMIN |
| `/api/lab-requests/**`, `/api/lab-results/**`, `/api/tests/**` | lab | LAB_TECHNICIAN, DOCTOR, ADMIN |
| `/api/drugs/**`, `/api/stock/**`, `/api/prescriptions/**` | pharmacy | PHARMACIST, DOCTOR, ADMIN |
| `/api/staff/**`, `/api/roles`, `/api/me` | staff | any logged-in user |
| `/api/notifications/**` | notification | any logged-in user |

- The route table is in `gateway\src\main\resources\application.yml`.
- Each service also applies its own, finer role checks.
- If a service is down, the gateway answers 503.

### 4.5 Automated tests for each service

- The service tests use their own `sgh_*_test` databases, so they don't touch your development data. Postgres must be running.
- Tests that need RabbitMQ skip themselves when the broker is down.

```bat
cd services\patient-service      && mvnw.cmd test && cd ..\..
cd services\staff-service        && mvnw.cmd test && cd ..\..
cd services\reception-service    && npm test && cd ..\..
cd services\doctor-service       && npm test && cd ..\..
cd services\pharmacy-service     && npm test && cd ..\..
cd services\notification-service && npm test && cd ..\..
cd services\lab-service          && .venv\Scripts\pytest.exe && cd ..\..
cd gateway                       && mvnw.cmd test && cd ..
cd frontend                      && npm test && cd ..
```

- The gateway tests need no infrastructure.
- If a test suite fails, `&&` stops the line and you stay in that folder. Run `cd` back to the repository root before the next line.

### 4.6 End to end (everything running, needs Bash)

```bat
bash scripts/e2e.sh
bash scripts/e2e.sh --resilience
python scripts\check-roles.py patient 8081
bash scripts/check-contracts.sh
bash scripts/stub-check.sh 8083 doctor-service
```

| Command | What it checks |
|---|---|
| `e2e.sh` | full flows through the gateway, including RabbitMQ events |
| `e2e.sh --resilience` | also stops and restarts lab, patient, consultation and RabbitMQ |
| `check-roles.py` | every endpoint x every role, plus forged tokens |
| `check-contracts.sh` | service specs match `contracts\openapi` |
| `stub-check.sh` | stub acceptance list for one service |

To watch the events flow, run `e2e.sh` and keep the RabbitMQ Queues page open. You should see messages pass through these queues:

| Queue | Event |
|---|---|
| `lab.lab.request.created` | doctor orders a lab test |
| `consultation.lab.result.ready` | lab validates a result |
| `pharmacy.prescription.created` | doctor prescribes |
| `notification.appointment.events` | reception creates or cancels an appointment |

### 4.7 OpenFeign (patient-service calls staff-service)

patient-service has one OpenFeign client, `StaffClient`. `GET /api/patients/staff/{staffId}` (roles RECEPTIONIST, DOCTOR, NURSE, ADMIN) uses it to call staff-service `GET /api/staff/{id}/public`. Timeouts are 2 s, the caller's token and `X-Correlation-Id` are forwarded, and there is a fallback when staff-service is unreachable.

**Automated tests** (a stub staff-service, nothing else running except Postgres):

```bat
cd services\patient-service && mvnw.cmd test -Dtest=StaffLookupFeignTest && cd ..\..
```

Expect `Tests run: 6, Failures: 0`: found, 404, timeout fallback, 503 fallback, 403 wrong role, 401 no token.

**By hand** (patient-service and staff-service running). Get a `doctor1` token as in section 4.1, then:

```bat
curl.exe -H "Authorization: Bearer %TOKEN%" -H "X-Correlation-Id: feign-demo-1" http://localhost:8081/api/patients/staff/b2b2b2b2-0000-4000-8000-000000000001
```

| Case | What to do | What you should see |
|---|---|---|
| Found | the command above (also works through the gateway on 8080) | 200 `{"staffId":"b2b2b2b2-...0001","available":true,"fullName":"Amel Trabelsi","role":"DOCTOR","specialty":"Cardiology","source":"staff-service"}` |
| Headers forwarded | look at the staff-service log | a line `INFO [feign-demo-1] ... GET /api/staff/b2b2b2b2-...0001/public -> 200 ... user=doctor1` |
| Unknown staff | use id `b2b2b2b2-0000-4000-8000-000000000999` | 404 `"message":"Staff member not found"` |
| Wrong role | use a `pharmacist1` token | 403 |
| No token | drop the `Authorization` header | 401 |
| Fallback | close the staff-service window, run the command again | 200 `{"available":false,"fullName":null,"role":null,"specialty":null,"source":"fallback"}` at once, and a WARN line `... Connection refused ...; using fallback` in the patient-service log |

In Swagger (http://localhost:8081/docs) the endpoint is `GET /api/patients/staff/{staffId}` under `staff-lookup-controller`.

## 5. Stop and reset

1. Close the service windows opened in section 3.3.
2. Stop the containers:

```bat
rem stop the containers; data is kept
docker compose -f infra\docker-compose.yml stop

rem remove the containers; data is kept in the sgh-pgdata volume
docker compose -f infra\docker-compose.yml down

rem reset the development data (needs Bash)
bash scripts/reset.sh
```



