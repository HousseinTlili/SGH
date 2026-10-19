import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../middleware/logger.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 3000
});

// An idle client can error when Postgres restarts. Without a listener Node treats it as an
// uncaught exception and the whole service dies, which would break X-6/X-8.
pool.on("error", (err) => {
  logger.warn({ err }, "Idle PostgreSQL client error");
});

let isDatabaseReady = false;

export function setDatabaseReady(ready: boolean) {
  isDatabaseReady = ready;
}

export function getDatabaseReady(): boolean {
  return isDatabaseReady;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

/** Runs `work` in a transaction on one client; rolls back and rethrows on failure. */
export async function withTransaction<T>(
  work: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
