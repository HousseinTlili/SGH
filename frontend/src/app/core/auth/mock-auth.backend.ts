import { Injectable, InjectionToken, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import type { AuthBackend, AuthUser } from './auth-backend';
import { MOCK_USERS } from './mock-users';

const STORAGE_KEY = 'sgh.mock.user';

/** True when the app was built for mock mode (fake sign-in, no Keycloak). Tests can override it. */
export const MOCK_AUTH_ENABLED = new InjectionToken<boolean>('MOCK_AUTH_ENABLED', {
  providedIn: 'root',
  factory: () => environment.mockAuth,
});

/** Fake sign-in for development without Keycloak. The token is always the fixed string 'mock-token'. */
@Injectable({ providedIn: 'root' })
export class MockAuthBackend implements AuthBackend {
  private readonly router = inject(Router);

  init(): Promise<AuthUser | null> {
    return Promise.resolve(this.restore());
  }

  token(): string {
    return 'mock-token';
  }

  refresh(): Promise<boolean> {
    return Promise.resolve(true);
  }

  login(): void {
    void this.router.navigateByUrl('/login');
  }

  logout(): void {
    this.write(null);
    this.login();
  }

  /** Picks one of the seeded users and remembers the choice for this browser tab. */
  signIn(username: string): AuthUser {
    const user = MOCK_USERS.find((u) => u.username === username);
    if (!user) {
      throw new Error(`Unknown mock user: ${username}`);
    }
    this.write(user.username);
    return user;
  }

  private restore(): AuthUser | null {
    try {
      const username = sessionStorage.getItem(STORAGE_KEY);
      return MOCK_USERS.find((u) => u.username === username) ?? null;
    } catch {
      return null;
    }
  }

  private write(username: string | null): void {
    try {
      if (username) {
        sessionStorage.setItem(STORAGE_KEY, username);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage can be blocked; the session then simply does not survive a reload
    }
  }
}
