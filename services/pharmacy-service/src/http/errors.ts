import { Request, Response } from "express";
import { z } from "zod";

export interface ErrorDetail {
  field: string;
  problem: string;
}

const REASONS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  503: "Service Unavailable"
};

/** An error that maps directly to the structured error body from API Contracts. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: ErrorDetail[]
  ) {
    super(message);
    this.name = "ApiError";
  }

  get reason(): string {
    return REASONS[this.status] ?? "Error";
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new ApiError(400, message, details);
export const unauthorized = () => new ApiError(401, "Missing or invalid token");
export const forbidden = (message = "Your role is not allowed to do this") =>
  new ApiError(403, message);
export const notFound = (message: string) => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
export const validationFailed = (details: ErrorDetail[]) =>
  new ApiError(422, "Validation failed", details);

export function sendError(req: Request, res: Response, err: ApiError): void {
  res.status(err.status).json({
    timestamp: new Date().toISOString(),
    status: err.status,
    error: err.reason,
    message: err.message,
    path: req.originalUrl || req.url,
    correlationId: req.correlationId,
    ...(err.details ? { details: err.details } : {})
  });
}

export function zodDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    problem: issue.message
  }));
}

/** Parses `data` or throws a 422 with one detail per failing field. */
export function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw validationFailed(zodDetails(result.error));
  return result.data;
}

const uuidSchema = z.string().uuid();

export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

/** A path id of the wrong type is a 400 (Stack Templates), not a Postgres cast error. */
export function uuidParam(value: string | undefined, name = "id"): string {
  if (!isUuid(value)) {
    throw badRequest(`Parameter '${name}' must be a valid UUID`, [
      { field: name, problem: "must be a valid UUID" }
    ]);
  }
  return value;
}

/** Query filters of the wrong type are a 400 as well; every offending field is listed. */
export function parseQueryOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  query: unknown
): z.infer<S> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw badRequest("Invalid query parameter", zodDetails(result.error));
  }
  return result.data;
}

export interface Paging {
  page: number;
  size: number;
  offset: number;
}

/**
 * `?page=0&size=20`. Missing values use the defaults, out-of-range values are clamped
 * (page >= 0, 1 <= size <= 100) and non-numeric values are a 400.
 */
export function parsePaging(query: Request["query"]): Paging {
  const toInt = (name: string, raw: unknown, fallback: number) => {
    if (raw === undefined || raw === "") return fallback;
    if (typeof raw !== "string" || !/^-?\d+$/.test(raw)) {
      throw badRequest(`Parameter '${name}' must be an integer`, [
        { field: name, problem: "must be an integer" }
      ]);
    }
    return Number.parseInt(raw, 10);
  };
  const page = Math.max(0, toInt("page", query.page, 0));
  const size = Math.min(100, Math.max(1, toInt("size", query.size, 20)));
  return { page, size, offset: page * size };
}

export function pageOf<T>(content: T[], totalElements: number, paging: Paging) {
  return {
    content,
    page: paging.page,
    size: paging.size,
    totalElements,
    totalPages: Math.ceil(totalElements / paging.size)
  };
}
