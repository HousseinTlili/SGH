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
  const correlationId =
    req.header("X-Correlation-Id") || crypto.randomUUID().substring(0, 8);
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}
