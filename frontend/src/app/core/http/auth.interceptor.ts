import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { lastCorrelationId, newCorrelationId } from './correlation';

export function isApiUrl(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

/** /gateway/... endpoints (service status) need no token and must not raise error snackbars. */
export function isGatewayUrl(url: string): boolean {
  return url.startsWith(`${environment.apiBaseUrl}/gateway/`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) {
    return next(req);
  }
  const correlationId = req.headers.get('X-Correlation-Id') ?? newCorrelationId();
  lastCorrelationId.set(correlationId);
  let headers = req.headers.set('X-Correlation-Id', correlationId);
  if (!isGatewayUrl(req.url)) {
    headers = headers.set('Authorization', `Bearer ${inject(AuthService).token()}`);
  }
  return next(req.clone({ headers }));
};
