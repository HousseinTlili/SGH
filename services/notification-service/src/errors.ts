import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export type Detail = { field: string; problem: string };

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Detail[]) {
    super(message);
  }
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export function correlation(req: Request, res: Response, next: NextFunction) {
  const id = req.header('X-Correlation-Id') ?? randomUUID();
  res.locals.correlationId = id;
  res.setHeader('X-Correlation-Id', id);
  next();
}

export function sendError(req: Request, res: Response, status: number, message: string, details?: Detail[]) {
  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: STATUS_TEXT[status] ?? 'Error',
    message,
    path: req.originalUrl,
    correlationId: res.locals.correlationId,
    ...(details ? { details } : {}),
  });
}

export function notFound(req: Request, res: Response) {
  sendError(req, res, 404, 'Route not found');
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return sendError(req, res, err.status, err.message, err.details);
  if (err?.type === 'entity.parse.failed') return sendError(req, res, 400, 'Invalid JSON body');
  const code: string = String(err?.code ?? '');
  if (code.startsWith('ECONN') || code.startsWith('08') || code.startsWith('57P') || code === 'ENOTFOUND') {
    return sendError(req, res, 503, 'Database unavailable');
  }
  console.error(err);
  return sendError(req, res, 500, 'Internal server error');
}
