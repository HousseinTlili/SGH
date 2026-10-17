import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error({ err, correlationId: req.correlationId }, "Unhandled error");

  const status = typeof err.status === "number" ? err.status : 500;
  const message = err.message || "Internal Server Error";
  const error = err.name || "Error";

  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error,
    message,
    path: req.originalUrl || req.url,
    correlationId: req.correlationId,
    details: err.details
  });
}
