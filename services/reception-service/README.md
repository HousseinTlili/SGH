# Reception service (reception-service)

Port 8082, database `sgh_reception`, stack NestJS (TypeScript).
Contract: `../../contracts/openapi/reception.yaml` (the copy in this folder, `openapi.yaml`, must be identical; check with `scripts/check-contracts.sh`).
Specification: Notion page "Reception Service - API Spec", plus Domain Model and Business Rules, Seed Data and Fixtures, API Contracts and Conventions, Event Catalogue, Stack Templates.
Events: publishes appointment.created and appointment.cancelled.

## Status
Not built yet. This README is completed with the service (purpose, run, test, environment variables, seed, known limits).

## Run and test (planned commands)
```
npm install && npm run start:dev
npm test
```
Docs when running: http://localhost:8082/docs, health: http://localhost:8082/health
