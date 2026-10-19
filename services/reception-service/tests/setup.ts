import { afterAll } from "vitest";
import pg from "pg";
import { startFakeIdp, stopFakeIdp } from "./fake-idp.js";
import { startPeers, stopPeers } from "./peers.js";

// Tests wipe and reseed their database, so they never run against the development one.
// DATABASE_URL set explicitly (CI) is respected; otherwise sgh_reception_test is created on demand.
if (!process.env.DATABASE_URL) {
  const admin = new pg.Client({
    connectionString:
      process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://sgh:sgh_dev_password@localhost:5432/postgres"
  });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'sgh_reception_test'");
    if (exists.rowCount === 0) await admin.query("CREATE DATABASE sgh_reception_test");
  } finally {
    await admin.end();
  }
  process.env.DATABASE_URL = "postgres://sgh:sgh_dev_password@localhost:5432/sgh_reception_test";
}

// Set before ../src/config is imported. Run against a real Keycloak with TEST_KEYCLOAK=1.
if (!process.env.TEST_KEYCLOAK) {
  process.env.KEYCLOAK_JWKS_URI = await startFakeIdp();
  afterAll(stopFakeIdp);
}

// Peer services and the token endpoint are stubs the tests can break on purpose (see tests/peers.ts).
const peerUrl = await startPeers();
process.env.PATIENT_SERVICE_URL = peerUrl;
process.env.STAFF_SERVICE_URL = peerUrl;
process.env.KEYCLOAK_TOKEN_URL = `${peerUrl}/token`;
process.env.HTTP_TIMEOUT_MS = "300";
afterAll(stopPeers);
