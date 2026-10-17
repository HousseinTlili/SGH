import json
import logging

import pika

from . import create_app
from .services import upsert_prescription_copy

logger = logging.getLogger(__name__)


def consume_prescription_events():
    """Consume prescription.created events and persist local copies.

    This process is deliberately separate from Flask so the HTTP service can start and serve
    existing local copies while RabbitMQ is unavailable.
    """
    app = create_app()
    url = app.config.get("RABBITMQ_URL")
    if not url:
        raise RuntimeError("RABBITMQ_URL must be configured for the event consumer")

    connection = pika.BlockingConnection(pika.URLParameters(url))
    channel = connection.channel()
    channel.exchange_declare(exchange="sgh.events", exchange_type="topic", durable=True)
    channel.queue_declare(queue="pharmacy.prescription-created", durable=True)
    channel.queue_bind(
        exchange="sgh.events",
        queue="pharmacy.prescription-created",
        routing_key="prescription.created",
    )
    channel.basic_qos(prefetch_count=1)

    def on_message(channel, method, properties, body):
        try:
            with app.app_context():
                upsert_prescription_copy(json.loads(body))
            channel.basic_ack(method.delivery_tag)
        except (TypeError, ValueError, KeyError, json.JSONDecodeError):
            logger.exception("Invalid prescription.created event")
            channel.basic_nack(method.delivery_tag, requeue=False)
        except Exception:
            logger.exception("Could not persist prescription.created event")
            channel.basic_nack(method.delivery_tag, requeue=True)

    channel.basic_consume(
        queue="pharmacy.prescription-created",
        on_message_callback=on_message,
    )
    logger.info("Waiting for prescription.created events")
    channel.start_consuming()


if __name__ == "__main__":
    consume_prescription_events()
