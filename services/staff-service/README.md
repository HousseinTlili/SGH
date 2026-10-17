# Staff and Access service (staff-service)

Port 8086, database `sgh_staff`, stack Spring Boot 4.1 (Java 17).
Contract: `../../contracts/openapi/staff.yaml` (the copy in this folder, `openapi.yaml`, must be identical; check with `scripts/check-contracts.sh`).
Specification: Notion page "Staff Service - API Spec", plus Domain Model and Business Rules, Seed Data and Fixtures, API Contracts and Conventions, Event Catalogue, Stack Templates.
Events: none.

## Status
Not built yet. This README is completed with the service (purpose, run, test, environment variables, seed, known limits).

## Run and test (planned commands)
```
./mvnw spring-boot:run
./mvnw test
```
Docs when running: http://localhost:8086/docs, health: http://localhost:8086/health
