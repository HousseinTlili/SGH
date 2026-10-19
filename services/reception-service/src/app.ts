import express from "express";
import { correlationIdMiddleware } from "./middleware/correlationId.js";
import { requestLogger } from "./middleware/logger.js";
import { dbReadyMiddleware } from "./middleware/dbReady.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { docsRouter } from "./routes/docs.js";
import { stubRouter } from "./routes/stub.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { invoicesRouter } from "./routes/invoices.js";

export const app = express();

app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Non-database routes
app.use(healthRouter);
app.use(docsRouter);

// DB readiness check for all remaining endpoints (X-8)
app.use(dbReadyMiddleware);

// API routes
app.use(stubRouter);
app.use(appointmentsRouter);
app.use(invoicesRouter);

// Global error handler
app.use(errorHandler);
