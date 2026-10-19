import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";
import { logger } from "../middleware/logger.js";

// Same relative path from src/db (tsx) and dist/db (compiled): the service root.
const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../migrations");

// Arbitrary constant: serialises runners so two instances cannot apply a file twice.
const MIGRATION_LOCK_ID = 83_001;

/** Applies `migrations/*.sql` in filename order, each in its own transaction, once. */
export async function runMigrations(): Promise<void> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const applied = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename)
    );

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        logger.info({ file }, "Applied migration");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
