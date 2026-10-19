import { app } from "./app.js";
import { config } from "./config/index.js";
import { setDatabaseReady, checkDatabaseConnection } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed } from "./db/seed.js";
import { initRabbitMQ } from "./events/amqp.js";
import { logger } from "./middleware/logger.js";
import { runPatientReverificationJob, runMockRemindersJob } from "./services/verificationJob.js";

const server = app.listen(config.port, () => {
  logger.info(`reception-service listening on port ${config.port}`);
});

// Background DB retry loop (X-8)
async function initDatabase(): Promise<void> {
  const delays = [1000, 2000, 4000, 8000, 16000, 30000];
  let delayIndex = 0;

  while (true) {
    try {
      const connected = await checkDatabaseConnection();
      if (connected) {
        logger.info("Connected to PostgreSQL, running migrations...");
        await runMigrations();
        logger.info("Migrations completed successfully");

        if (config.seed) {
          logger.info("Running seed...");
          await runSeed();
          logger.info("Seed completed successfully");
        }

        setDatabaseReady(true);
        logger.info("Database is READY");
        break;
      }
    } catch (err) {
      logger.warn({ err }, "Database init failed, retrying...");
    }

    const waitMs = delays[Math.min(delayIndex, delays.length - 1)];
    delayIndex++;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

initDatabase().catch((err) => {
  logger.error({ err }, "Fatal error in database init loop");
});

// RabbitMQ initialization
initRabbitMQ().catch((err) => {
  logger.error({ err }, "Fatal error in RabbitMQ init");
});

// Periodic background jobs (every 60s)
setInterval(async () => {
  try {
    await runPatientReverificationJob();
    await runMockRemindersJob();
  } catch (err) {
    logger.error({ err }, "Error running scheduled jobs");
  }
}, 60000);

export { server };
