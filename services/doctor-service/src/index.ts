import { app } from "./app.js";
import { config } from "./config/index.js";
import { pool, setDatabaseReady } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed } from "./db/seed.js";
import { closeRabbitMQ, initRabbitMQ } from "./events/amqp.js";
import { logger } from "./middleware/logger.js";

const server = app.listen(config.port, () => {
  logger.info(`Doctor service listening on port ${config.port}`);
});

// Background loop for database migrations and seeding (Rule X-8)
async function initDatabaseWithRetry() {
  const retryIntervals = [1000, 2000, 4000, 8000, 16000, 30000];
  let attempt = 0;

  while (true) {
    try {
      logger.info("Attempting database migrations and seeding...");
      await runMigrations();
      if (config.seed) {
        await runSeed();
      }
      setDatabaseReady(true);
      logger.info("Database migrations and seeding complete. Service is ready.");
      break;
    } catch (err) {
      const delay =
        retryIntervals[Math.min(attempt, retryIntervals.length - 1)];
      logger.warn(
        { err },
        `Database not available yet (X-8). Retrying in ${delay / 1000}s...`
      );
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Start background initializations
initDatabaseWithRetry();
initRabbitMQ();

// Graceful shutdown: stop accepting requests, then release the broker and the database.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down doctor-service...");

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRabbitMQ();
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
