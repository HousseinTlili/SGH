import { afterAll } from "vitest";
import { startFakeIdp, stopFakeIdp } from "./fake-idp.js";

process.env.AMQP_REQUEUE_DELAY_MS = "5";

// Set before ../src/config is imported. Run against a real Keycloak with TEST_KEYCLOAK=1.
if (!process.env.TEST_KEYCLOAK) {
  process.env.KEYCLOAK_JWKS_URI = await startFakeIdp();
  afterAll(stopFakeIdp);
}
