import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://sgh:sgh_dev_password@localhost:5432/sgh_pharmacy",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ISSUER = os.getenv("JWT_ISSUER", "http://localhost:8180/realms/sgh")
    JWT_AUDIENCE = os.getenv("JWT_AUDIENCE") or None
    JWT_SECRET = os.getenv("JWT_SECRET") or None
    JWT_PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY") or None
    RABBITMQ_URL = os.getenv("RABBITMQ_URL", "")
    CONSULTATION_URL = os.getenv("CONSULTATION_URL", "http://localhost:8083")
    AUTO_CREATE_SCHEMA = os.getenv("AUTO_CREATE_SCHEMA", "false").lower() == "true"
    JSON_SORT_KEYS = False
