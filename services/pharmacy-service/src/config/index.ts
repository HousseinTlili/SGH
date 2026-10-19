export const config = {
  port: parseInt(process.env.PORT || "8085", 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://sgh:sgh_dev_password@localhost:5432/sgh_pharmacy",
  rabbitmqUrl:
    process.env.RABBITMQ_URL || "amqp://sgh:sgh_dev_password@localhost:5672",
  keycloakIssuer:
    process.env.KEYCLOAK_ISSUER || "http://localhost:8180/realms/sgh",
  keycloakJwksUri:
    process.env.KEYCLOAK_JWKS_URI ||
    "http://localhost:8180/realms/sgh/protocol/openid-connect/certs",
  consultationServiceUrl:
    process.env.CONSULTATION_SERVICE_URL || "http://localhost:8083",
  httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || "2000", 10),
  seed: process.env.SEED !== "false"
};
