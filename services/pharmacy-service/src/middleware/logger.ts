import { Request, Response, NextFunction } from "express";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info"
});

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      correlationId: req.correlationId
    });
  });
  next();
}
