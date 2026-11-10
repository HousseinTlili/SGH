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
 * Real sign-in: Keycloak realm `sgh`, public client `sgh-frontend`.
 * Supports both:
 * 1. Direct Access Grant flow (custom in-app Angular login with username & password)
 * 2. Authorization Code flow with PKCE (standard Keycloak redirect SSO)
 */
@Injectable({ providedIn: 'root' })
export class KeycloakAuthBackend implements AuthBackend {
  private readonly keycloak = inject(KEYCLOAK_CLIENT);
  private directAccessToken = '';
  private directRefreshToken = '';

  async init(): Promise<AuthUser | null> {
    // 1. Check for stored Direct Grant session in sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const storedAccess = sessionStorage.getItem('sgh_access_token');
      const storedRefresh = sessionStorage.getItem('sgh_refresh_token');
      if (storedAccess) {
        const user = this.parseToken(storedAccess);
        if (user && !this.isTokenExpired(storedAccess)) {
          this.directAccessToken = storedAccess;
          this.directRefreshToken = storedRefresh ?? '';
          return user;
        } else if (storedRefresh) {
          this.directRefreshToken = storedRefresh;
          const refreshed = await this.refresh();
          if (refreshed) {
            return this.parseToken(this.directAccessToken);
          }
        }
      }
    }

    // 2. Fall back to standard keycloak check-sso if no direct session
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
    return this.directAccessToken || this.keycloak.token || '';
  }

  async refresh(): Promise<boolean> {
    if (this.directRefreshToken) {
      try {
        const tokenUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/protocol/openid-connect/token`;
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: environment.keycloak.clientId,
          refresh_token: this.directRefreshToken,
        });
        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            access_token: string;
            refresh_token?: string;
          };
          this.directAccessToken = data.access_token;
          if (data.refresh_token) {
            this.directRefreshToken = data.refresh_token;
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('sgh_access_token', this.directAccessToken);
            sessionStorage.setItem('sgh_refresh_token', this.directRefreshToken);
          }
          return true;
        }
      } catch {
        return false;
      }
    }

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
    if (this.directRefreshToken) {
      const logoutUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/protocol/openid-connect/logout`;
      const body = new URLSearchParams({
        client_id: environment.keycloak.clientId,
        refresh_token: this.directRefreshToken,
      });
      void fetch(logoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }).catch(() => undefined);
    }
    this.directAccessToken = '';
    this.directRefreshToken = '';
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('sgh_access_token');
      sessionStorage.removeItem('sgh_refresh_token');
    }
    if (this.keycloak.authenticated) {
      void this.keycloak.logout({ redirectUri: `${window.location.origin}/login` });
    } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  /**
   * Direct credentials login via Keycloak Direct Access Grant (ROPC).
   * Authenticates directly on Keycloak's token endpoint without any browser redirect.
   */
  async loginWithCredentials(username: string, password = 'Sgh@dev2026'): Promise<AuthUser> {
    const tokenUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: environment.keycloak.clientId,
      username,
      password,
      scope: 'openid profile email',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as {
        error_description?: string;
      };
      const msg = errData.error_description || 'Invalid credentials or login failed';
      throw new Error(msg);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
    };
    this.directAccessToken = data.access_token;
    this.directRefreshToken = data.refresh_token ?? '';

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('sgh_access_token', this.directAccessToken);
      sessionStorage.setItem('sgh_refresh_token', this.directRefreshToken);
    }

    const user = this.parseToken(data.access_token);
    if (!user) {
      throw new Error('Unable to parse token claims');
    }
    return user;
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

  private parseToken(token: string): AuthUser | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(escape(atob(base64)))) as Record<
        string,
        unknown
      > & { realm_access?: { roles?: string[] } };

      const text = (value: unknown): string | undefined =>
        typeof value === 'string' && value !== '' ? value : undefined;
      const fullName =
        text(payload['name']) ??
        [text(payload['given_name']), text(payload['family_name'])].filter(Boolean).join(' ');
      return {
        username: text(payload['preferred_username']) ?? text(payload['sub']) ?? 'unknown',
        roles: onlySghRoles(payload.realm_access?.roles ?? []),
        staffId: text(payload['staffId']),
        patientId: text(payload['patientId']),
        fullName: fullName || undefined,
      };
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(escape(atob(base64)))) as {
        exp?: number;
      };
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000 - 30000;
    } catch {
      return true;
    }
  }
}
