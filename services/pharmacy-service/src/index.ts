import { app } from "./app.js";
import { config } from "./config/index.js";
import { setDatabaseReady } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed } from "./db/seed.js";
import { initRabbitMQ } from "./events/amqp.js";
import { logger } from "./middleware/logger.js";

const server = app.listen(config.port, () => {
  logger.info(`Pharmacy service listening on port ${config.port}`);
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

// Graceful shutdown
function shutdown() {
  logger.info("Shutting down pharmacy-service...");
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
