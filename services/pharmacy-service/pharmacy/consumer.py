import json
import logging
import time

import pika

from . import create_app
from .services import declare_event_topology, upsert_prescription_copy

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

    reconnect_seconds = app.config["RABBITMQ_RECONNECT_SECONDS"]
    while True:
        try:
            _consume_once(app, url)
        except pika.exceptions.PikaException:
            logger.exception("RabbitMQ connection lost; retrying")
            time.sleep(reconnect_seconds)


def _consume_once(app, url):
    connection = pika.BlockingConnection(pika.URLParameters(url))
    try:
        channel = connection.channel()
        declare_event_topology(channel)
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
    finally:
        if not connection.is_closed:
            connection.close()


if __name__ == "__main__":
    consume_prescription_events()
