# SGH KillerCoda Cloud Deployment Guide

This guide demonstrates the full multi-container cloud deployment of SGH on **KillerCoda** (Ubuntu playground with Docker pre-installed) to satisfy **Criterion 12 (Valeurs Ajoutées / Cloud Deploy)**.

---

## 1. Quick Launch on KillerCoda (One Command)

Open an interactive Ubuntu terminal at [KillerCoda Ubuntu Playground](https://killercoda.com/playgrounds/scenario/ubuntu).

Run the automated one-line setup:

```bash
# Clone the repository
git clone https://github.com/HousseinTlili/SGH.git sgh
cd sgh

# Launch the entire cloud ecosystem
docker compose -f docker-compose.cloud.yml up -d
```

---

## 2. Verify Cloud Deployment

Check running containers:
```bash
docker compose -f docker-compose.cloud.yml ps
```

All 14 containers will be up and running:
* `sgh-postgres` (PostgreSQL 16)
* `sgh-rabbitmq` (RabbitMQ 4 Management)
* `sgh-keycloak` (Keycloak 26 IAM)
* `sgh-eureka` (Netflix Eureka Server - Port `8761`)
* `sgh-config` (Spring Cloud Config Server - Port `8888`)
* `sgh-patient-service` (Port `8081`)
* `sgh-reception-service` (Port `8082`)
* `sgh-doctor-service` (Port `8083`)
* `sgh-lab-service` (Port `8084`)
* `sgh-pharmacy-service` (Port `8085`)
* `sgh-staff-service` (Port `8086`)
* `sgh-notification-service` (Port `8087`)
* `sgh-gateway` (API Gateway - Port `8080`)
* `sgh-frontend` (Angular 22 SPA - Port `4200`)

---

## 3. Defense Demonstration Points on KillerCoda

1. **Centralized Swagger UI**:
   Open port `8080` in the KillerCoda traffic tab:
   ```
   http://<host>:8080/swagger-ui.html
   ```
   Shows the unified dropdown aggregating all 7 microservices.

2. **Eureka Service Registry**:
   Open port `8761`:
   ```
   http://<host>:8761/
   ```
   Shows registered microservice instances (`PATIENT-SERVICE`, `STAFF-SERVICE`, `CONFIG-SERVER`, `GATEWAY`).

3. **Dynamic Configuration Refresh**:
   ```bash
   curl -X POST http://localhost:8081/actuator/refresh
   curl -s http://localhost:8081/api/patients/config/welcome
   ```

4. **Synchronous OpenFeign Inter-Service Call**:
   ```bash
   curl -s http://localhost:8081/api/patients/practitioner/b2b2b2b2-0000-4000-8000-000000000001
   ```
