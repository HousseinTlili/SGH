import { Request, Response, NextFunction } from "express";
import { getDatabaseReady } from "../db/pool.js";

export function dbReadyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow /health and swagger docs without db
  if (
    req.path === "/health" ||
    req.path === "/openapi.json" ||
    req.path.startsWith("/docs")
  ) {
    return next();
  }

  if (!getDatabaseReady()) {
    res.status(503).json({
      timestamp: new Date().toISOString(),
      status: 503,
      error: "Service Unavailable",
      message: "Database unavailable",
      path: req.originalUrl || req.url,
      correlationId: req.correlationId
    });
    return;
  }

  next();
}
