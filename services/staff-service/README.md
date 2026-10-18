# Staff and Access Service (`staff-service`)

Microservice for hospital staff management, directory lookup, role listing, and authenticated caller profile (`/api/me`).

- **Port**: `8086`
- **Database**: PostgreSQL `sgh_staff`
- **Stack**: Spring Boot 3.4.3 (Java 17), Spring Data JPA, Flyway, Spring Security OAuth2 Resource Server (Keycloak 26), SpringDoc OpenAPI
- **Contract**: `contracts/openapi/staff.yaml` (mirrored byte-for-byte in `openapi.yaml`)
- **Events**: None published or consumed.

---

## Features & Business Rules

1. **Staff Profile Management (STF-1, STF-2, STF-3)**:
   - `POST /api/staff`: Restricted to `ADMIN`. Validates input fields and enforces unique e-mail (case-insensitive, returns `409 Conflict` on duplicates). Returns `201 Created` with `Location: /api/staff/{id}`.
   - `GET /api/staff`: Restricted to `ADMIN`. Returns paginated list of staff members sorted by `lastName ASC`. Supports query filters: `role`, `department`, `active`, and case-insensitive substring `search`.
   - `GET /api/staff/{id}`: Restricted to `ADMIN`. Returns full staff profile.
   - `PUT /api/staff/{id}`: Restricted to `ADMIN`. Replaces profile data with duplicate e-mail checks.
   - `POST /api/staff/{id}/deactivate`: Restricted to `ADMIN`. Marks staff member as `active = false`. Returns `409 Conflict` if already inactive.

2. **Staff Directory & Public View (STF-4, D15)**:
   - `GET /api/staff/directory`: Accessible by all hospital staff roles (`RECEPTIONIST`, `DOCTOR`, `NURSE`, `LAB_TECHNICIAN`, `PHARMACIST`, `ADMIN`). Returns a flat array of active staff (`active = true`) sorted by `fullName ASC`. Optional `?role=` query parameter filters by role.
   - **Route Precedence**: `/api/staff/directory` is explicitly declared before `/api/staff/{id}` to avoid UUID route conflicts.
   - `GET /api/staff/{id}/public`: Accessible by any authenticated user (including `PATIENT`). Returns public profile (`id`, `fullName`, `role`, `specialty`) for active staff; returns `404 Not Found` if inactive or nonexistent.

3. **User Profile & Roles (STF-5)**:
   - `GET /api/me`: Accessible by any authenticated user. Returns `{ username, roles, staff, patientId }`.
     - `username`: Extracted from JWT claim `preferred_username` (fallback `sub`).
     - `roles`: Filtered to the 7 canonical SGH roles from `realm_access.roles`.
     - `staff`: Resolved by matching the JWT `staffId` claim against `staff_members`. If caller is a patient or unlinked, `staff = null`.
     - `patientId`: Populated from the JWT `patientId` claim (or `null`).
   - `GET /api/roles`: Returns the 7 canonical SGH roles: `["PATIENT", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ADMIN"]`.

4. **Resilience & Startup (Rule X-8)**:
   - Starts and serves `GET /health` (`200 {"status": "UP"}`) immediately even when PostgreSQL is temporarily offline.
   - `DbReadyService` background retry loop attempts database connectivity and Flyway migrations at exponential intervals (1s, 2s, 4s, 8s, 16s, 30s).
   - Any database-dependent `/api/*` endpoints respond with `503 Service Unavailable` (`"Database unavailable"`) until connection is established.

5. **Cross-Cutting Rules**:
   - **Rule X-1**: Correlation ID passed in `X-Correlation-Id` header (or generated) and echoed in response and error payloads.
   - **Rule X-7**: Request logging without exposing bearer tokens.

---

## Seed Data

Initial Flyway migrations seed the 7 canonical SGH staff profiles:

| ID | Username | Role | Full Name | Specialty | Department | Email |
|---|---|---|---|---|---|---|
| `b2b2b2b2-0000-4000-8000-000000000001` | `doctor1` | `DOCTOR` | Amel Trabelsi | Cardiology | Cardiology | `doctor1@sgh.local` |
| `b2b2b2b2-0000-4000-8000-000000000002` | `doctor2` | `DOCTOR` | Karim Jlassi | General practice | General Medicine | `doctor2@sgh.local` |
| `b2b2b2b2-0000-4000-8000-000000000003` | `nurse1` | `NURSE` | Sonia Gharbi | - | Nursing | `nurse1@sgh.local` |
| `b2b2b2b2-0000-4000-8000-000000000004` | `lab1` | `LAB_TECHNICIAN` | Walid Mansouri | - | Laboratory | `lab1@sgh.local` |
| `b2b2b2b2-0000-4000-8000-000000000005` | `pharmacist1` | `PHARMACIST` | Ines Chaabane | - | Pharmacy | `pharmacist1@sgh.local` |
| `b2b2b2b2-0000-4000-8000-000000000006` | `reception1` | `RECEPTIONIST` | Rim Bouazizi | - | Front Desk | `reception1@sgh.local` |
| `b2b2b2b2-0000-4000-8000-000000000007` | `admin1` | `ADMIN` | Sami Hamdi | - | IT | `admin1@sgh.local` |

---

## Running and Testing

### 1. Run the service
```bash
./mvnw spring-boot:run
```

### 2. Run the test suite (26 integration tests)
```bash
./mvnw test
```

### 3. Check contract integrity
```bash
../../scripts/check-contracts.sh
```

### 4. Interactive Docs & Health
- **Health**: http://localhost:8086/health
- **Swagger UI**: http://localhost:8086/docs
- **OpenAPI JSON**: http://localhost:8086/openapi.json
