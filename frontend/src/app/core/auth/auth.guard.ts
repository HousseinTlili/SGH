import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { Role } from '../models/common';
import { AuthService } from './auth.service';

/** Anyone signed in. Others go to /login. */
export const authenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

/**
 * Hides navigation by role. It never replaces the server-side checks.
 * A signed-in user without a matching role is sent to /forbidden.
 */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    return auth.hasRole(...roles) ? true : router.createUrlTree(['/forbidden']);
  };
}
