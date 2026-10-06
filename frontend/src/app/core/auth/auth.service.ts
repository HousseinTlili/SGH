import { Injectable, computed, inject, signal } from '@angular/core';
import type { Role } from '../models/common';
import { AUTH_BACKEND, type AuthUser } from './auth-backend';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly backend = inject(AUTH_BACKEND);
  private readonly current = signal<AuthUser | null>(null);

  readonly user = this.current.asReadonly();
  readonly roles = computed<Role[]>(() => this.current()?.roles ?? []);
  readonly isAuthenticated = computed(() => this.current() !== null);

  /** App initializer: resolves before the first render. */
  async init(): Promise<void> {
    this.current.set(await this.backend.init());
  }

  /** Called by the sign-in screen once the backend accepted a user. */
  completeSignIn(user: AuthUser): void {
    this.current.set(user);
  }

  token(): string {
    return this.backend.token();
  }

  refresh(): Promise<boolean> {
    return this.backend.refresh();
  }

  hasRole(...roles: Role[]): boolean {
    const mine = this.roles();
    return roles.some((r) => mine.includes(r));
  }

  login(): void {
    this.backend.login();
  }

  logout(): void {
    this.current.set(null);
    this.backend.logout();
  }
}
