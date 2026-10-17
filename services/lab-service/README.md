# Lab service (lab-service)

Port 8084, database `sgh_lab`, stack FastAPI (Python 3.12).
Contract: `../../contracts/openapi/lab.yaml` (the copy in this folder, `openapi.yaml`, must be identical; check with `scripts/check-contracts.sh`).
Specification: Notion page "Lab Service - API Spec", plus Domain Model and Business Rules, Seed Data and Fixtures, API Contracts and Conventions, Event Catalogue, Stack Templates.
Events: consumes lab.request.created from queue lab.lab.request.created; publishes lab.result.ready.

## Status
Not built yet. This README is completed with the service (purpose, run, test, environment variables, seed, known limits).

## Run and test (planned commands)
```
pip install -r requirements.txt && uvicorn app.main:app --port 8084
pytest
```
Docs when running: http://localhost:8084/docs, health: http://localhost:8084/health
