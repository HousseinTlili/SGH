import { Router } from "express";
import { authenticateToken } from "../auth/jwt.js";
import { requireRoles } from "../auth/roles.js";

export const stubRouter = Router();

stubRouter.get(
  "/api/_stub/ping",
  authenticateToken,
  requireRoles("ADMIN"),
  (req, res) => {
    res.status(200).json({
      service: "consultation",
      user: req.user?.username || "admin"
    });
  }
);
