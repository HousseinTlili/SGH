import pino from "pino";
import { pinoHttp } from "pino-http";
import { config } from "../config/index.js";

export const logger = pino({
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime
});

// One line per request: method, path, status, duration, correlation id and user (X-7: no tokens, no bodies).
export const requestLogger = pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode })
  },
  customProps: (req) => ({
    correlationId: (req as any).correlationId,
    user: (req as any).user?.username ?? "anonymous"
  })
});
