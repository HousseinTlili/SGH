"""End to end through a real RabbitMQ (infra/docker-compose.yml with definitions.json). Skipped without a broker."""
import asyncio
import json
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import aio_pika
import pytest
from jsonschema import Draft202012Validator

from app import events
from app.config import settings
from app.database import SessionLocal
from app.models import LabRequest, LabRequestTest, LabResult


def broker_up() -> bool:
    url = urlparse(settings.RABBITMQ_URL)
    try:
        with socket.create_connection((url.hostname, url.port or 5672), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(not broker_up(), reason="no RabbitMQ on localhost:5672")

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts" / "events"


async def wait_for(probe, seconds=10.0):
    deadline = asyncio.get_event_loop().time() + seconds
    while asyncio.get_event_loop().time() < deadline:
        value = await probe()
        if value:
            return value
        await asyncio.sleep(0.1)
    raise AssertionError("timed out waiting for condition")


async def test_request_in_result_out_and_poison_to_dlq():
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    exchange = await channel.declare_exchange("sgh.events", aio_pika.ExchangeType.TOPIC, durable=True)

    # What the doctor service would listen with, and the dead-letter queue.
    listener = await channel.declare_queue("", exclusive=True)
    await listener.bind(exchange, routing_key="lab.result.ready")
    dlq = await channel.declare_queue("sgh.events.dlq", durable=True)
    await dlq.purge()

    consumer = asyncio.create_task(events.consumer_loop())
    publisher = asyncio.create_task(events.publisher_loop())
    try:
        # 1. lab.request.created arrives and is stored (LAB-1)
        request_id = uuid.uuid4()
        event = {
            "eventId": str(uuid.uuid4()),
            "type": "lab.request.created",
            "version": 1,
            "occurredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "correlationId": "corr-broker",
            "data": {
                "labRequestId": str(request_id),
                "consultationId": "f7f7f7f7-0000-4000-8000-000000000001",
                "patientId": "a1a1a1a1-0000-4000-8000-000000000005",
                "doctorId": "b2b2b2b2-0000-4000-8000-000000000002",
                "priority": "ROUTINE",
                "tests": [{"code": "K", "name": "Potassium"}],
            },
        }
        body = aio_pika.Message(json.dumps(event).encode(), delivery_mode=aio_pika.DeliveryMode.PERSISTENT)
        await exchange.publish(body, routing_key="lab.request.created")
        await exchange.publish(aio_pika.Message(json.dumps(event).encode()), routing_key="lab.request.created")  # redelivery

        async def stored():
            with SessionLocal() as session:
                return session.get(LabRequest, request_id) is not None

        await wait_for(stored)
        await asyncio.sleep(0.5)
        with SessionLocal() as session:
            assert session.query(LabRequest).filter_by(id=request_id).count() == 1

        # 2. lab.result.ready is published with a confirm and matches the contract (LAB-5)
        with SessionLocal() as session:
            req = session.get(LabRequest, request_id)
            req.status = "VALIDATED"
            req.validated_at = datetime.now(timezone.utc)
            req.validated_by = uuid.UUID("b2b2b2b2-0000-4000-8000-000000000004")
            session.add(
                LabResult(request=req, patient_id=req.patient_id, test_code="K", value=4.2, unit="mmol/L",
                          reference_range="3.5-5.1", flag="NORMAL", validated_at=req.validated_at)
            )
            session.commit()
            session.refresh(req)
            events.publish_lab_result_ready(req, "corr-broker")

        async def received():
            message = await listener.get(fail=False)
            if message is None:
                return None
            await message.ack()
            return json.loads(message.body)

        result = await wait_for(received)
        fmt = Draft202012Validator.FORMAT_CHECKER
        assert not list(Draft202012Validator(json.loads((CONTRACTS / "envelope.schema.json").read_text()), format_checker=fmt).iter_errors(result))
        assert not list(Draft202012Validator(json.loads((CONTRACTS / "lab.result.ready.data.schema.json").read_text()), format_checker=fmt).iter_errors(result["data"]))
        assert result["data"]["labRequestId"] == str(request_id)
        assert events.pending_event_count() == 0

        # 3. a message nobody can process goes to the dead-letter queue
        await exchange.publish(aio_pika.Message(b"this is not json"), routing_key="lab.request.created")

        async def dead():
            message = await dlq.get(fail=False)
            if message is None:
                return None
            await message.ack()
            return message.body

        assert await wait_for(dead) == b"this is not json"
    finally:
        consumer.cancel()
        publisher.cancel()
        await asyncio.gather(consumer, publisher, return_exceptions=True)
        await connection.close()
