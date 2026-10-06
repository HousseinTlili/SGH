import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { provideFakeAuth, signInAs } from '../../../testing/auth';
import { ServiceStatusService } from '../status/service-status.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { mockInterceptor } from './mock.interceptor';

const API = `${environment.apiBaseUrl}/api`;

function setup(authOverrides: Parameters<typeof provideFakeAuth>[0] = {}) {
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor, mockInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
      provideFakeAuth(authOverrides),
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    ctrl: TestBed.inject(HttpTestingController),
    status: TestBed.inject(ServiceStatusService),
    snackBar,
  };
}

describe('authInterceptor', () => {
  it('adds the bearer token and an 8 character correlation id to gateway calls', () => {
    const { http, ctrl } = setup();
    http.get(`${API}/patients`).subscribe();
    const req = ctrl.expectOne(`${API}/patients`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(req.request.headers.get('X-Correlation-Id')).toMatch(/^[a-z0-9]{8}$/);
  });

  it('keeps a correlation id that is already set', () => {
    const { http, ctrl } = setup();
    http.get(`${API}/patients`, { headers: { 'X-Correlation-Id': 'abc12345' } }).subscribe();
    expect(ctrl.expectOne(`${API}/patients`).request.headers.get('X-Correlation-Id')).toBe(
      'abc12345',
    );
  });

  it('sends no token to the service status endpoint', () => {
    const { http, ctrl } = setup();
    const url = `${environment.apiBaseUrl}/gateway/health/services`;
    http.get(url).subscribe();
    expect(ctrl.expectOne(url).request.headers.has('Authorization')).toBe(false);
  });

  it('never sends the token to another host', () => {
    const { http, ctrl } = setup();
    http.get('https://example.org/data').subscribe();
    expect(ctrl.expectOne('https://example.org/data').request.headers.has('Authorization')).toBe(
      false,
    );
  });
});

describe('mockInterceptor', () => {
  it('asks Prism for the signed-in user when reading /api/me', () => {
    const { http, ctrl } = setup();
    signInAs('patient1');
    http.get(`${API}/me`).subscribe();
    expect(ctrl.expectOne(`${API}/me`).request.headers.get('Prefer')).toBe('example=patient1');
  });

  it('leaves other calls alone', () => {
    const { http, ctrl } = setup();
    signInAs('patient1');
    http.get(`${API}/patients`).subscribe();
    expect(ctrl.expectOne(`${API}/patients`).request.headers.has('Prefer')).toBe(false);
  });
});

describe('errorInterceptor', () => {
  function fail(status: number, body: object | null, url = `${API}/lab-requests`) {
    const { http, ctrl, ...rest } = setup();
    let caught: unknown;
    http.get(url).subscribe({ error: (e) => (caught = e) });
    ctrl.expectOne(url).flush(body, { status, statusText: 'x' });
    return { caught, ...rest };
  }

  it('503 with a service name marks that service down and shows a snackbar', () => {
    const { caught, status, snackBar } = fail(503, {
      status: 503,
      error: 'Service Unavailable',
      service: 'lab',
      message: 'Lab service is unavailable, please try again later',
      correlationId: 'b3f1c2d4',
    });
    expect(caught).toBeTruthy();
    expect(status.state().lab).toBe('DOWN');
    expect(status.state().patient).toBe('UNKNOWN');
    expect(snackBar.open).toHaveBeenCalledWith(
      'Lab service is unavailable',
      'Dismiss',
      expect.anything(),
    );
  });

  it('503 without a service name shows a generic message and marks nothing down', () => {
    const { status, snackBar } = fail(503, { status: 503, error: 'x', message: 'down' });
    expect(Object.values(status.state()).every((s) => s === 'UNKNOWN')).toBe(true);
    expect(snackBar.open).toHaveBeenCalledWith(
      'The server is temporarily unavailable',
      'Dismiss',
      expect.anything(),
    );
  });

  it('403 says the user is not allowed', () => {
    const { snackBar } = fail(403, { status: 403, error: 'Forbidden', message: 'no' });
    expect(snackBar.open).toHaveBeenCalledWith(
      'You are not allowed to do this',
      'Dismiss',
      expect.anything(),
    );
  });

  it('409 shows the server message', () => {
    const { snackBar } = fail(409, {
      status: 409,
      error: 'Conflict',
      message: 'Doctor already has an appointment at this time',
    });
    expect(snackBar.open).toHaveBeenCalledWith(
      'Doctor already has an appointment at this time',
      'Dismiss',
      expect.anything(),
    );
  });

  it('422 shows no snackbar and rethrows so the form can map the details', () => {
    const { caught, snackBar } = fail(422, {
      status: 422,
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      details: [{ field: 'birthDate', problem: 'must not be in the future' }],
    });
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(caught).toBeTruthy();
  });

  it('a network error says the server cannot be reached', () => {
    const { http, ctrl, snackBar } = setup();
    http.get(`${API}/patients`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${API}/patients`).error(new ProgressEvent('error'));
    expect(snackBar.open).toHaveBeenCalledWith(
      'Cannot reach the server',
      'Dismiss',
      expect.anything(),
    );
  });

  it('an unexpected 500 gets a generic message', () => {
    const { snackBar } = fail(500, { status: 500, error: 'x', message: 'boom' });
    expect(snackBar.open).toHaveBeenCalledWith(
      'Something went wrong on the server',
      'Dismiss',
      expect.anything(),
    );
  });

  it('failures of the service status poll never raise a snackbar', () => {
    const { snackBar } = fail(503, null, `${environment.apiBaseUrl}/gateway/health/services`);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('401: one silent refresh, then the request is retried with the new token', async () => {
    let token = 'old';
    const { http, ctrl } = setup({
      token: () => token,
      refresh: () => {
        token = 'new';
        return Promise.resolve(true);
      },
    });
    let result: unknown;
    http.get(`${API}/patients`).subscribe((r) => (result = r));
    ctrl.expectOne(`${API}/patients`).flush(null, { status: 401, statusText: 'Unauthorized' });
    const retry = await vi.waitFor(() => ctrl.expectOne(`${API}/patients`));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('401 when the refresh fails goes back to sign-in', async () => {
    const login = vi.fn();
    const { http, ctrl } = setup({ refresh: () => Promise.resolve(false), login });
    let failed = false;
    http.get(`${API}/patients`).subscribe({ error: () => (failed = true) });
    ctrl.expectOne(`${API}/patients`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await vi.waitFor(() => expect(failed).toBe(true));
    expect(login).toHaveBeenCalledOnce();
  });

  it('401 on the retried request is not retried again', async () => {
    const login = vi.fn();
    const { http, ctrl } = setup({ login });
    let failed = false;
    http.get(`${API}/patients`).subscribe({ error: () => (failed = true) });
    ctrl.expectOne(`${API}/patients`).flush(null, { status: 401, statusText: 'Unauthorized' });
    const retry = await vi.waitFor(() => ctrl.expectOne(`${API}/patients`));
    retry.flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBe(true);
    expect(login).toHaveBeenCalledOnce();
    ctrl.verify();
  });
});
