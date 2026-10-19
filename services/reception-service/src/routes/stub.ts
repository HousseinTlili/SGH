import { Router, Request, Response } from "express";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";

export const stubRouter = Router();

stubRouter.get(
  "/api/_stub/ping",
  authenticateToken,
  requireRoles("ADMIN"),
  (req: Request, res: Response) => {
    res.json({
      service: "reception",
      user: req.user?.username || "unknown"
    });
  }
);
