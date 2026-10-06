import { TestBed } from '@angular/core/testing';
import { AUTH_BACKEND, type AuthBackend } from '../app/core/auth/auth-backend';
import { AuthService } from '../app/core/auth/auth.service';
import { MOCK_USERS } from '../app/core/auth/mock-users';

/** A backend that does nothing but record calls, for tests that only need an AuthService. */
export function fakeAuthBackend(overrides: Partial<AuthBackend> = {}): AuthBackend {
  return {
    init: () => Promise.resolve(null),
    token: () => 'test-token',
    refresh: () => Promise.resolve(true),
    login: () => undefined,
    logout: () => undefined,
    ...overrides,
  };
}

export function provideFakeAuth(overrides: Partial<AuthBackend> = {}) {
  return { provide: AUTH_BACKEND, useValue: fakeAuthBackend(overrides) };
}

/** Signs in one of the eight seeded users (doctor1, reception1, patient1, ...). */
export function signInAs(username: string): void {
  const user = MOCK_USERS.find((u) => u.username === username);
  if (!user) {
    throw new Error(`Unknown test user ${username}`);
  }
  TestBed.inject(AuthService).completeSignIn(user);
}
