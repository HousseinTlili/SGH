import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, type Subscription, catchError, exhaustMap, tap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ServiceName } from '../models/common';
import { SERVICES } from './services';

export type ServiceState = 'UP' | 'DOWN' | 'UNKNOWN';
export type ServiceStates = Record<ServiceName, ServiceState>;

interface GatewayHealth {
  gateway: string;
  services: Partial<Record<ServiceName, string>>;
  checkedAt?: string;
}

function allUnknown(): ServiceStates {
  return Object.fromEntries(SERVICES.map((s) => [s, 'UNKNOWN'])) as ServiceStates;
}

function toState(value: string | undefined): ServiceState {
  return value === 'UP' ? 'UP' : value === 'DOWN' ? 'DOWN' : 'UNKNOWN';
}

/** Polls GET /gateway/health/services and tracks 503s: the visual proof of resilience. */
@Injectable({ providedIn: 'root' })
export class ServiceStatusService {
  private readonly http = inject(HttpClient);
  private polling: Subscription | null = null;

  readonly state = signal<ServiceStates>(allUnknown());
  readonly gateway = signal<ServiceState>('UNKNOWN');
  readonly lastChecked = signal<Date | null>(null);

  /** Starts polling; calling it twice does nothing. */
  start(): void {
    if (this.polling) {
      return;
    }
    this.polling = timer(0, environment.statusPollMs)
      .pipe(exhaustMap(() => this.check()))
      .subscribe();
  }

  stop(): void {
    this.polling?.unsubscribe();
    this.polling = null;
  }

  /** One immediate check, used by the Retry button. */
  refresh(): void {
    this.check().subscribe();
  }

  /** Called after a 503: the next poll may put it back to UP. */
  markDown(service: ServiceName): void {
    this.state.update((s) => ({ ...s, [service]: 'DOWN' }));
  }

  /** UNKNOWN counts as up so the UI does not flash while the first poll is running. */
  isUp(service: ServiceName): boolean {
    return this.state()[service] !== 'DOWN';
  }

  private check() {
    return this.http.get<GatewayHealth>(`${environment.apiBaseUrl}/gateway/health/services`).pipe(
      tap((health) => {
        this.state.set(
          Object.fromEntries(
            SERVICES.map((s) => [s, toState(health.services[s])]),
          ) as ServiceStates,
        );
        this.gateway.set(toState(health.gateway));
        this.lastChecked.set(new Date());
      }),
      catchError(() => {
        this.state.set(allUnknown());
        this.gateway.set('DOWN');
        this.lastChecked.set(new Date());
        return EMPTY;
      }),
    );
  }
}
