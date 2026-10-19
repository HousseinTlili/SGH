import { config } from "../src/config/index.js";
import { runMigrations } from "../src/db/migrate.js";
import { runSeed } from "../src/db/seed.js";
import { pool, setDatabaseReady } from "../src/db/pool.js";

const tokenCache = new Map<string, string>();

export async function getToken(
  username: string,
  password = "Sgh@dev2026"
): Promise<string> {
  const cached = tokenCache.get(username);
  if (cached) return cached;

  const res = await fetch(
    `${config.keycloakIssuer}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "sgh-dev-cli",
        username,
        password
      }).toString()
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to get token for ${username}: ${res.statusText}`);
  }

  const json = (await res.json()) as { access_token: string };
  tokenCache.set(username, json.access_token);
  return json.access_token;
}

export async function setupTestDatabase(): Promise<void> {
  await runMigrations();
  const client = await pool.connect();
  try {
    await client.query(`
      TRUNCATE TABLE 
        drugs, 
        prescription_copies, 
        prescription_items, 
        dispensings, 
        dispensing_lines, 
        processed_events 
      CASCADE;
    `);
  } finally {
    client.release();
  }
  await runSeed();
  setDatabaseReady(true);
}
