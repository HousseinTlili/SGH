import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config/index.js";

const SGH_ROLES = [
  "PATIENT",
  "DOCTOR",
  "NURSE",
  "LAB_TECHNICIAN",
  "PHARMACIST",
  "RECEPTIONIST",
  "ADMIN"
] as const;

export type SghRole = (typeof SGH_ROLES)[number];

export interface AuthUser {
  username: string;
  roles: SghRole[];
  staffId: string | null;
  patientId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.keycloakJwksUri));
  }
  return jwks;
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
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

  const token = authHeader.substring(7).trim();
  req.token = token;

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: config.keycloakIssuer
    });

    const realmAccess = (payload.realm_access as { roles?: string[] }) || {};
    const rawRoles = realmAccess.roles || [];
    const filteredRoles = rawRoles.filter((r): r is SghRole =>
      SGH_ROLES.includes(r as SghRole)
    );

    const staffId = (payload.staffId as string) || null;
    const patientId = (payload.patientId as string) || null;
    const username =
      (payload.preferred_username as string) ||
      (payload.sub as string) ||
      "unknown";

    req.user = {
      username,
      roles: filteredRoles,
      staffId,
      patientId
    };

    next();
  } catch (err) {
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
}
