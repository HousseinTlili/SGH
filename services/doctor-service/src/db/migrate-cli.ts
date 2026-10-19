import { pool } from "./pool.js";
import { runMigrations } from "./migrate.js";

try {
  await runMigrations();
} finally {
  await pool.end();
}
