import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", "8084"))
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://sgh:sgh_dev_password@localhost:5432/sgh_lab"
    )
    RABBITMQ_URL: str = os.getenv(
        "RABBITMQ_URL",
        "amqp://sgh:sgh_dev_password@localhost:5672/"
    )
    KEYCLOAK_ISSUER_URI: str = os.getenv(
        "KEYCLOAK_ISSUER_URI",
        "http://localhost:8180/realms/sgh"
    )
    KEYCLOAK_JWKS_URI: str = os.getenv(
        "KEYCLOAK_JWKS_URI",
        "http://localhost:8180/realms/sgh/protocol/openid-connect/certs"
    )

settings = Settings()
