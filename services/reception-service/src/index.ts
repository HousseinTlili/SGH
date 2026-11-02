import { app } from "./app.js";
import { config } from "./config/index.js";
import { pool, setDatabaseReady } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed } from "./db/seed.js";
import { closeRabbitMQ, initRabbitMQ } from "./events/amqp.js";
import { logger } from "./middleware/logger.js";
import {
  runBackgroundJobsOnce,
  startBackgroundJobs,
  stopBackgroundJobs
} from "./services/verificationJob.js";

const server = app.listen(config.port, () => {
  logger.info(`reception-service listening on port ${config.port}`);
});

// X-8: migrations and seed run in a background loop; data endpoints answer 503 until it succeeds.
async function initDatabase(): Promise<void> {
  const delays = [1000, 2000, 4000, 8000, 16000, 30000];
  for (let attempt = 0; ; attempt++) {
    try {
      await runMigrations();
      if (config.seed) await runSeed();
      setDatabaseReady(true);
      logger.info("Database migrated and seeded, service is ready");
      // The jobs are safe to run at startup (REC-6, REC-9).
      void runBackgroundJobsOnce();
      return;
    } catch (err) {
      const wait = delays[Math.min(attempt, delays.length - 1)];
      logger.warn({ err }, `Database not available yet (X-8), retrying in ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

void initDatabase();
void initRabbitMQ();
startBackgroundJobs();

// Graceful shutdown: stop accepting requests, then release the jobs, the broker and the database.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down reception-service...");

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  stopBackgroundJobs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRabbitMQ();
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export { server };
