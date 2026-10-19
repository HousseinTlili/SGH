import uuid
from unittest.mock import AsyncMock, patch
import pytest
from app import database as db_module
from app.database import SessionLocal
from app.models import LabRequest, ProcessedEvent

# --- Group 1: Health & Documentation ---

def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "UP"}


def test_openapi_json(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    data = res.json()
    assert "openapi" in data
    assert data["info"]["title"] == "SGH Lab service"


# --- Group 2: (stub ping removed, D25) ---


# --- Group 3: Catalogue of tests ---

def test_list_tests_catalogue(client, lab_tech_token):
    res = client.get("/api/tests", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 6
    codes = [t["code"] for t in data]
    assert set(codes) == {"HGB", "WBC", "GLU", "CHOL", "CRE", "K"}


def test_list_tests_forbidden_for_patient(client, patient_token):
    res = client.get("/api/tests", headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 403


# --- Group 4: Lab Requests List & Work Queue (LAB-7) ---

def test_list_lab_requests_queue_order(client, lab_tech_token):
    res = client.get("/api/lab-requests", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["totalElements"] == 2
    # Rule LAB-7: URGENT first (L2), then ROUTINE (L1)
    content = data["content"]
    assert content[0]["priority"] == "URGENT"
    assert content[0]["id"] == "f9f9f9f9-0000-4000-8000-000000000002"
    assert content[1]["priority"] == "ROUTINE"
    assert content[1]["id"] == "f9f9f9f9-0000-4000-8000-000000000001"


def test_list_lab_requests_filters(client, lab_tech_token):
    # Filter by status REQUESTED
    res = client.get("/api/lab-requests?status=REQUESTED", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    assert res.json()["totalElements"] == 1
    assert res.json()["content"][0]["status"] == "REQUESTED"

    # Filter by priority URGENT
    res = client.get("/api/lab-requests?priority=URGENT", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    assert res.json()["totalElements"] == 1
    assert res.json()["content"][0]["priority"] == "URGENT"


def test_get_one_lab_request(client, lab_tech_token):
    l1_id = "f9f9f9f9-0000-4000-8000-000000000001"
    res = client.get(f"/api/lab-requests/{l1_id}", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == l1_id
    assert data["status"] == "VALIDATED"
    assert len(data["results"]) == 2


# --- Group 5: Start Lab Request (LAB-2) ---

def test_start_lab_request_success(client, lab_tech_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    res = client.post(f"/api/lab-requests/{l2_id}/start", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "IN_PROGRESS"
    assert data["startedAt"] is not None


def test_start_lab_request_conflict_when_already_started(client, lab_tech_token):
    l1_id = "f9f9f9f9-0000-4000-8000-000000000001"  # Already VALIDATED
    res = client.post(f"/api/lab-requests/{l1_id}/start", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 409
    assert "VALIDATED" in res.json()["message"]


def test_start_lab_request_forbidden_for_doctor(client, doctor_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    res = client.post(f"/api/lab-requests/{l2_id}/start", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 403


# --- Group 6: Enter Results and Flag Computations (LAB-2, LAB-3, LAB-4) ---

def test_enter_results_and_compute_flags(client, lab_tech_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    # First start request
    client.post(f"/api/lab-requests/{l2_id}/start", headers={"Authorization": f"Bearer {lab_tech_token}"})

    # Enter results: K (Potassium, ref 3.5-5.1, crit 2.5-6.5), CRE (Creatinine, ref 0.6-1.3, crit max 5.0)
    # Test Potassium value 7.0 -> CRITICAL (> 6.5)
    # Test Creatinine value 1.5 -> HIGH (> 1.3 but <= 5.0)
    payload = {
        "results": [
            {"testCode": "K", "value": 7.0},
            {"testCode": "CRE", "value": 1.5}
        ]
    }
    res = client.post(f"/api/lab-requests/{l2_id}/results", headers={"Authorization": f"Bearer {lab_tech_token}"}, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESULT_ENTERED"
    assert len(data["results"]) == 2

    k_res = next(r for r in data["results"] if r["testCode"] == "K")
    assert k_res["value"] == 7.0
    assert k_res["flag"] == "CRITICAL"
    assert k_res["unit"] == "mmol/L"

    cre_res = next(r for r in data["results"] if r["testCode"] == "CRE")
    assert cre_res["value"] == 1.5
    assert cre_res["flag"] == "HIGH"
    assert cre_res["unit"] == "mg/dL"


def test_enter_results_invalid_test_code_returns_422(client, lab_tech_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    client.post(f"/api/lab-requests/{l2_id}/start", headers={"Authorization": f"Bearer {lab_tech_token}"})

    # HGB is not in L2 tests (L2 has K and CRE)
    payload = {
        "results": [
            {"testCode": "HGB", "value": 14.0}
        ]
    }
    res = client.post(f"/api/lab-requests/{l2_id}/results", headers={"Authorization": f"Bearer {lab_tech_token}"}, json=payload)
    assert res.status_code == 422
    assert "details" in res.json()


def test_enter_results_conflict_when_requested(client, lab_tech_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    # Not yet started
    payload = {"results": [{"testCode": "K", "value": 4.0}]}
    res = client.post(f"/api/lab-requests/{l2_id}/results", headers={"Authorization": f"Bearer {lab_tech_token}"}, json=payload)
    assert res.status_code == 409


# --- Group 7: Validate Lab Request (LAB-5, LAB-6) ---

@patch("app.routers.lab_requests.publish_lab_result_ready")
def test_validate_lab_request_success(mock_publish, client, lab_tech_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    client.post(f"/api/lab-requests/{l2_id}/start", headers={"Authorization": f"Bearer {lab_tech_token}"})
    client.post(f"/api/lab-requests/{l2_id}/results", headers={"Authorization": f"Bearer {lab_tech_token}"}, json={
        "results": [
            {"testCode": "K", "value": 4.2},
            {"testCode": "CRE", "value": 0.9}
        ]
    })

    res = client.post(f"/api/lab-requests/{l2_id}/validate", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VALIDATED"
    assert data["validatedAt"] is not None
    assert mock_publish.called


def test_validate_missing_test_results_returns_422(client, lab_tech_token):
    l2_id = "f9f9f9f9-0000-4000-8000-000000000002"
    client.post(f"/api/lab-requests/{l2_id}/start", headers={"Authorization": f"Bearer {lab_tech_token}"})
    # Only enter result for K, CRE is missing
    client.post(f"/api/lab-requests/{l2_id}/results", headers={"Authorization": f"Bearer {lab_tech_token}"}, json={
        "results": [
            {"testCode": "K", "value": 4.2}
        ]
    })

    res = client.post(f"/api/lab-requests/{l2_id}/validate", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 422
    assert "details" in res.json()


# --- Group 8: Validated Results Query ---

def test_list_validated_results(client, doctor_token):
    res = client.get("/api/lab-results", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["totalElements"] >= 2
    for r in data["content"]:
        assert r["flag"] in ("NORMAL", "HIGH", "LOW", "CRITICAL")
        assert r["validatedAt"] is not None


# --- Group 9: Resilience (Rule X-8) ---

def test_database_unavailable_returns_503(client, lab_tech_token):
    db_module.db_ready = False

    res = client.get("/api/lab-requests", headers={"Authorization": f"Bearer {lab_tech_token}"})
    assert res.status_code == 503
    assert res.json()["message"] == "Database unavailable"

    # Health remains 200 UP
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "UP"

    db_module.db_ready = True
