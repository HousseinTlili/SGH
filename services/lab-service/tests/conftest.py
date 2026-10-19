import os

# Set testing environment variable
os.environ["TESTING"] = "1"

import jwt
import pytest
from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from app import database as db_module
from app.main import app as fastapi_app
from app.seed import seed_lab_data
from app.models import LabRequest, LabResult, LabRequestTest, ProcessedEvent

@pytest.fixture(autouse=True)
def setup_test_db():
    db_module.db_ready = True
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        # Clean test and request tables
        session.query(LabResult).delete()
        session.query(LabRequestTest).delete()
        session.query(LabRequest).delete()
        session.query(ProcessedEvent).delete()
        session.commit()
        # Seed fresh L1 and L2 and catalogue
        seed_lab_data(session)
    yield
    db_module.db_ready = True

@pytest.fixture
def client():
    with TestClient(fastapi_app, raise_server_exceptions=False) as c:
        yield c

def create_test_token(username: str, roles: list[str], staff_id: str = None, patient_id: str = None) -> str:
    payload = {
        "preferred_username": username,
        "realm_access": {"roles": roles},
        "iss": "http://localhost:8180/realms/sgh",
        "sub": username
    }
    if staff_id:
        payload["staffId"] = staff_id
    if patient_id:
        payload["patientId"] = patient_id

    return jwt.encode(payload, key="", algorithm="none")

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
