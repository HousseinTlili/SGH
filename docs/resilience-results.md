# SGH Resilience Verification Results

This document records the empirical execution results and failure survival tests for the SGH platform, covering automated E2E resilience scenarios (8 to 11) and the complete Notion **Resilience Demo** matrix.

---

## 1. Automated Resilience Test Suite (`scripts/e2e.sh --resilience`)

**Execution Date**: 2026-11-02  
**Command**: `./scripts/e2e.sh --resilience`  
**Result**: **77 PASS, 0 FAIL, 0 SKIP**

```text
== Preconditions
      services: patient=UP reception=UP consultation=UP lab=UP pharmacy=UP staff=UP 
PASS  gateway and the six services are up

== Scenario 1: security basics
PASS  no token on /api/patients -> 401
PASS  NURSE on /api/drugs -> 403 (gateway)
PASS  NURSE creating a patient -> 403 (service)
PASS  PATIENT reading another patient -> 403
PASS  PATIENT reading own record -> 200
PASS  forged unsigned ADMIN token -> 401

== Scenario 2: registration and booking
PASS  register a patient -> 201
PASS  patient id is a uuid
PASS  same patient, different case -> 409
PASS  birth date in the future -> 422
PASS  book an appointment -> 201
PASS  patientVerified is true
PASS  same doctor, same time -> 409
PASS  check in -> 200
PASS  check in again -> 409

== Scenario 3: consultation, vitals, lab order, prescription
PASS  open a consultation -> 201
PASS  status DRAFT
PASS  doctorId is S1 (from the token)
PASS  patient snapshot name
PASS  vital signs by the nurse -> 201
PASS  diastolic above systolic -> 422
PASS  order a lab test -> 201
PASS  prescribe -> 201
PASS  second prescription (used by scenario 10) -> 201
PASS  write assessment and plan -> 200
PASS  sign -> 200
PASS  edit a signed consultation -> 409

== Scenario 4: lab processing (through RabbitMQ)
PASS  lab received the order through RabbitMQ
PASS  work queue puts URGENT first
PASS  start -> 200
PASS  validate without results -> 409
PASS  glucose 135 is flagged HIGH
PASS  reference range 70.0-100.0
PASS  validate -> 200
PASS  the doctor receives the validated result
PASS  lab order is VALIDATED

== Scenario 5: pharmacy
PASS  pharmacy received the prescription through RabbitMQ
PASS  queue contains the new prescription
PASS  Amoxicillin is in the stock alerts
PASS  dispense -> DISPENSED
PASS  stock went down by 9
PASS  dispense again -> 409
PASS  more than the stock -> 409

== Scenario 6: billing
PASS  create an invoice -> 201
PASS  total is computed: 75
PASS  status PENDING
PASS  pay -> PAID
PASS  paid in CASH
PASS  pay again -> 409
PASS  complete the checked-in visit -> 200

== Scenario 7: staff directory and profile
PASS  two doctors in the directory
PASS  staff list is admin only -> 403 for the receptionist
PASS  admin sees 7 staff members
PASS  /api/me shows the doctor's profile
PASS  patient /api/me carries patientId
PASS  patient has no staff profile

== Scenario 12: patient portal
PASS  appointments of patient1 only
PASS  consultations of patient1 only (or none)
PASS  invoices -> 200
PASS  staff list -> 403

== Scenario 8: resilience, Lab stopped
PASS  lab shows DOWN in the status endpoint within 3 seconds
PASS  lab screens get a structured 503
PASS  naming the lab service
PASS  the doctor can still order a test (201)
PASS  other services are unaffected
PASS  the order placed while Lab was down shows up after the restart

== Scenario 9: resilience, Patient stopped
PASS  booking still works (201)
PASS  flagged patientVerified false
PASS  consultation still opens (201)
PASS  patient snapshot is null
PASS  the appointment gets verified after the restart (REC-6, about a minute)

== Scenario 10: resilience, Consultation stopped
PASS  pharmacy has the prescription before the outage
PASS  dispensing works from the local copy

== Scenario 11: resilience, RabbitMQ stopped
PASS  ordering a test still works (201)
PASS  REST features keep working
PASS  the order placed while the broker was down is delivered after it returns

== Summary: 77 passed, 0 failed, 0 skipped
```

---

## 2. Resilience Demo Matrix

| Target Failure Condition | Injected Event | Expected Behavior | Observed Result | Status |
|--------------------------|----------------|-------------------|-----------------|--------|
| **Lab Service Down** | `dev-services.sh stop lab` | Gateway status returns `lab: DOWN` within 3s. Doctor consultation flow continues normally. Lab order persists in RabbitMQ. | Status returned `lab: DOWN`. Doctor created lab order (201). After restart, Lab consumed queued order and processed results. | **PASS** |
| **Patient Service Down** | `dev-services.sh stop patient` | Gateway returns 503 for `/api/patients`. Reception books appointment with `patientVerified: false`. Doctor opens consultation with `patientSnapshot: null`. | Appointment booked (201). Consultation opened (201). Background verification job reconciled patient status after restart. | **PASS** |
| **Consultation Service Down** | `dev-services.sh stop consultation` | Pharmacy uses cached event copy to dispense medications. Patient portal serves appointments and invoices. | Pharmacy successfully dispensed prescription using local copy with atomic stock deduction (200). Invoices accessible. | **PASS** |
| **RabbitMQ Broker Down** | `docker compose stop rabbitmq` | HTTP REST APIs remain functional. Events queue in-memory with continuous retry. | Doctor ordered lab test (201). Service logged broker disconnect warning without crashing. Order delivered immediately upon RabbitMQ restart. | **PASS** |
| **PostgreSQL Outage** | Service started with DB stopped | Service process boots successfully. `/health` responds 200 `UP`. Data endpoints respond 503 `Database unavailable`. | All services boot with stopped DB. Health check responds `{status: "UP"}`. When Postgres starts, migrations run and data endpoints recover. | **PASS** |
| **Keycloak Outage** | Keycloak container restarted | Cached JWKS tokens continue validating for unexpired tokens. Gateway reports auth errors gracefully. | Active user tokens continue serving authenticated calls until key rotation/expiry. Microservices reconnect upon Keycloak recovery. | **PASS** |
| **Gateway with all Services Stopped** | All 6 services stopped | Gateway starts alone. `GET /health` is 200. Gateway returns structured 503 naming the target service. | Gateway `/health` is 200. Route calls return structured `{status: 503, error: "Service Unavailable", service: "<name>"}`. | **PASS** |
