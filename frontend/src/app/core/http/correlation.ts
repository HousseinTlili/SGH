import { signal } from '@angular/core';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 8 random characters, as the contracts ask for X-Correlation-Id. */
export function newCorrelationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** The id of the last request sent, so error screens can show a 'Reference' line. */
export const lastCorrelationId = signal<string | null>(null);
