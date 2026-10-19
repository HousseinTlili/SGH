import pino from "pino";
import { pinoHttp } from "pino-http";
import { config } from "../config/index.js";

export const logger = pino({
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime
});

export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    correlationId: (req as any).correlationId
  }),
  redact: ["req.headers.authorization"]
});
