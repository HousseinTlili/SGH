import json
import logging

import pika
import requests
from sqlalchemy import select

from .extensions import db
from .models import PrescriptionCopy, PrescriptionItem

logger = logging.getLogger(__name__)


def upsert_prescription_copy(payload):
    prescription_id = payload.get("prescriptionId") or payload.get("id")
    if not prescription_id:
        raise ValueError("prescriptionId is required")

    copy = db.session.scalar(
        select(PrescriptionCopy).where(PrescriptionCopy.prescription_id == prescription_id)
    )
    if copy is None:
        copy = PrescriptionCopy(
            prescription_id=prescription_id,
            consultation_id=payload["consultationId"],
            patient_id=payload["patientId"],
            doctor_id=payload["doctorId"],
            status=payload.get("status", "ISSUED"),
        )
        db.session.add(copy)
        db.session.flush()
        copy.items = [
            PrescriptionItem(
                item_index=index,
                drug_name=item["drugName"],
                dosage=item["dosage"],
                frequency=item["frequency"],
                duration=item["duration"],
            )
            for index, item in enumerate(payload.get("items", []))
        ]
    else:
        copy.status = payload.get("status", copy.status)
    db.session.commit()
    return copy


def publish_event(app, routing_key, payload):
    url = app.config.get("RABBITMQ_URL")
    if not url:
        logger.info("RabbitMQ is not configured; skipped %s", routing_key)
        return False
    connection = None
    try:
        connection = pika.BlockingConnection(pika.URLParameters(url))
        channel = connection.channel()
        declare_event_topology(channel)
        channel.basic_publish(
            exchange="sgh.events",
            routing_key=routing_key,
            body=json.dumps(payload),
            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
        )
        connection.close()
        return True
    except pika.exceptions.PikaException:
        logger.exception("Could not publish %s", routing_key)
        return False
    finally:
        if connection is not None and not connection.is_closed:
            connection.close()


def declare_event_topology(channel):
    channel.exchange_declare(exchange="sgh.events", exchange_type="topic", durable=True)
    channel.queue_declare(queue="pharmacy.prescription-created", durable=True)
    channel.queue_bind(
        exchange="sgh.events",
        queue="pharmacy.prescription-created",
        routing_key="prescription.created",
    )


def verify_prescription_with_consultation(app, prescription):
    """Best-effort verification; local copies remain authoritative during outages."""
    try:
        response = requests.get(
            f"{app.config['CONSULTATION_URL']}/api/consultations/{prescription.consultation_id}/prescriptions",
            timeout=2,
        )
        response.raise_for_status()
        return any(item.get("id") == prescription.prescription_id for item in response.json())
    except requests.RequestException:
        return True
