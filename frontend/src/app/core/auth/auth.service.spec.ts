import { TestBed } from '@angular/core/testing';
import { provideFakeAuth, signInAs } from '../../../testing/auth';
import { AuthService } from './auth.service';
import { MOCK_USERS } from './mock-users';

describe('AuthService', () => {
  it('starts signed out and has no roles', () => {
    TestBed.configureTestingModule({ providers: [provideFakeAuth()] });
    const auth = TestBed.inject(AuthService);
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.hasRole('ADMIN')).toBe(false);
  });

  it('init takes the user from the backend', async () => {
    const doctor = MOCK_USERS.find((u) => u.username === 'doctor1')!;
    TestBed.configureTestingModule({
      providers: [provideFakeAuth({ init: () => Promise.resolve(doctor) })],
    });
    const auth = TestBed.inject(AuthService);
    await auth.init();
    expect(auth.user()?.username).toBe('doctor1');
    expect(auth.roles()).toEqual(['DOCTOR']);
  });

  it('hasRole is true when at least one role matches', () => {
    TestBed.configureTestingModule({ providers: [provideFakeAuth()] });
    signInAs('nurse1');
    const auth = TestBed.inject(AuthService);
    expect(auth.hasRole('DOCTOR', 'NURSE')).toBe(true);
    expect(auth.hasRole('DOCTOR', 'ADMIN')).toBe(false);
  });

  it('logout clears the user and tells the backend', () => {
    const logout = vi.fn();
    TestBed.configureTestingModule({ providers: [provideFakeAuth({ logout })] });
    signInAs('admin1');
    const auth = TestBed.inject(AuthService);
    auth.logout();
    expect(auth.user()).toBeNull();
    expect(logout).toHaveBeenCalledOnce();
  });

  it('exposes the backend token and refresh', async () => {
    TestBed.configureTestingModule({
      providers: [provideFakeAuth({ token: () => 'abc', refresh: () => Promise.resolve(false) })],
    });
    const auth = TestBed.inject(AuthService);
    expect(auth.token()).toBe('abc');
    expect(await auth.refresh()).toBe(false);
  });
});

describe('seeded mock users', () => {
  it('match Seed Data and Fixtures: 7 staff with staffId, 1 patient with patientId', () => {
    expect(MOCK_USERS).toHaveLength(8);
    const staff = MOCK_USERS.filter((u) => u.staffId);
    expect(staff).toHaveLength(7);
    expect(MOCK_USERS.find((u) => u.username === 'patient1')?.patientId).toBe(
      'a1a1a1a1-0000-4000-8000-000000000001',
    );
    expect(MOCK_USERS.find((u) => u.username === 'doctor1')?.staffId).toBe(
      'b2b2b2b2-0000-4000-8000-000000000001',
    );
  });

  it('cover all seven roles', () => {
    const roles = new Set(MOCK_USERS.flatMap((u) => u.roles));
    expect([...roles].sort()).toEqual([
      'ADMIN',
      'DOCTOR',
      'LAB_TECHNICIAN',
      'NURSE',
      'PATIENT',
      'PHARMACIST',
      'RECEPTIONIST',
    ]);
  });
});
