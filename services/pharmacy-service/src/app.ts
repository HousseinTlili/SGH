import express from "express";
import { correlationIdMiddleware } from "./middleware/correlationId.js";
import { requestLogger } from "./middleware/logger.js";
import { dbReadyMiddleware } from "./middleware/dbReady.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { docsRouter } from "./routes/docs.js";
import { drugsRouter } from "./routes/drugs.js";
import { prescriptionsRouter } from "./routes/prescriptions.js";

export const app = express();

// The correlation id comes first so even a body-parser error carries it.
app.use(correlationIdMiddleware);
app.use(express.json());
app.use(requestLogger);

// Non-database routes
app.use(healthRouter);
app.use(docsRouter);

// DB readiness check for all remaining endpoints (X-8)
app.use(dbReadyMiddleware);

// API routes
app.use(drugsRouter);
app.use(prescriptionsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
