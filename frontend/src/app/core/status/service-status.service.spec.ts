import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ServiceStatusService } from './service-status.service';

const URL = `${environment.apiBaseUrl}/gateway/health/services`;

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    status: TestBed.inject(ServiceStatusService),
    ctrl: TestBed.inject(HttpTestingController),
  };
}

describe('ServiceStatusService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with every service UNKNOWN, which counts as up so the UI does not flash', () => {
    const { status } = setup();
    expect(Object.values(status.state()).every((s) => s === 'UNKNOWN')).toBe(true);
    expect(status.isUp('lab')).toBe(true);
  });

  it('refresh reads GET /gateway/health/services', () => {
    const { status, ctrl } = setup();
    status.refresh();
    ctrl.expectOne(URL).flush({
      gateway: 'UP',
      services: {
        patient: 'UP',
        reception: 'UP',
        consultation: 'DOWN',
        lab: 'UP',
        pharmacy: 'UP',
        staff: 'UP',
      },
      checkedAt: '2026-10-12T09:30:00Z',
    });
    expect(status.state().consultation).toBe('DOWN');
    expect(status.isUp('consultation')).toBe(false);
    expect(status.isUp('patient')).toBe(true);
    expect(status.gateway()).toBe('UP');
    expect(status.lastChecked()).not.toBeNull();
  });

  it('a failed poll marks every service UNKNOWN and the gateway DOWN', () => {
    const { status, ctrl } = setup();
    status.markDown('lab');
    status.refresh();
    ctrl.expectOne(URL).error(new ProgressEvent('error'));
    expect(Object.values(status.state()).every((s) => s === 'UNKNOWN')).toBe(true);
    expect(status.gateway()).toBe('DOWN');
  });

  it('markDown sets one service DOWN at once and the next poll can bring it back', () => {
    const { status, ctrl } = setup();
    status.markDown('pharmacy');
    expect(status.state().pharmacy).toBe('DOWN');
    expect(status.isUp('pharmacy')).toBe(false);
    status.refresh();
    ctrl.expectOne(URL).flush({
      gateway: 'UP',
      services: {
        patient: 'UP',
        reception: 'UP',
        consultation: 'UP',
        lab: 'UP',
        pharmacy: 'UP',
        staff: 'UP',
      },
    });
    expect(status.isUp('pharmacy')).toBe(true);
  });

  it('start polls at once and then every statusPollMs, never twice in parallel', () => {
    vi.useFakeTimers();
    const { status, ctrl } = setup();
    status.start();
    status.start(); // second call must not add a second poller
    vi.advanceTimersByTime(1);
    ctrl.expectOne(URL).flush({ gateway: 'UP', services: {} });
    vi.advanceTimersByTime(environment.statusPollMs);
    ctrl.expectOne(URL).flush({ gateway: 'UP', services: {} });
    status.stop();
    vi.advanceTimersByTime(environment.statusPollMs * 2);
    ctrl.expectNone(URL);
  });
});
