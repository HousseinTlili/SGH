# Patient Service (`patient-service`)

Service 1 (Patient) of the SGH Hospital Management System. Runs on port 8081, database `sgh_patient`, built with Spring Boot 3.4.3 / Java 17, Spring Data JPA, and Flyway.

- **Contract**: `openapi.yaml` (byte-identical copy of `../../contracts/openapi/patient.yaml`, verified by `scripts/check-contracts.sh`).
- **Swagger UI**: `http://localhost:8081/docs`
- **OpenAPI JSON**: `http://localhost:8081/openapi.json`
- **Health**: `http://localhost:8081/health`

---

## Run and Test

```bash
# Run unit and integration tests (23 tests). They use their own database,
# sgh_patient_test, created on first run, so the development data is never touched.
./mvnw test

# Package JAR
./mvnw clean package

# Run the service (applies Flyway migrations & seed on startup)
./mvnw spring-boot:run
```

---

## Business Rules Implemented

- **PAT-1**: Patient registration: validates required fields, gender enum, phone pattern, and ensures birth date is strictly in the past (422 Unprocessable Entity).
- **PAT-2**: Duplicate prevention: case-insensitive match on `(firstName, lastName, birthDate)` returns 409 Conflict.
- **PAT-3**: Patient search & list: case-insensitive substring search on first or last name; results ordered by `lastName ASC, firstName ASC`; soft-deleted patients are excluded.
- **PAT-4**: Registration returns HTTP 201 Created with `Location: /api/patients/{id}` header.
- **PAT-5**: Record access control: `PATIENT` role can access only their own patient record (matching `patientId` claim in JWT; 403 Forbidden on mismatch). Staff roles (`RECEPTIONIST`, `DOCTOR`, `NURSE`, `ADMIN`) can access any record.
- **PAT-6**: Medical file access control: `PATIENT` role can view only notes in their own medical file.
- **PAT-7**: Soft delete: `DELETE /api/patients/{id}` (ADMIN only) marks patient as deleted with timestamp; subsequent GET requests return 404 Not Found.
- **PAT-8**: Medical file note creation: `DOCTOR` role can add notes of type `NOTE` with `sourceService = patient` (returns 201 Created).
- **PAT-9**: Summary endpoint: `GET /api/patients/{id}/summary` returns compact `{ id, fullName, birthDate }` for inter-service communication (used by Doctor and Reception services).
- **X-6 / X-8**: Resilient Boot: Service boots immediately even if PostgreSQL is offline; `/health` returns 200 UP; database-backed endpoints answer 503 `Database unavailable` until background migrations succeed.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `8081` | HTTP port |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/sgh_patient` | PostgreSQL JDBC connection URL |
| `DATABASE_USERNAME` | `sgh` | Database username |
| `DATABASE_PASSWORD` | `sgh_dev_password` | Database password |
| `KEYCLOAK_ISSUER` | `http://localhost:8180/realms/sgh` | Keycloak realm issuer |
| `KEYCLOAK_JWKS_URI` | `http://localhost:8180/realms/sgh/protocol/openid-connect/certs` | Keycloak JWKS certs endpoint |

---

## Seed Data Fixtures

Idempotently seeded with 8 patients (P1 to P8) and 4 medical file entries (M1 to M4):
- **P1**: `a1a1a1a1-0000-4000-8000-000000000001` — Youssef Ben Salah (1985-03-14, MALE, Penicillin allergy, CNAM 10001)
- **P2**: `a1a1a1a1-0000-4000-8000-000000000002` — Amira Mejri (1992-07-22, FEMALE, O+)
- **P3**: `a1a1a1a1-0000-4000-8000-000000000003` — Nizar Khelifi (1978-11-02, MALE, B+)
- **P4**: `a1a1a1a1-0000-4000-8000-000000000004` — Leila Ben Ammar (2001-01-30, FEMALE, AB+)
- **P5**: `a1a1a1a1-0000-4000-8000-000000000005` — Hatem Dridi (1965-05-18, MALE, O-)
- **P6**: `a1a1a1a1-0000-4000-8000-000000000006` — Mariem Sassi (1999-09-09, FEMALE, A-)
- **P7**: `a1a1a1a1-0000-4000-8000-000000000007` — Omar Zouari (1988-12-25, MALE, B-)
- **P8**: `a1a1a1a1-0000-4000-8000-000000000008` — Sarra Belhaj (1973-04-04, FEMALE, A+)

---

## Errors

Shared error body for everything, including unknown routes (`404`). Malformed JSON or a parameter of the wrong type (for example an id that is not a UUID) answers `400`; field validation answers `422`. A database that disappears after startup answers `503 Database unavailable` and the service recovers on its own when it returns.
