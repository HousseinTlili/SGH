import { Request, Response, NextFunction } from "express";
import { ApiError, sendError } from "../http/errors.js";
import { logger } from "./logger.js";

// Connection-level failures from pg: the database went away after startup (X-8).
const DB_DOWN_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57P01", "57P02", "57P03"]);

function isDatabaseDown(err: any): boolean {
  return (
    DB_DOWN_CODES.has(err?.code) ||
    /timeout exceeded when trying to connect|Connection terminated|the database system is/i.test(
      err?.message ?? ""
    )
  );
}

/** Unknown routes answer in the shared error body instead of Express' HTML page. */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(req, res, new ApiError(404, `No route for ${req.method} ${req.path}`));
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    sendError(req, res, err);
    return;
  }

  // Body-parser failures (malformed JSON, payload too large) carry a 4xx status and a safe message.
  if (err?.type === "entity.parse.failed") {
    sendError(req, res, new ApiError(400, "Malformed JSON body"));
    return;
  }
  if (err?.type === "entity.too.large") {
    sendError(req, res, new ApiError(413, "Request body too large"));
    return;
  }

  // Two requests racing past an application-level duplicate check end up here: still a conflict, not a 500.
  if (err?.code === "23505") {
    sendError(req, res, new ApiError(409, "Resource already exists"));
    return;
  }

  // A foreign key that points nowhere is a client mistake, not a server fault.
  if (err?.code === "23503") {
    sendError(
      req,
      res,
      new ApiError(422, "Validation failed", [
        { field: "reference", problem: "refers to a resource that does not exist" }
      ])
    );
    return;
  }

  if (isDatabaseDown(err)) {
    logger.warn({ err, correlationId: req.correlationId }, "Database unavailable during request");
    sendError(req, res, new ApiError(503, "Database unavailable"));
    return;
  }

  // Never echo internal messages (SQL, stack details) to clients.
  logger.error({ err, correlationId: req.correlationId }, "Unhandled error");
  sendError(req, res, new ApiError(500, "Internal server error"));
}
