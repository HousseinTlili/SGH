# Mock backend

Lets the Angular app run with no real service, no database and no Keycloak. Follows the "Angular - Mock API" and "Gateway Config" pages of the specification.

```
Angular (4200) -> mock gateway (8080) -> Prism servers on 8081 to 8086 (one per OpenAPI file)
```

## Run

From the repository root:

```
npm run mock:install     # once
npm run mock             # starts 7 processes and prints their ports
```

From `frontend/`, `npm run start:mock` starts this and the Angular dev server together.

Ports: patient 8081, reception 8082, consultation 8083, lab 8084, pharmacy 8085, staff 8086, gateway 8080.

## What it does

- `specs/<service>.yaml` are the OpenAPI files Prism serves. They answer with the first example of each response, so examples use the ids and names of Seed Data and Fixtures. `GET /api/me` has one named example per seeded user; the app asks for the right one with `Prefer: example=<username>`.
- The gateway has the same route table as the real one, forwards paths unchanged, validates no token (Prism still wants some `Authorization: Bearer ...`; the app sends `mock-token`), allows CORS only for `http://localhost:4200`, and creates or echoes `X-Correlation-Id`.
- `GET /gateway/health/services` calls every service's `/health` (1 s timeout, 2 s cache), so a stopped Prism shows as DOWN.
- `POST /gateway/mock/down/{service}` and `/up/{service}` simulate a crash. A service that is down, or not running, answers 503 with the structured body (`service`, `message`, `correlationId`).
- Prism runs with `--cors=false`: only the gateway adds CORS headers, otherwise the browser would see them twice.

## Using the real contracts later

`MOCK_SPEC_DIR=../../contracts/openapi npm run mock` serves the contract files instead of `specs/` once they exist and carry examples (see the Mock API page for the requirements).

## Replacing a mock by a real service

Stop its Prism process, start the real service on the same port; the gateway keeps routing to it.
