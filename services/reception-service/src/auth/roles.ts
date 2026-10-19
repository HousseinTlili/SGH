import { Request, Response, NextFunction } from "express";
import { forbidden, unauthorized } from "../http/errors.js";
import { SghRole } from "./jwt.js";

export function requireRoles(...allowedRoles: SghRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!req.user.roles.some((r) => allowedRoles.includes(r))) {
      next(forbidden());
      return;
    }
    next();
  };
}

export function requireDoctorWithStaffId(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.roles.includes("DOCTOR")) {
    next(forbidden());
    return;
  }
  if (!req.user.staffId) {
    next(forbidden("DOCTOR token missing staffId claim"));
    return;
  }
  next();
}
