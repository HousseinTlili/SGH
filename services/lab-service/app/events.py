"""RabbitMQ side of the lab service.

Consumes `lab.request.created` (LAB-1) and publishes `lab.result.ready` (LAB-5, LAB-6).
Neither direction may stop the service from starting (X-6): both run as background tasks that
reconnect with backoff (1, 2, 4, 8, 16, 30 seconds).
"""
import asyncio
import json
import logging
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app import database
from app.config import settings
from app.database import SessionLocal, is_database_down
from app.models import LabRequest, LabRequestTest, ProcessedEvent

logger = logging.getLogger("lab-service.events")

EXCHANGE = "sgh.events"
DLX = "sgh.events.dlx"
QUEUE = "lab.lab.request.created"

BACKOFF = [1, 2, 4, 8, 16, 30]
REQUEUE_DELAY_SECONDS = 2.0
MAX_PENDING_EVENTS = 1000


# ---------------------------------------------------------------------------
# Incoming event contract (contracts/events/lab.request.created + envelope)
# ---------------------------------------------------------------------------

class TestRef(BaseModel):
    code: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=100)


class LabRequestCreatedData(BaseModel):
    labRequestId: uuid.UUID
    consultationId: uuid.UUID
    patientId: uuid.UUID
    doctorId: uuid.UUID
    priority: str = Field(pattern="^(ROUTINE|URGENT)$")
    tests: List[TestRef] = Field(min_length=1, max_length=10)


class Envelope(BaseModel):
    eventId: uuid.UUID
    type: str
    version: int
    occurredAt: datetime
    correlationId: str
    data: Dict[str, Any]


class NotReady(Exception):
    """The database has not finished migrating yet; the message must wait, not die."""


def save_lab_request(envelope: Envelope, data: LabRequestCreatedData) -> bool:
    """Stores the request once. Returns False when the event was already processed (X-5)."""
    with SessionLocal() as session:
        # Insert first and let the primary key arbitrate, so two deliveries of the same event
        # racing each other cannot both apply it.
        claimed = session.execute(
            pg_insert(ProcessedEvent)
            .values(event_id=str(envelope.eventId))
            .on_conflict_do_nothing()
            .returning(ProcessedEvent.event_id)
        ).first()
        if claimed is None:
            session.rollback()
            return False

        # The same labRequestId under a different eventId must not create a duplicate either.
        if session.get(LabRequest, data.labRequestId) is None:
            request = LabRequest(
                id=data.labRequestId,
                consultation_id=data.consultationId,
                patient_id=data.patientId,
                doctor_id=data.doctorId,
                priority=data.priority,
                status="REQUESTED",
                requested_at=envelope.occurredAt,
            )
            session.add(request)
            for test in data.tests:
                session.add(LabRequestTest(request=request, code=test.code, name=test.name))
        session.commit()
        return True


async def handle_lab_request_created(message: AbstractIncomingMessage) -> None:
    """Acknowledge only after the effect and its eventId are saved; classify failures."""
    try:
        if not database.db_ready:
            raise NotReady()
        envelope = Envelope.model_validate(json.loads(message.body))
        if envelope.type != "lab.request.created":
            logger.warning("Ignoring unexpected event type %s", envelope.type)
            await message.ack()
            return
        data = LabRequestCreatedData.model_validate(envelope.data)

        created = await asyncio.to_thread(save_lab_request, envelope, data)
        logger.info(
            "lab.request.created %s for %s (correlationId=%s)",
            "stored" if created else "already processed",
            data.labRequestId,
            envelope.correlationId,
        )
        await message.ack()
    except (NotReady, Exception) as exc:
        if isinstance(exc, NotReady) or is_database_down(exc):
            # Not the message's fault: keep it, dead-lettering would lose a valid request.
            logger.warning("Cannot process event now (%s), requeueing", exc.__class__.__name__)
            await asyncio.sleep(REQUEUE_DELAY_SECONDS)
            await message.nack(requeue=True)
        else:
            reason = "invalid payload" if isinstance(exc, (ValidationError, ValueError)) else "unexpected error"
            logger.error("Dead-lettering lab.request.created (%s): %s", reason, exc.__class__.__name__)
            await message.reject(requeue=False)


async def consumer_loop() -> None:
    attempt = 0
    while True:
        connection = None
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL, timeout=5)
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=10)
            exchange = await channel.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
            await channel.declare_exchange(DLX, aio_pika.ExchangeType.FANOUT, durable=True)
            queue = await channel.declare_queue(QUEUE, durable=True, arguments={"x-dead-letter-exchange": DLX})
            await queue.bind(exchange, routing_key="lab.request.created")
            attempt = 0
            logger.info("Consuming %s", QUEUE)
            async with queue.iterator() as messages:
                async for message in messages:
                    await handle_lab_request_created(message)
        except asyncio.CancelledError:
            if connection is not None:
                await connection.close()
            raise
        except Exception as exc:
            delay = BACKOFF[min(attempt, len(BACKOFF) - 1)]
            logger.warning("RabbitMQ consumer unavailable (%s), retrying in %ds", exc.__class__.__name__, delay)
            attempt += 1
            await asyncio.sleep(delay)


# ---------------------------------------------------------------------------
# Publishing lab.result.ready
# ---------------------------------------------------------------------------

_pending: Deque[Dict[str, Any]] = deque()
_wake: Optional[asyncio.Event] = None
_loop: Optional[asyncio.AbstractEventLoop] = None


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_result_ready_event(lab_request: LabRequest, correlation_id: str) -> Dict[str, Any]:
    return {
        "eventId": str(uuid.uuid4()),
        "type": "lab.result.ready",
        "version": 1,
        "occurredAt": _iso(lab_request.validated_at),
        "correlationId": correlation_id,
        "data": {
            "labRequestId": str(lab_request.id),
            "consultationId": str(lab_request.consultation_id),
            "patientId": str(lab_request.patient_id),
            "validatedBy": str(lab_request.validated_by),
            "validatedAt": _iso(lab_request.validated_at),
            "results": [
                {
                    "testCode": r.test_code,
                    "value": float(r.value),
                    "unit": r.unit,
                    "referenceRange": r.reference_range,
                    "flag": r.flag,
                }
                for r in lab_request.results
            ],
        },
    }


def _enqueue(event: Dict[str, Any]) -> None:
    if len(_pending) >= MAX_PENDING_EVENTS:
        dropped = _pending.popleft()
        logger.error("Event buffer full, dropped oldest event %s", dropped["eventId"])
    _pending.append(event)
    if _wake is not None:
        _wake.set()


def publish_lab_result_ready(lab_request: LabRequest, correlation_id: str) -> None:
    """Queues the event after the validation has been committed (LAB-5). Never raises and never
    waits for the broker, so a broker outage cannot undo or delay a validation (LAB-6). Safe to
    call from a worker thread."""
    event = build_result_ready_event(lab_request, correlation_id)
    if _loop is not None and _loop.is_running():
        _loop.call_soon_threadsafe(_enqueue, event)
    else:
        _enqueue(event)


def pending_event_count() -> int:
    return len(_pending)


async def publisher_loop() -> None:
    """Sends queued events with publisher confirms; retries for as long as the process lives."""
    global _wake, _loop
    _loop = asyncio.get_running_loop()
    _wake = asyncio.Event()
    if _pending:
        _wake.set()

    connection = None
    attempt = 0
    try:
        while True:
            await _wake.wait()
            # Cleared before draining: an event queued meanwhile sets it again, so none is missed.
            _wake.clear()
            while _pending:
                try:
                    if connection is None or connection.is_closed:
                        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL, timeout=5)
                        channel = await connection.channel(publisher_confirms=True)
                        exchange = await channel.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
                    event = _pending[0]
                    await exchange.publish(
                        aio_pika.Message(
                            body=json.dumps(event).encode("utf-8"),
                            content_type="application/json",
                            message_id=event["eventId"],
                            correlation_id=event["correlationId"],
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                        ),
                        routing_key=event["type"],
                    )
                    _pending.popleft()
                    attempt = 0
                    logger.info("Published %s %s", event["type"], event["eventId"])
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    delay = BACKOFF[min(attempt, len(BACKOFF) - 1)]
                    logger.warning("Publish failed (%s), retrying in %ds", exc.__class__.__name__, delay)
                    attempt += 1
                    connection = None
                    await asyncio.sleep(delay)
    finally:
        if connection is not None and not connection.is_closed:
            await connection.close()
