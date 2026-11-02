import os

# Must be set before the app is imported: settings are read at import time.
os.environ["TESTING"] = "1"

import psycopg2
import pytest

# Tests wipe and reseed their database, so they never touch the development one. A DATABASE_URL set
# explicitly (CI) is respected; otherwise sgh_lab_test is created on demand.
ADMIN_DSN = os.getenv("TEST_DATABASE_ADMIN_DSN", "postgresql://sgh:sgh_dev_password@localhost:5432/postgres")
if "DATABASE_URL" not in os.environ:
    _conn = psycopg2.connect(ADMIN_DSN)
    _conn.autocommit = True
    with _conn.cursor() as _cur:
        _cur.execute("SELECT 1 FROM pg_database WHERE datname = 'sgh_lab_test'")
        if _cur.fetchone() is None:
            _cur.execute("CREATE DATABASE sgh_lab_test")
    _conn.close()
    os.environ["DATABASE_URL"] = "postgresql+psycopg2://sgh:sgh_dev_password@localhost:5432/sgh_lab_test"

from tests.jwks import ISSUER, KEY_ID, _other_key, _private_key, create_test_token  # noqa: E402,F401  (starts the JWKS server)

from fastapi.testclient import TestClient  # noqa: E402

from app import database as db_module  # noqa: E402
from app.database import SessionLocal, run_migrations  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.models import LabRequest, LabRequestTest, LabResult, ProcessedEvent  # noqa: E402
from app.seed import seed_lab_data  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    run_migrations()


@pytest.fixture(autouse=True)
def setup_test_db(migrated_database):
    db_module.db_ready = True
    with SessionLocal() as session:
        session.query(LabResult).delete()
        session.query(LabRequestTest).delete()
        session.query(LabRequest).delete()
        session.query(ProcessedEvent).delete()
        session.commit()
        seed_lab_data(session)
    yield
    db_module.db_ready = True


@pytest.fixture
def client():
    with TestClient(fastapi_app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def admin_token():
    return create_test_token("admin1", ["ADMIN"], staff_id="b2b2b2b2-0000-4000-8000-000000000007")


@pytest.fixture
def lab_tech_token():
    return create_test_token("lab1", ["LAB_TECHNICIAN"], staff_id="b2b2b2b2-0000-4000-8000-000000000004")


@pytest.fixture
def doctor_token():
    return create_test_token("doctor1", ["DOCTOR"], staff_id="b2b2b2b2-0000-4000-8000-000000000001")


@pytest.fixture
def patient_token():
    return create_test_token("patient1", ["PATIENT"], patient_id="a1a1a1a1-0000-4000-8000-000000000001")
