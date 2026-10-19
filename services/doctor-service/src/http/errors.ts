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

/**
 * Path ids that are not UUIDs cannot match any row, so they answer 404 instead of
 * letting Postgres reject the cast with a 500.
 */
export function uuidParam(value: string | undefined, what: string): string {
  if (!isUuid(value)) throw notFound(`${what} not found`);
  return value;
}

export interface Paging {
  page: number;
  size: number;
  offset: number;
}

/** `?page=0&size=20`, size capped at 100. Missing or non-numeric values fall back to the defaults. */
export function parsePaging(query: Request["query"]): Paging {
  const toInt = (raw: unknown, fallback: number) => {
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const page = Math.max(0, toInt(query.page, 0));
  const size = Math.min(100, Math.max(1, toInt(query.size, 20)));
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
