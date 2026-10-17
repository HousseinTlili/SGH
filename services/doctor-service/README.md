# Doctor (Consultation) service (doctor-service)

Port 8083, database `sgh_consultation`, stack Express 5 (TypeScript).
Contract: `../../contracts/openapi/consultation.yaml` (the copy in this folder, `openapi.yaml`, must be identical; check with `scripts/check-contracts.sh`).
Specification: Notion page "Consultation Service - API Spec", plus Domain Model and Business Rules, Seed Data and Fixtures, API Contracts and Conventions, Event Catalogue, Stack Templates.
Events: publishes lab.request.created and prescription.created; consumes lab.result.ready from queue consultation.lab.result.ready.

## Status
Not built yet. This README is completed with the service (purpose, run, test, environment variables, seed, known limits).

## Run and test (planned commands)
```
npm install && npm start
npm test
```
Docs when running: http://localhost:8083/docs, health: http://localhost:8083/health
