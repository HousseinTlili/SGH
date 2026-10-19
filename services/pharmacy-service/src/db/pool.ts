import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 3000
});

let isDatabaseReady = false;

export function setDatabaseReady(ready: boolean): void {
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
