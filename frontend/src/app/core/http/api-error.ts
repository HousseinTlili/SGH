import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '../models/common';

function isApiErrorBody(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ApiError).status === 'number' &&
    typeof (body as ApiError).message === 'string'
  );
}

/** Normalises any failed HTTP call into the shared error body, keeping the correlation id. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    if (isApiErrorBody(err.error)) {
      return err.error;
    }
    return {
      status: err.status,
      error: err.statusText || 'Error',
      message: err.status === 0 ? 'Cannot reach the server' : err.message,
      correlationId: err.headers?.get('X-Correlation-Id') ?? undefined,
    };
  }
  return {
    status: 0,
    error: 'Error',
    message: err instanceof Error ? err.message : 'Unexpected error',
  };
}
