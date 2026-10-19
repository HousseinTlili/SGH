# API gateway (`gateway`)

The single entry point of SGH, on port **8080**, built with Spring Cloud Gateway 5 (Spring Boot 4.0, WebFlux). The Angular app talks only to it. It is a thin edge: routing, authentication, coarse role rules, CORS, the correlation id and a clear 503 when a service is down. Business rules stay in the services.

Specification: Notion pages "API Gateway and Security" and "Gateway Config".

## Run and test

```bash
./mvnw spring-boot:run          # or: ./mvnw package && java -jar target/gateway-1.0.0.jar
./mvnw test                     # 142 tests, no Docker and no Keycloak needed
```

Health: `GET /health` -> `{"status":"UP"}`. Status of the six services: `GET /gateway/health/services` (no token for either).

The gateway starts with Keycloak and every service stopped: the signing keys are fetched on the first request that needs them and cached, so users already logged in keep working if Keycloak is stopped later; only new logins fail.

## What it does

1. Routes by path prefix, forwarding the path and every header unchanged (the service validates the token again).
2. Requires a valid Keycloak token on every `/api/**` request: signature (RS256 keys of the realm), issuer and expiry. Anything else, including an unsigned token, gets `401 Missing or invalid token` without saying why. If the keys cannot be fetched because Keycloak is down, the token is refused the same way.
3. Applies the coarse role rules below (`403` when the token has none of the allowed roles). It does not look at HTTP methods.
4. `X-Correlation-Id`: created (8 characters) when missing, forwarded to the service and returned in the response; one access log line per request carries it, plus method, path, status, duration and user (never the token).
5. CORS for `http://localhost:4200` only (GET, POST, PUT, DELETE, OPTIONS; headers Authorization, Content-Type, X-Correlation-Id; exposed X-Correlation-Id, Location). The services add no CORS headers.
6. A service that refuses the connection, cannot be resolved or does not answer within 15 s becomes:
   ```json
   { "timestamp": "...", "status": 503, "error": "Service Unavailable", "service": "lab",
     "message": "Lab service is unavailable, please try again later", "path": "/api/lab-requests", "correlationId": "b3f1c2d4" }
   ```
   A 4xx or 5xx that a service itself returns is passed through untouched. Connecting takes at most 2 s.
7. Paths outside the table answer `404` in the shared error body.

## Route table and role rules

They are data, in `src/main/resources/application.yml` under `sgh.gateway.routes`. Adding a service or changing a rule is one entry; there is no routing code to touch.

| Route | Paths | Service URL variable (default) | Roles (empty = any authenticated user) |
|---|---|---|---|
| patient | `/api/patients/**` | `PATIENT_SERVICE_URL` (`http://localhost:8081`) | all seven |
| reception | `/api/appointments/**` | `RECEPTION_SERVICE_URL` (`:8082`) | RECEPTIONIST, DOCTOR, ADMIN, PATIENT |
| reception | `/api/invoices/**` | `RECEPTION_SERVICE_URL` | RECEPTIONIST, ADMIN, PATIENT |
| consultation | `/api/consultations/**` | `CONSULTATION_SERVICE_URL` (`:8083`) | DOCTOR, NURSE, ADMIN, PATIENT, PHARMACIST |
| consultation | `/api/vitals/**` | `CONSULTATION_SERVICE_URL` | DOCTOR, NURSE, ADMIN |
| lab | `/api/lab-requests/**`, `/api/lab-results/**`, `/api/tests/**` | `LAB_SERVICE_URL` (`:8084`) | LAB_TECHNICIAN, DOCTOR, ADMIN |
| pharmacy | `/api/drugs/**`, `/api/stock/**`, `/api/prescriptions/**` | `PHARMACY_SERVICE_URL` (`:8085`) | PHARMACIST, DOCTOR, ADMIN |
| staff | `/api/staff/**`, `/api/roles`, `/api/me` | `STAFF_SERVICE_URL` (`:8086`) | any authenticated user |

`/api/prescriptions/**` goes to the Pharmacy service (Decisions Log D11); the Consultation service serves its prescriptions under `/api/consultations/{id}/prescriptions`.

### Changing a service URL

Set the variable before starting (see `.env.example`), for example `LAB_SERVICE_URL=http://localhost:9084 ./mvnw spring-boot:run`, or edit the `uri` of its rows in `application.yml`. Keycloak: `KEYCLOAK_ISSUER_URL` (must match the token issuer exactly, always `localhost`) and `KEYCLOAK_JWKS_URL`.

## Known limit

The gateway is the only way in: if it stops, the front end reaches nothing. The resilience demo therefore stops individual services, not the gateway. In production several instances would run behind a load balancer.
