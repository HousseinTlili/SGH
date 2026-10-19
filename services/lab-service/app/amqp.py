import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
import aio_pika
from sqlalchemy.orm import Session
from app.config import settings
from app.database import SessionLocal
from app.models import LabRequest, LabRequestTest, ProcessedEvent

logger = logging.getLogger("lab-service.amqp")

amqp_connection = None
amqp_channel = None

async def get_amqp_channel():
    global amqp_connection, amqp_channel
    if amqp_channel and not amqp_channel.is_closed:
        return amqp_channel

    try:
        amqp_connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        amqp_channel = await amqp_connection.channel()
        return amqp_channel
    except Exception as e:
        logger.warning(f"Could not connect to RabbitMQ: {e}")
        return None


async def publish_lab_result_ready(lab_request: LabRequest, correlation_id: str):
    """
    Publish lab.result.ready event to sgh.events exchange (LAB-6).
    Never rolls back DB validation if publish fails.
    """
    try:
        channel = await get_amqp_channel()
        if not channel:
            logger.warning("RabbitMQ channel not available; skipping publish")
            return

        exchange = await channel.get_exchange("sgh.events")

        results_data = []
        for r in lab_request.results:
            results_data.append({
                "testCode": r.test_code,
                "value": float(r.value),
                "unit": r.unit,
                "referenceRange": r.reference_range,
                "flag": r.flag
            })

        event_payload = {
            "eventId": str(uuid.uuid4()),
            "type": "lab.result.ready",
            "version": 1,
            "occurredAt": lab_request.validated_at.isoformat(),
            "correlationId": correlation_id,
            "data": {
                "labRequestId": str(lab_request.id),
                "consultationId": str(lab_request.consultation_id),
                "patientId": str(lab_request.patient_id),
                "validatedBy": str(lab_request.validated_by),
                "validatedAt": lab_request.validated_at.isoformat(),
                "results": results_data
            }
        }

        message = aio_pika.Message(
            body=json.dumps(event_payload).encode("utf-8"),
            content_type="application/json",
            correlation_id=correlation_id,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT
        )

        await exchange.publish(message, routing_key="lab.result.ready")
        logger.info(f"Published lab.result.ready for request {lab_request.id}")
    except Exception as e:
        logger.error(f"Failed to publish lab.result.ready for request {lab_request.id}: {e}")


async def process_lab_request_created(message: aio_pika.IncomingMessage):
    async with message.process(requeue=False, ignore_processed=True):
        try:
            body = json.loads(message.body.decode("utf-8"))
            event_id = body.get("eventId")
            data = body.get("data")

            if not event_id or not data:
                logger.warning("Malformed event missing eventId or data, dead-lettering")
                await message.reject(requeue=False)
                return

            req_id_str = data.get("labRequestId")
            consultation_id_str = data.get("consultationId")
            patient_id_str = data.get("patientId")
            doctor_id_str = data.get("doctorId")
            priority = data.get("priority")
            tests_list = data.get("tests")

            if not all([req_id_str, consultation_id_str, patient_id_str, doctor_id_str, priority, tests_list]):
                logger.warning("Malformed lab.request.created data, dead-lettering")
                await message.reject(requeue=False)
                return

            req_id = uuid.UUID(req_id_str)
            consultation_id = uuid.UUID(consultation_id_str)
            patient_id = uuid.UUID(patient_id_str)
            doctor_id = uuid.UUID(doctor_id_str)

            # Idempotency and database insertion
            with SessionLocal() as session:
                # 1. Check idempotency on event_id
                already_processed = session.query(ProcessedEvent).filter_by(event_id=event_id).first()
                if already_processed:
                    logger.info(f"Event {event_id} already processed. Skipping.")
                    return

                # 2. Check if request already exists
                existing_req = session.query(LabRequest).filter_by(id=req_id).first()
                if not existing_req:
                    occurred_at_str = body.get("occurredAt")
                    requested_at = datetime.fromisoformat(occurred_at_str.replace("Z", "+00:00")) if occurred_at_str else datetime.now(timezone.utc)

                    new_req = LabRequest(
                        id=req_id,
                        consultation_id=consultation_id,
                        patient_id=patient_id,
                        doctor_id=doctor_id,
                        priority=priority,
                        status="REQUESTED",
                        requested_at=requested_at
                    )
                    session.add(new_req)

                    for t in tests_list:
                        test_obj = LabRequestTest(
                            request=new_req,
                            code=t["code"],
                            name=t["name"]
                        )
                        session.add(test_obj)

                # Record processed event
                session.add(ProcessedEvent(event_id=event_id))
                session.commit()
                logger.info(f"Consumed and saved lab.request.created for {req_id}")

        except Exception as e:
            logger.error(f"Error processing lab.request.created message: {e}")
            await message.reject(requeue=False)


async def start_consumer():
    while True:
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            channel = await connection.channel()
            queue = await channel.get_queue("lab.lab.request.created")

            logger.info("Started consuming from lab.lab.request.created")
            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await process_lab_request_created(message)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"RabbitMQ consumer connection lost: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)
