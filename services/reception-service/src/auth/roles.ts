import { Request, Response, NextFunction } from "express";
import { SghRole } from "./jwt.js";

export function requireRoles(...allowedRoles: SghRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        timestamp: new Date().toISOString(),
        status: 401,
        error: "Unauthorized",
        message: "Missing or invalid token",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      res.status(403).json({
        timestamp: new Date().toISOString(),
        status: 403,
        error: "Forbidden",
        message: "Your role is not allowed to do this",
        path: req.originalUrl || req.url,
        correlationId: req.correlationId
      });
      return;
    }

    next();
  };
}
