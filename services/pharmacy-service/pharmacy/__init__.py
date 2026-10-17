import os
import logging

from flask import Flask
from dotenv import load_dotenv
from sqlalchemy.exc import SQLAlchemyError

from .config import Config
from .extensions import db
from .routes import api, health


def create_app(test_config=None):
    load_dotenv()
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    app.register_blueprint(health)
    app.register_blueprint(api, url_prefix="/api")

    if app.config.get("AUTO_CREATE_SCHEMA"):
        with app.app_context():
            try:
                db.create_all()
                from .seed import seed_drugs

                seed_drugs()
            except SQLAlchemyError:
                logging.getLogger(__name__).warning(
                    "Pharmacy database is unavailable; starting without seed data",
                    exc_info=True,
                )

    return app
