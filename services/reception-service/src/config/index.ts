export const config = {
  port: parseInt(process.env.PORT || "8082", 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://sgh:sgh_dev_password@localhost:5432/sgh_reception",
  rabbitmqUrl:
    process.env.RABBITMQ_URL || "amqp://sgh:sgh_dev_password@localhost:5672",
  keycloakIssuer:
    process.env.KEYCLOAK_ISSUER || "http://localhost:8180/realms/sgh",
  keycloakJwksUri:
    process.env.KEYCLOAK_JWKS_URI ||
    "http://localhost:8180/realms/sgh/protocol/openid-connect/certs",
  keycloakTokenUrl:
    process.env.KEYCLOAK_TOKEN_URL ||
    "http://localhost:8180/realms/sgh/protocol/openid-connect/token",
  receptionClientId:
    process.env.RECEPTION_CLIENT_ID || "sgh-reception-svc",
  receptionClientSecret:
    process.env.RECEPTION_CLIENT_SECRET || "sgh_reception_dev_secret",
  patientServiceUrl:
    process.env.PATIENT_SERVICE_URL || "http://localhost:8081",
  staffServiceUrl:
    process.env.STAFF_SERVICE_URL || "http://localhost:8086",
  httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || "2000", 10),
  seed: process.env.SEED !== "false",
  logLevel: process.env.LOG_LEVEL || "info"
};
