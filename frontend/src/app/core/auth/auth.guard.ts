import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { Role } from '../models/common';
import { AuthService } from './auth.service';

/** Anyone signed in. Others go to /login, keeping the page they wanted. */
export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url || '/' },
  });
};

/**
 * Hides navigation by role. It never replaces the server-side checks.
 * A signed-in user without a matching role is sent to /forbidden.
 */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url || '/' },
      });
    }
    return auth.hasRole(...roles) ? true : router.createUrlTree(['/forbidden']);
  };
}
