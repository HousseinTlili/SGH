# SGH — Technical Choices & Architecture Justification

This document details the architectural decisions, design trade-offs, and technology justifications implemented across the SGH Hospital Management System, in accordance with the university course requirements for **Applications Web Distribuées** (ESPRIT).

---

## 1. Why Microservices Architecture?

Healthcare information systems naturally consist of autonomous, domain-bounded contexts:
- **Clinical care**: Consultations, diagnoses, and medical histories.
- **Diagnostic analysis**: Laboratory investigations, analyzer readings, and validation workflows.
- **Pharmaceutical supply**: Drug inventory, prescription dispensing, and stock tracking.
- **Hospital administration**: Patient admission, scheduling, billing, and staff directories.

### Key Benefits Realized
1. **Fault Isolation**: A failure or maintenance window in the laboratory analyzer integration cannot take down patient check-in or ongoing emergency consultations.
2. **Independent Scalability**: High-throughput read endpoints (such as patient appointment availability lookups) scale independently of heavy write transactions (such as prescription dispensing with row locking).
3. **Polyglot Technology Fit**: Each service leverages the runtime best suited to its problem domain rather than conforming to a monolithic compromise.

---

## 2. Why Database-per-Service?

Each of the six microservices manages its own dedicated PostgreSQL database (`sgh_patient`, `sgh_reception`, `sgh_consultation`, `sgh_lab`, `sgh_pharmacy`, `sgh_staff`):

1. **Elimination of Schema Coupling**: No service directly queries or mutates foreign tables. Schema migrations (Flyway, Alembic, Node-pg-migrate) execute independently without cross-team dependencies.
2. **Guaranteed Transactional Boundaries**: Enforces bounded contexts. Inter-service relationships rely on immutable UUID references and event-driven data propagation rather than database-level foreign keys.
3. **Resilience & Maintenance**: Backups, restores, and connection pooling are isolated per database. A database locking bottleneck in pharmacy dispensing does not affect clinical notes or appointment booking.

---

## 3. Technology Stack Selection (4 Polyglot Runtimes)

The platform demonstrates polyglot development using four distinct production ecosystems:

### A. Spring Boot 3.4 (Java 17) — `patient-service`, `staff-service`, `gateway`
- **Justification**: Enterprise-standard reliability for administrative records and core identity directories. Spring Data JPA, Hibernate, and Flyway provide robust database migration management, type safety, and connection lifecycle management.
- **Spring Cloud Gateway (WebFlux)**: Non-blocking reactive routing engine capable of handling high concurrent connection volumes with minimal thread overhead, providing centralized CORS, JWT validation, and structured 503 fallback routing.

### B. Node.js & Express 5 (TypeScript) — `doctor-service`, `pharmacy-service`, `reception-service`
- **Justification**: High developer productivity, native JSON handling, and clean asynchronous I/O. Express 5 natively handles asynchronous route rejections without unhandled promise crashes. TypeScript guarantees strict typing across domain entities, request bodies, and database queries.
- **Concurrency Control**: Node's event-loop concurrency combined with PostgreSQL `SELECT ... FOR UPDATE` explicit row locking in `pharmacy-service` provides deterministic double-dispensing prevention without race conditions.

### C. FastAPI & SQLAlchemy 2 (Python 3.12) — `lab-service`
- **Justification**: Ideal for laboratory computation and analytical workflows. FastAPI provides high-performance asynchronous HTTP handlers, automatic OpenAPI 3 schema generation via Pydantic 2, and clean decimal precision arithmetic required for biological reference range checks and flag calculations (NORMAL, LOW, HIGH, CRITICAL).

### D. Angular 22 (TypeScript) — `frontend`
- **Justification**: Modern enterprise SPA framework built with zoneless change detection for optimal rendering performance, Angular Material 19 for clinical design consistency, and native signals for fine-grained reactive state management across role-guarded routes.

---

## 4. Identity & Access Management (Keycloak 26)

Keycloak serves as the single source of truth for hospital identity and role-based access control (RBAC):

1. **Standards-Compliant OIDC / OAuth2**:
   - Web clients authenticate via **Authorization Code Flow with PKCE (SHA-256)** (`sgh-frontend` public client), avoiding client secret leakage in browser bundles.
   - Microservices use stateless JWT verification against Keycloak's JSON Web Key Set (`/realms/sgh/protocol/openid-connect/certs`) with caching and issuer validation.
   - Service accounts use **OAuth2 Client Credentials** (`sgh-reception-svc`) for unattended background jobs.
2. **Contextual Claims**:
   Keycloak tokens carry contextual identifiers (`staffId`, `patientId`, `preferred_username`) alongside hospital realm roles, allowing services to enforce ownership rules (e.g., patient viewing only their own appointments; doctor signing only their own consultations).

---

## 5. Messaging & Event-Driven Decoupling (RabbitMQ)

### Why RabbitMQ?
- **Broker Topology**: Unlike Kafka (log-based event streaming suited for distributed log analytics), RabbitMQ provides targeted AMQP message queuing, explicit worker distribution, flexible topic routing, and lightweight connection footprints suited for local microservices orchestration.
- **Topic Exchange (`sgh.events`)**: Decouples event producers from consumers. When a doctor signs a consultation, the system publishes `prescription.created` and `lab.request.created` without synchronous awareness of whether the pharmacy or lab services are actively online.
- **Dead-Letter Exchange (`sgh.events.dlx`)**: Malformed payloads or repeated processing failures route to `sgh.events.dlq` for forensic analysis without stalling message queue delivery.
- **Idempotent Consumers**: Every consumer writes processed `eventId` tokens to an internal database table in the same transaction as business updates, preventing duplicate side-effects during network replays.

---

## 6. Resilience Principles (X-1 to X-9 Implementation)

| Rule | Principle | Implementation Mechanism |
|------|-----------|--------------------------|
| **X-1** | Autonomous startup | All services boot successfully when Postgres or RabbitMQ are offline. |
| **X-2** | Uncoupled health checks | `/health` is a dedicated lightweight handler returning `{status: "UP"}` independent of database connectivity. |
| **X-3** | Structured 503 errors | Gateway and services emit `{status: 503, error: "Service Unavailable", service: "name"}` when downstream dependencies fail. |
| **X-4** | Local data redundancy | Pharmacy stores a cached copy of prescriptions received via events; allows dispensing when doctor-service is down. |
| **X-5** | Snapshot immutability | Consultations store an immutable snapshot of patient demographics at the time of consultation creation. |
| **X-6** | Event persistence | Message broker disconnects trigger continuous background retry loops; events are buffered in memory and flushed upon reconnection. |
| **X-7** | Distributed correlation | `X-Correlation-Id` is propagated across all HTTP requests, responses, log lines, and RabbitMQ message headers. |
| **X-8** | Background database recovery | Database connection pools retry connection attempts with exponential backoff rather than terminating the process. |
| **X-9** | Token caching | Microservices cache JWKS signing keys locally, tolerating brief Keycloak restarts without rejecting valid user requests. |

---

## 7. Trade-offs and Lessons Learned

1. **Local Microservices vs. Monorepo Simplicity**:
   Running six services, an API gateway, Keycloak, Postgres, and RabbitMQ requires disciplined resource management and reliable orchestration scripts (`dev-services.sh`, `reset.sh`). The separation forces clean architectural decoupling.
2. **Eventual Consistency vs. Two-Phase Commit**:
   Event-driven propagation between Consultation, Lab, and Pharmacy means records synchronize asynchronously. The system relies on transactional idempotence and status state machines rather than blocking distributed locks.
3. **Database Migrations in Packaged Artifacts**:
   Ensuring database migration files (Flyway Java JARs, Node-pg-migrate ESM, Alembic Python paths) package reliably across different build environments required isolated test databases and verified startup scripts.
