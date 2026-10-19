import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error({ err, path: req.url, correlationId: req.correlationId }, "Request error");

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      problem: e.message
    }));

    res.status(422).json({
      timestamp: new Date().toISOString(),
      status: 422,
      error: "Unprocessable Entity",
      message: "Validation failed",
      path: req.originalUrl || req.url,
      correlationId: req.correlationId,
      details
    });
    return;
  }

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: status === 404 ? "Not Found" : status === 409 ? "Conflict" : status === 403 ? "Forbidden" : status === 422 ? "Unprocessable Entity" : "Internal Server Error",
    message,
    path: req.originalUrl || req.url,
    correlationId: req.correlationId,
    details: err.details
  });
}
