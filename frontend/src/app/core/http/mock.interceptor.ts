import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { isApiUrl } from './auth.interceptor';

/**
 * Mock mode only. The token is always 'mock-token', so the signed-in user is passed to Prism as
 * "Prefer: example=<username>" and GET /api/me answers with that user's profile.
 */
export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  const username = inject(AuthService).user()?.username;
  if (username && isApiUrl(req.url) && req.method === 'GET' && req.url.endsWith('/api/me')) {
    return next(req.clone({ setHeaders: { Prefer: `example=${username}` } }));
  }
  return next(req);
};
