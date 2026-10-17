# Pharmacy service (pharmacy-service)

Port 8085, database `sgh_pharmacy`, stack Express 5 (TypeScript).
Contract: `../../contracts/openapi/pharmacy.yaml` (the copy in this folder, `openapi.yaml`, must be identical; check with `scripts/check-contracts.sh`).
Specification: Notion page "Pharmacy Service - API Spec", plus Domain Model and Business Rules, Seed Data and Fixtures, API Contracts and Conventions, Event Catalogue, Stack Templates.
Events: consumes prescription.created from queue pharmacy.prescription.created; publishes prescription.dispensed.

## Status
Not built yet. This README is completed with the service (purpose, run, test, environment variables, seed, known limits).

## Run and test (planned commands)
```
npm install && npm start
npm test
```
Docs when running: http://localhost:8085/docs, health: http://localhost:8085/health
