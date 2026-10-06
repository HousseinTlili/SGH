import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthBackend, AuthUser } from './auth-backend';

/**
 * Placeholder for the real Keycloak sign-in (keycloak-js, Authorization Code + PKCE), which is
 * built after the backend phases. Until then nobody is signed in and /login explains why.
 */
@Injectable({ providedIn: 'root' })
export class PendingKeycloakBackend implements AuthBackend {
  private readonly router = inject(Router);

  init(): Promise<AuthUser | null> {
    return Promise.resolve(null);
  }

  token(): string {
    return '';
  }

  refresh(): Promise<boolean> {
    return Promise.resolve(false);
  }

  login(): void {
    void this.router.navigateByUrl('/login');
  }

  logout(): void {
    this.login();
  }
}
