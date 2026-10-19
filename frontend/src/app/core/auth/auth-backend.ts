import { InjectionToken } from '@angular/core';
import type { Role } from '../models/common';

export interface AuthUser {
  username: string;
  roles: Role[];
  staffId?: string;
  patientId?: string;
  fullName?: string;
}

/**
 * What AuthService needs from an identity provider. MockAuthBackend (development without Keycloak) and
 * KeycloakAuthBackend (keycloak-js, authorization code flow with PKCE) implement it.
 */
export interface AuthBackend {
  /** Runs before the app renders. Resolves the current user, or null when nobody is signed in. */
  init(): Promise<AuthUser | null>;
  /** The current access token. */
  token(): string;
  /** One silent refresh attempt. Resolves true when a usable token exists afterwards. */
  refresh(): Promise<boolean>;
  /** Sends the user to the sign-in step. */
  login(): void;
  logout(): void;
}

export const AUTH_BACKEND = new InjectionToken<AuthBackend>('AUTH_BACKEND');
