import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ServiceStatusService } from '../status/service-status.service';
import { serviceLabel } from '../status/services';
import { toApiError } from './api-error';
import { isApiUrl, isGatewayUrl } from './auth.interceptor';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const snackBar = inject(MatSnackBar);
  const status = inject(ServiceStatusService);
  const notify = (message: string) => snackBar.open(message, 'Dismiss', { duration: 6000 });

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || !isApiUrl(req.url) || isGatewayUrl(req.url)) {
        return throwError(() => err);
      }
      const body = toApiError(err);

      if (err.status === 401) {
        // one silent refresh, then one retry; a second 401 (or a failed refresh) goes back to sign-in
        return from(auth.refresh()).pipe(
          switchMap((ok) => {
            if (!ok) {
              auth.login();
              return throwError(() => err);
            }
            return next(
              req.clone({ setHeaders: { Authorization: `Bearer ${auth.token()}` } }),
            ).pipe(
              catchError((retryErr: unknown) => {
                if (retryErr instanceof HttpErrorResponse && retryErr.status === 401) {
                  auth.login();
                }
                return throwError(() => retryErr);
              }),
            );
          }),
        );
      }
      if (err.status === 503) {
        if (body.service) {
          status.markDown(body.service);
          notify(`${serviceLabel(body.service)} service is unavailable`);
        } else {
          notify('The server is temporarily unavailable');
        }
      } else if (err.status === 403) {
        notify('You are not allowed to do this');
      } else if (err.status === 409) {
        notify(body.message);
      } else if (err.status === 0) {
        notify('Cannot reach the server');
      } else if (err.status >= 500) {
        notify('Something went wrong on the server');
      }
      // 422 is rethrown without a snackbar so the form can map body.details onto its controls
      return throwError(() => err);
    }),
  );
};
