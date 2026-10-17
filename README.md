# SGH - Hospital Management System

Six independent microservices (Patient, Reception, Doctor/Consultation, Lab, Pharmacy, Staff and Access), one API gateway, one Angular front end, Keycloak for login, RabbitMQ for events and Postgres. Built for the course "Applications Web Distribuees" (ESPRIT). Runs locally only.

> Status: work in progress. Sections below are filled in as each part is built and tested. The full plan is in `docs/MASTER-PLAN.md`.

## 1. What SGH is and what it demonstrates
Placeholder, written in the documentation phase.

## 2. Architecture
See `docs/architecture.md` (diagram added in the documentation phase).

## 3. Team and ownership
Placeholder.

## 4. Prerequisites
Git, Node.js 24 (or 22.22+), JDK 17+, Python 3.12+, Docker Desktop with WSL2, `jq`, Git Bash on Windows.

## 5. Run everything
Placeholder: infrastructure, services, gateway, front end, with ports (4200, 8080 to 8086, 8180, 5672/15672, 5432).

## 6. Test accounts
One user per role, development password `Sgh@dev2026` (see the Keycloak realm).

## 7. Run the tests
Placeholder.

## 8. Run the resilience demo
Placeholder.

## 9. Known limits
Gateway single point of failure, events lost during a broker outage (no outbox), eventual consistency, seed timestamps relative to first start.
