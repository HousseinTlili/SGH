from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8084
    database_url: str = Field(
        "postgresql+psycopg://sgh:sgh_dev_password@localhost:5432/sgh_lab",
        validation_alias="LAB_DATABASE_URL",
    )
    rabbitmq_url: str = "amqp://sgh:sgh_dev_password@localhost:5672/"
    keycloak_issuer: str = "http://localhost:8180/realms/sgh"
    keycloak_jwks_url: str = "http://localhost:8180/realms/sgh/protocol/openid-connect/certs"


settings = Settings()