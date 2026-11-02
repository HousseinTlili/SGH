"""Input handling, concurrency, error mapping and migrations."""
import json
import threading
import uuid
from pathlib import Path
from unittest.mock import patch

import yaml
from sqlalchemy.exc import OperationalError

from app import database as db_module
from app.database import SessionLocal, engine, run_migrations
from app.models import LabRequest
from tests.jwks import create_test_token

L2 = "f9f9f9f9-0000-4000-8000-000000000002"


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def start_and_enter(client, token, values=None):
    client.post(f"/api/lab-requests/{L2}/start", headers=auth(token))
    values = values or [{"testCode": "K", "value": 4.0}, {"testCode": "CRE", "value": 0.9}]
    return client.post(f"/api/lab-requests/{L2}/results", headers=auth(token), json={"results": values})


def test_technician_without_staff_id_is_forbidden(client):
    token = create_test_token("lab1", ["LAB_TECHNICIAN"])  # no staffId claim
    for path in ("start", "results", "validate"):
        res = client.post(f"/api/lab-requests/{L2}/{path}", headers=auth(token), json={"results": [{"testCode": "K", "value": 1}]})
        assert res.status_code == 403, path
    with SessionLocal() as session:
        assert session.get(LabRequest, uuid.UUID(L2)).status == "REQUESTED"


def test_duplicate_test_codes_in_one_submission_are_rejected(client, lab_tech_token):
    res = start_and_enter(client, lab_tech_token, [{"testCode": "K", "value": 4.0}, {"testCode": "K", "value": 5.0}])
    assert res.status_code == 422
    assert res.json()["details"][0]["problem"] == "Test K appears more than once"


def test_non_finite_values_are_rejected(client, lab_tech_token):
    client.post(f"/api/lab-requests/{L2}/start", headers=auth(lab_tech_token))
    for raw in ('{"results":[{"testCode":"K","value":NaN}]}', '{"results":[{"testCode":"K","value":Infinity}]}'):
        res = client.post(f"/api/lab-requests/{L2}/results", headers={**auth(lab_tech_token), "Content-Type": "application/json"}, content=raw)
        assert res.status_code in (400, 422)


def test_entering_results_again_replaces_the_previous_ones(client, lab_tech_token):
    start_and_enter(client, lab_tech_token)
    res = start_and_enter(client, lab_tech_token, [{"testCode": "K", "value": 9.0}, {"testCode": "CRE", "value": 6.0}])
    body = res.json()
    assert {r["testCode"]: r["flag"] for r in body["results"]} == {"K": "CRITICAL", "CRE": "CRITICAL"}
    assert len(body["results"]) == 2


def test_flag_boundaries(client, lab_tech_token):
    cases = {"K": [(2.4, "CRITICAL"), (2.5, "LOW"), (3.4, "LOW"), (3.5, "NORMAL"), (5.1, "NORMAL"), (5.2, "HIGH"), (6.5, "HIGH"), (6.6, "CRITICAL")]}
    client.post(f"/api/lab-requests/{L2}/start", headers=auth(lab_tech_token))
    for value, expected in cases["K"]:
        res = client.post(f"/api/lab-requests/{L2}/results", headers=auth(lab_tech_token), json={"results": [{"testCode": "K", "value": value}]})
        assert res.json()["results"][0]["flag"] == expected, value


def test_validated_results_are_immutable(client, lab_tech_token):
    start_and_enter(client, lab_tech_token)
    assert client.post(f"/api/lab-requests/{L2}/validate", headers=auth(lab_tech_token)).status_code == 200
    assert client.post(f"/api/lab-requests/{L2}/results", headers=auth(lab_tech_token), json={"results": [{"testCode": "K", "value": 1.0}]}).status_code == 409
    assert client.post(f"/api/lab-requests/{L2}/start", headers=auth(lab_tech_token)).status_code == 409


def test_concurrent_validations_succeed_exactly_once(client, lab_tech_token):
    start_and_enter(client, lab_tech_token)
    statuses = []

    def validate():
        statuses.append(client.post(f"/api/lab-requests/{L2}/validate", headers=auth(lab_tech_token)).status_code)

    threads = [threading.Thread(target=validate) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(statuses) == [200, 409, 409, 409, 409]


def test_concurrent_starts_succeed_exactly_once(client, lab_tech_token):
    statuses = []

    def start():
        statuses.append(client.post(f"/api/lab-requests/{L2}/start", headers=auth(lab_tech_token)).status_code)

    threads = [threading.Thread(target=start) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(statuses) == [200, 409, 409, 409, 409]


def test_work_queue_priority_filter_uses_the_enum(client, lab_tech_token):
    assert client.get("/api/lab-requests?priority=URGENT", headers=auth(lab_tech_token)).status_code == 200
    assert client.get("/api/lab-requests?priority=SOMETIMES", headers=auth(lab_tech_token)).status_code == 400


def test_wrong_parameter_types_are_400_and_unknown_ids_404(client, lab_tech_token):
    assert client.get("/api/lab-requests/not-a-uuid", headers=auth(lab_tech_token)).status_code == 400
    assert client.get("/api/lab-requests?page=abc", headers=auth(lab_tech_token)).status_code == 400
    assert client.get("/api/lab-requests?status=NOPE", headers=auth(lab_tech_token)).status_code == 400
    assert client.get(f"/api/lab-requests/{uuid.uuid4()}", headers=auth(lab_tech_token)).status_code == 404


def test_malformed_json_is_400_and_field_problems_422(client, lab_tech_token):
    client.post(f"/api/lab-requests/{L2}/start", headers=auth(lab_tech_token))
    bad = client.post(f"/api/lab-requests/{L2}/results", headers={**auth(lab_tech_token), "Content-Type": "application/json"}, content="{ nope")
    assert bad.status_code == 400 and bad.json()["correlationId"]
    empty = client.post(f"/api/lab-requests/{L2}/results", headers=auth(lab_tech_token), json={"results": []})
    assert empty.status_code == 422 and empty.json()["details"]


def test_unknown_route_uses_the_shared_error_body(client, doctor_token):
    res = client.get("/api/nothing", headers={**auth(doctor_token), "X-Correlation-Id": "abc12345"})
    assert res.status_code == 404
    assert res.json()["correlationId"] == "abc12345" and res.json()["status"] == 404


def test_no_stub_endpoint_any_more(client, admin_token):
    assert client.get("/api/_stub/ping", headers=auth(admin_token)).status_code == 404


def test_internal_errors_do_not_leak_details(client, lab_tech_token):
    with patch("app.routers.lab_requests.to_lab_request_schema", side_effect=RuntimeError('relation "secret_table" missing')):
        res = client.get(f"/api/lab-requests/{L2}", headers=auth(lab_tech_token))
    assert res.status_code == 500
    assert "secret_table" not in json.dumps(res.json())
    assert res.json()["message"] == "Internal server error"


def test_lost_database_answers_503(client, lab_tech_token):
    err = OperationalError("SELECT 1", {}, Exception("connection refused"))
    with patch("app.routers.lab_requests.to_lab_request_schema", side_effect=err):
        res = client.get(f"/api/lab-requests/{L2}", headers=auth(lab_tech_token))
    assert res.status_code == 503 and res.json()["message"] == "Database unavailable"


def test_data_endpoints_wait_for_the_database_but_health_and_docs_do_not(client, lab_tech_token):
    db_module.db_ready = False
    assert client.get("/api/tests", headers=auth(lab_tech_token)).status_code == 503
    assert client.get("/health").status_code == 200
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_docs_are_served_from_local_assets(client):
    page = client.get("/docs").text
    assert "cdn" not in page.lower() and "jsdelivr" not in page.lower()
    assert client.get("/docs-assets/swagger-ui-bundle.js").status_code == 200


def test_every_path_of_the_committed_contract_is_served(client):
    committed = yaml.safe_load((Path(__file__).resolve().parents[1] / "openapi.yaml").read_text())
    served = client.get("/openapi.json").json()
    assert sorted(served["paths"]) == sorted(committed["paths"])


def test_migrations_are_recorded_and_idempotent():
    run_migrations()
    run_migrations()
    with engine.connect() as conn:
        version = conn.exec_driver_sql("select version_num from alembic_version").scalar()
    assert version == "0001"


def test_seed_matches_the_fixtures(client, lab_tech_token):
    tests = client.get("/api/tests", headers=auth(lab_tech_token)).json()
    assert sorted(t["code"] for t in tests) == ["CHOL", "CRE", "GLU", "HGB", "K", "WBC"]
    queue = client.get("/api/lab-requests", headers=auth(lab_tech_token)).json()
    assert queue["totalElements"] == 2
    assert queue["content"][0]["id"] == L2  # URGENT first
    assert client.get("/api/lab-requests?status=REQUESTED", headers=auth(lab_tech_token)).json()["totalElements"] == 1
