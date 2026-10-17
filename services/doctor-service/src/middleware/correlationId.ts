import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const existingId = req.header("X-Correlation-Id");
  const correlationId = existingId || crypto.randomUUID().slice(0, 8);
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}
