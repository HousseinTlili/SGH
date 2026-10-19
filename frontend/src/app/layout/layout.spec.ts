import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_USERS } from '../core/auth/mock-users';
import { ServiceStatusService } from '../core/status/service-status.service';
import { provideFakeAuth, signInAs } from '../../testing/auth';
import { LandingComponent } from './landing.component';
import { LoginComponent } from './login.component';
import { menuFor } from './menu';
import { ProfileComponent } from './profile.component';
import { ShellComponent } from './shell.component';
import { StatusComponent } from './status.component';

const baseProviders = () => [
  provideRouter([]),
  provideHttpClient(),
  provideHttpClientTesting(),
  provideFakeAuth(),
];

describe('ShellComponent (role-based menu)', () => {
  async function render(username: string) {
    TestBed.configureTestingModule({ providers: baseProviders() });
    signInAs(username);
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const hrefs = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));

  it.each(MOCK_USERS.map((u) => [u.username, u.roles] as const))(
    '%s sees exactly the menu of its role',
    async (username, roles) => {
      const el = await render(username);
      expect(hrefs(el)).toEqual(menuFor(roles).map((i) => i.path));
    },
  );

  it('shows the user name, the service status bar and a skip link', async () => {
    const el = await render('doctor1');
    expect(el.textContent).toContain('Amel Trabelsi');
    expect(el.querySelectorAll('app-service-status-bar li.dot')).toHaveLength(6);
    expect(el.querySelector('a.sgh-skip-link')?.getAttribute('href')).toBe('#main-content');
  });

  it('starts the status polling', async () => {
    TestBed.configureTestingModule({ providers: baseProviders() });
    signInAs('admin1');
    const start = vi.spyOn(TestBed.inject(ServiceStatusService), 'start');
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    expect(start).toHaveBeenCalledOnce();
  });

  it('warns when the gateway cannot be reached', async () => {
    TestBed.configureTestingModule({ providers: baseProviders() });
    signInAs('admin1');
    TestBed.inject(ServiceStatusService).gateway.set('DOWN');
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.gateway-banner')?.textContent,
    ).toContain('Cannot reach the gateway');
  });
});

describe('ProfileComponent', () => {
  const ME_URL = `${environment.apiBaseUrl}/api/me`;

  async function render(username: string) {
    TestBed.configureTestingModule({ providers: baseProviders() });
    signInAs(username);
    const fixture = TestBed.createComponent(ProfileComponent);
    const ctrl = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    return { fixture, ctrl, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the staff profile returned by GET /api/me', async () => {
    const { fixture, ctrl, el } = await render('doctor1');
    ctrl.expectOne(ME_URL).flush({
      username: 'doctor1',
      roles: ['DOCTOR'],
      staff: {
        id: 'b2b2b2b2-0000-4000-8000-000000000001',
        fullName: 'Amel Trabelsi',
        role: 'DOCTOR',
        specialty: 'Cardiology',
        department: 'Cardiology',
      },
      patientId: null,
    });
    await fixture.whenStable();
    expect(el.textContent).toContain('Amel Trabelsi');
    expect(el.textContent).toContain('Cardiology');
  });

  it('shows the patient id for a patient user', async () => {
    const { fixture, ctrl, el } = await render('patient1');
    ctrl.expectOne(ME_URL).flush({
      username: 'patient1',
      roles: ['PATIENT'],
      staff: null,
      patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
    await fixture.whenStable();
    expect(el.textContent).toContain('a1a1a1a1-0000-4000-8000-000000000001');
  });

  it('when the Staff service is down it still shows username and roles from the token, plus a notice', async () => {
    const { fixture, ctrl, el } = await render('lab1');
    ctrl
      .expectOne(ME_URL)
      .flush(
        { status: 503, error: 'Service Unavailable', service: 'staff', message: 'down' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await fixture.whenStable();
    expect(el.textContent).toContain('lab1');
    expect(el.textContent).toContain('LAB_TECHNICIAN');
    expect(el.textContent).toContain('Your profile is unavailable right now');
  });
});

describe('StatusComponent', () => {
  it('has a card for the gateway and for each of the six services, with an explanation line', async () => {
    TestBed.configureTestingModule({ providers: baseProviders() });
    const status = TestBed.inject(ServiceStatusService);
    status.markDown('consultation');
    const fixture = TestBed.createComponent(StatusComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('li.card')).toHaveLength(7);
    expect(el.textContent).toContain('If a service is down, only its own screens are affected.');
    const consultation = Array.from(el.querySelectorAll('li.card')).find((c) =>
      c.textContent?.includes('Consultation'),
    );
    expect(consultation?.textContent).toContain('DOWN');
  });
});

describe('LoginComponent', () => {
  async function render(mockAuth: boolean) {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [...baseProviders(), { provide: MOCK_AUTH_ENABLED, useValue: mockAuth }],
    });
    TestBed.inject(MockAuthBackend);
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('mock mode offers every seeded user, so each of the seven roles can be tried', async () => {
    const { el } = await render(true);
    const buttons = Array.from(el.querySelectorAll('button.user'));
    expect(buttons).toHaveLength(8);
    expect(buttons.map((b) => b.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('doctor1'),
        expect.stringContaining('patient1'),
      ]),
    );
  });

  it('real mode offers no fake users, only the Keycloak sign-in', async () => {
    const { el } = await render(false);
    expect(el.querySelectorAll('button.user')).toHaveLength(0);
    expect(el.textContent).toContain('Sign in with Keycloak');
  });

  it('the Keycloak button hands over to the identity provider', async () => {
    const login = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ...baseProviders(),
        { provide: MOCK_AUTH_ENABLED, useValue: false },
        provideFakeAuth({ login }),
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Sign in with Keycloak'));
    button?.click();
    expect(login).toHaveBeenCalledOnce();
  });

  it('signing in completes the sign-in and leaves the login page', async () => {
    const { fixture } = await render(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.signIn('nurse1');
    expect(TestBed.inject(AuthService).user()?.username).toBe('nurse1');
    expect(navigate).toHaveBeenCalledWith('/');
  });
});

describe('LandingComponent', () => {
  async function render(authenticatedUser?: string) {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [...baseProviders(), { provide: MOCK_AUTH_ENABLED, useValue: true }],
    });
    TestBed.inject(MockAuthBackend);
    if (authenticatedUser) {
      signInAs(authenticatedUser);
    }
    const fixture = TestBed.createComponent(LandingComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders hospital title, departments and live telemetry preview', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('St. Gabriel Hospital');
    expect(el.textContent).toContain('Compassionate Care');
    expect(el.textContent).toContain('Consultations & SOAP Notes');
    expect(el.textContent).toContain('Diagnostic Laboratory');
    expect(el.textContent).toContain('Live Telemetry');
  });

  it('allows unauthenticated visitors to navigate to login', async () => {
    const { el } = await render();
    const portalLink = el.querySelector('a[href="/login"]');
    expect(portalLink).not.toBeNull();
  });

  it('shows user name and workspace action when already signed in', async () => {
    const { el } = await render('doctor1');
    expect(el.textContent).toContain('Amel Trabelsi');
  });

  it('quickSignIn signs in the user directly in mock mode', async () => {
    const { fixture } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance.quickSignIn('patient1');
    expect(TestBed.inject(AuthService).user()?.username).toBe('patient1');
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
