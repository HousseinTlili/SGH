import { Injectable, InjectionToken, inject } from '@angular/core';
import Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';
import type { AuthBackend, AuthUser } from './auth-backend';
import { onlySghRoles } from './roles';

/** The part of the keycloak-js instance this app uses; tests provide a fake. */
export type KeycloakClient = Pick<
  Keycloak,
  'init' | 'login' | 'logout' | 'updateToken' | 'token' | 'tokenParsed' | 'authenticated'
> & { onTokenExpired?: () => void };

export const KEYCLOAK_CLIENT = new InjectionToken<KeycloakClient>('KEYCLOAK_CLIENT', {
  providedIn: 'root',
  factory: () => new Keycloak(environment.keycloak),
});

/**
 * Real sign-in: Keycloak realm `sgh`, public client `sgh-frontend`, authorization code flow with PKCE.
 * The access token carries the roles (realm_access.roles) and the staffId / patientId claims.
 */
@Injectable({ providedIn: 'root' })
export class KeycloakAuthBackend implements AuthBackend {
  private readonly keycloak = inject(KEYCLOAK_CLIENT);

  async init(): Promise<AuthUser | null> {
    try {
      const authenticated = await this.keycloak.init({
        // Looks for an existing Keycloak session in a hidden frame, so a reload keeps the user signed in.
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: 'S256',
        checkLoginIframe: false,
      });
      // Refresh in the background before the token runs out; a failure surfaces as a 401 and a new sign-in.
      this.keycloak.onTokenExpired = () => {
        void this.keycloak.updateToken(30).catch(() => undefined);
      };
      return authenticated ? this.currentUser() : null;
    } catch {
      // Keycloak is down: the app still renders and the sign-in page lets the user try again later.
      return null;
    }
  }

  token(): string {
    return this.keycloak.token ?? '';
  }

  async refresh(): Promise<boolean> {
    try {
      await this.keycloak.updateToken(30);
      return !!this.keycloak.token;
    } catch {
      return false;
    }
  }

  login(): void {
    void this.keycloak.login({ redirectUri: `${window.location.origin}/` });
  }

  logout(): void {
    void this.keycloak.logout({ redirectUri: `${window.location.origin}/login` });
  }

  private currentUser(): AuthUser | null {
    const claims = this.keycloak.tokenParsed as
      (Record<string, unknown> & { realm_access?: { roles?: string[] } }) | undefined;
    if (!claims) {
      return null;
    }
    const text = (value: unknown): string | undefined =>
      typeof value === 'string' && value !== '' ? value : undefined;
    const fullName =
      text(claims['name']) ??
      [text(claims['given_name']), text(claims['family_name'])].filter(Boolean).join(' ');
    return {
      username: text(claims['preferred_username']) ?? text(claims['sub']) ?? 'unknown',
      roles: onlySghRoles(claims.realm_access?.roles ?? []),
      staffId: text(claims['staffId']),
      patientId: text(claims['patientId']),
      fullName: fullName || undefined,
    };
  }
}
