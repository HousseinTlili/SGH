import http from "node:http";
import { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";

// Stand-in for the Keycloak realm so the suite runs without Docker.
// Users and claims mirror infra/keycloak/sgh-realm.json.
const USERS: Record<string, { roles: string[]; staffId?: string; patientId?: string }> = {
  doctor1: { roles: ["DOCTOR"], staffId: "b2b2b2b2-0000-4000-8000-000000000001" },
  doctor2: { roles: ["DOCTOR"], staffId: "b2b2b2b2-0000-4000-8000-000000000002" },
  nurse1: { roles: ["NURSE"], staffId: "b2b2b2b2-0000-4000-8000-000000000003" },
  lab1: { roles: ["LAB_TECHNICIAN"], staffId: "b2b2b2b2-0000-4000-8000-000000000004" },
  pharmacist1: { roles: ["PHARMACIST"], staffId: "b2b2b2b2-0000-4000-8000-000000000005" },
  reception1: { roles: ["RECEPTIONIST"], staffId: "b2b2b2b2-0000-4000-8000-000000000006" },
  admin1: { roles: ["ADMIN"], staffId: "b2b2b2b2-0000-4000-8000-000000000007" },
  patient1: { roles: ["PATIENT"], patientId: "a1a1a1a1-0000-4000-8000-000000000001" }
};

const ISSUER = "http://localhost:8180/realms/sgh";

let server: http.Server | null = null;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"] | null = null;

export async function startFakeIdp(): Promise<string> {
  const { publicKey, privateKey: priv } = await generateKeyPair("RS256");
  privateKey = priv;
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };

  server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/certs`;
}

export async function stopFakeIdp(): Promise<void> {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
}

export async function signToken(username: string): Promise<string> {
  const user = USERS[username];
  if (!user || !privateKey) throw new Error(`Unknown test user or IdP not started: ${username}`);
  const claims: Record<string, unknown> = {
    preferred_username: username,
    realm_access: { roles: [...user.roles, "offline_access", "uma_authorization"] }
  };
  if (user.staffId) claims.staffId = user.staffId;
  if (user.patientId) claims.patientId = user.patientId;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ISSUER)
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}
