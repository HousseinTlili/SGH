import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';
import { AUTH_BACKEND } from './core/auth/auth-backend';
import { AuthService } from './core/auth/auth.service';
import { MockAuthBackend } from './core/auth/mock-auth.backend';
import { PendingKeycloakBackend } from './core/auth/pending-keycloak.backend';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { mockInterceptor } from './core/http/mock.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        ...(environment.mockAuth ? [mockInterceptor] : []),
        errorInterceptor,
      ]),
    ),
    {
      provide: AUTH_BACKEND,
      useExisting: environment.mockAuth ? MockAuthBackend : PendingKeycloakBackend,
    },
    // the app does not render before the sign-in state is known
    provideAppInitializer(() => inject(AuthService).init()),
  ],
};
