"""lab.request.created consumption (LAB-1, X-5) and lab.result.ready publication (LAB-5, LAB-6)."""
import asyncio
import json
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from jsonschema import Draft202012Validator
from sqlalchemy.exc import OperationalError

from app import database as db_module
from app import events
from app.database import SessionLocal
from app.models import LabRequest, ProcessedEvent

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts" / "events"


def schema(name):
    return json.loads((CONTRACTS / name).read_text())


def message(payload):
    msg = MagicMock()
    msg.body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
    msg.ack = AsyncMock()
    msg.reject = AsyncMock()
    msg.nack = AsyncMock()
    return msg


def created_event(**overrides):
    data = {
        "labRequestId": str(uuid.uuid4()),
        "consultationId": "f7f7f7f7-0000-4000-8000-000000000001",
        "patientId": "a1a1a1a1-0000-4000-8000-000000000005",
        "doctorId": "b2b2b2b2-0000-4000-8000-000000000002",
        "priority": "URGENT",
        "tests": [{"code": "HGB", "name": "Hemoglobin"}, {"code": "GLU", "name": "Fasting glucose"}],
    }
    data.update(overrides)
    return {
        "eventId": str(uuid.uuid4()),
        "type": "lab.request.created",
        "version": 1,
        "occurredAt": "2026-10-18T12:00:00Z",
        "correlationId": "corr-1",
        "data": data,
    }


@pytest.fixture(autouse=True)
def fast_requeue(monkeypatch):
    monkeypatch.setattr(events, "REQUEUE_DELAY_SECONDS", 0)


@pytest.fixture(autouse=True)
def clean_publisher():
    events._pending.clear()
    yield
    events._pending.clear()


def test_consume_stores_the_request_and_acks():
    payload = created_event()
    msg = message(payload)
    asyncio.run(events.handle_lab_request_created(msg))

    msg.ack.assert_awaited_once()
    with SessionLocal() as session:
        stored = session.get(LabRequest, uuid.UUID(payload["data"]["labRequestId"]))
        assert stored.priority == "URGENT" and stored.status == "REQUESTED"
        assert len(stored.tests) == 2
        assert session.get(ProcessedEvent, payload["eventId"]) is not None


def test_redelivery_of_the_same_event_is_acked_without_a_duplicate():
    payload = created_event()
    for _ in range(2):
        msg = message(payload)
        asyncio.run(events.handle_lab_request_created(msg))
        msg.ack.assert_awaited_once()
    with SessionLocal() as session:
        assert session.query(LabRequest).filter_by(id=uuid.UUID(payload["data"]["labRequestId"])).count() == 1


def test_same_lab_request_under_a_new_event_id_is_not_duplicated():
    first = created_event()
    second = created_event(labRequestId=first["data"]["labRequestId"])
    for payload in (first, second):
        msg = message(payload)
        asyncio.run(events.handle_lab_request_created(msg))
        msg.ack.assert_awaited_once()
    with SessionLocal() as session:
        assert session.query(LabRequest).filter_by(id=uuid.UUID(first["data"]["labRequestId"])).count() == 1


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update(data={**p["data"], "priority": "SOMETIMES"}),
        lambda p: p.update(data={**p["data"], "tests": []}),
        lambda p: p.update(data={**p["data"], "labRequestId": "not-a-uuid"}),
        lambda p: p["data"].pop("doctorId"),
        lambda p: p.pop("eventId"),
    ],
)
def test_invalid_payload_is_dead_lettered(mutate):
    payload = created_event()
    mutate(payload)
    msg = message(payload)
    asyncio.run(events.handle_lab_request_created(msg))
    msg.reject.assert_awaited_once_with(requeue=False)
    msg.ack.assert_not_awaited()


def test_not_json_is_dead_lettered():
    msg = message(b"this is not json")
    asyncio.run(events.handle_lab_request_created(msg))
    msg.reject.assert_awaited_once_with(requeue=False)


def test_message_is_requeued_not_dead_lettered_while_the_database_is_not_ready():
    db_module.db_ready = False
    msg = message(created_event())
    asyncio.run(events.handle_lab_request_created(msg))
    msg.nack.assert_awaited_once_with(requeue=True)
    msg.reject.assert_not_awaited()


def test_message_is_requeued_when_the_database_goes_away(monkeypatch):
    def boom(*_args):
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(events, "save_lab_request", boom)
    msg = message(created_event())
    asyncio.run(events.handle_lab_request_created(msg))
    msg.nack.assert_awaited_once_with(requeue=True)


def test_unexpected_event_type_is_acked_and_ignored():
    payload = created_event()
    payload["type"] = "something.else"
    msg = message(payload)
    asyncio.run(events.handle_lab_request_created(msg))
    msg.ack.assert_awaited_once()
    with SessionLocal() as session:
        assert session.get(LabRequest, uuid.UUID(payload["data"]["labRequestId"])) is None


def test_validation_queues_a_contract_conformant_event(client, lab_tech_token):
    l2 = "f9f9f9f9-0000-4000-8000-000000000002"
    auth = {"Authorization": f"Bearer {lab_tech_token}"}
    client.post(f"/api/lab-requests/{l2}/start", headers=auth)
    client.post(f"/api/lab-requests/{l2}/results", headers=auth, json={"results": [{"testCode": "K", "value": 7.0}, {"testCode": "CRE", "value": 0.9}]})
    res = client.post(f"/api/lab-requests/{l2}/validate", headers={**auth, "X-Correlation-Id": "corr-xyz"})
    assert res.status_code == 200

    assert events.pending_event_count() == 1
    event = events._pending[0]
    assert event["type"] == "lab.result.ready" and event["correlationId"] == "corr-xyz"
    envelope = Draft202012Validator(schema("envelope.schema.json"), format_checker=Draft202012Validator.FORMAT_CHECKER)
    data = Draft202012Validator(schema("lab.result.ready.data.schema.json"), format_checker=Draft202012Validator.FORMAT_CHECKER)
    assert not list(envelope.iter_errors(event))
    assert not list(data.iter_errors(event["data"]))
    assert event["data"]["validatedBy"] == "b2b2b2b2-0000-4000-8000-000000000004"
    flags = {r["testCode"]: r["flag"] for r in event["data"]["results"]}
    assert flags == {"K": "CRITICAL", "CRE": "NORMAL"}


def test_validation_survives_a_broker_outage(client, lab_tech_token):
    """No broker is running in this test process: the validation still succeeds and the event waits."""
    l2 = "f9f9f9f9-0000-4000-8000-000000000002"
    auth = {"Authorization": f"Bearer {lab_tech_token}"}
    client.post(f"/api/lab-requests/{l2}/start", headers=auth)
    client.post(f"/api/lab-requests/{l2}/results", headers=auth, json={"results": [{"testCode": "K", "value": 4.0}, {"testCode": "CRE", "value": 0.9}]})
    assert client.post(f"/api/lab-requests/{l2}/validate", headers=auth).status_code == 200
    assert events.pending_event_count() == 1


def test_a_second_validation_does_not_publish_again(client, lab_tech_token):
    l2 = "f9f9f9f9-0000-4000-8000-000000000002"
    auth = {"Authorization": f"Bearer {lab_tech_token}"}
    client.post(f"/api/lab-requests/{l2}/start", headers=auth)
    client.post(f"/api/lab-requests/{l2}/results", headers=auth, json={"results": [{"testCode": "K", "value": 4.0}, {"testCode": "CRE", "value": 0.9}]})
    assert client.post(f"/api/lab-requests/{l2}/validate", headers=auth).status_code == 200
    assert client.post(f"/api/lab-requests/{l2}/validate", headers=auth).status_code == 409
    assert events.pending_event_count() == 1
