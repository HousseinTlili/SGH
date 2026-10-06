import { HttpParams } from '@angular/common/http';
import type { Paged } from '../../core/models/common';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function emptyPage<T>(size = DEFAULT_PAGE_SIZE): Paged<T> {
  return { content: [], page: 0, size, totalElements: 0, totalPages: 0 };
}

/** page starts at 0, size is 1..100 (API Contracts and Conventions). */
export function clampPaging(page: number, size: number): { page: number; size: number } {
  return {
    page: Math.max(0, Math.floor(page)),
    size: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size))),
  };
}

/** Builds query parameters and leaves out empty values, so filters that are not set are not sent. */
export function toHttpParams(values: Record<string, string | number | boolean | null | undefined>) {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
