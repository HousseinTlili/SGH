# Pharmacy service

Flask microservice for drug catalogue management, stock control and prescription dispensing.

## Run locally

```powershell
cd services/pharmacy
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
flask --app run.py --debug run --port 8085
```

The default database is PostgreSQL. Set `DATABASE_URL` in `.env` or the environment before starting.
For isolated tests, the application factory accepts a SQLite URL.

Initialize or upgrade the database before starting the service:

```powershell
alembic upgrade head
```

The service exposes `GET /health` without authentication and all `/api/**` endpoints require a
Bearer token. The gateway remains responsible for the public entry point and routing.

Run the RabbitMQ consumer in a second terminal:

```powershell
python -m pharmacy.consumer
```

It consumes durable `prescription.created` messages from `sgh.events` and stores local
`PrescriptionCopy` records. The HTTP process does not depend on RabbitMQ being available.

## Tests

```powershell
pytest
```
