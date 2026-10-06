import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { provideFakeAuth, signInAs } from '../../../testing/auth';
import { authenticatedGuard, roleGuard } from './auth.guard';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function run(guard: typeof authenticatedGuard) {
  return TestBed.runInInjectionContext(() => guard(route, state));
}

describe('route guards', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideFakeAuth()] });
  });

  const asPath = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('authenticatedGuard sends signed-out users to /login', () => {
    expect(asPath(run(authenticatedGuard))).toBe('/login');
  });

  it('authenticatedGuard lets a signed-in user through', () => {
    signInAs('doctor1');
    expect(run(authenticatedGuard)).toBe(true);
  });

  it('roleGuard sends signed-out users to /login', () => {
    expect(asPath(run(roleGuard('ADMIN')))).toBe('/login');
  });

  it('roleGuard allows a matching role', () => {
    signInAs('reception1');
    expect(run(roleGuard('RECEPTIONIST', 'ADMIN'))).toBe(true);
  });

  it('roleGuard sends a user without a matching role to /forbidden', () => {
    signInAs('nurse1');
    expect(asPath(run(roleGuard('RECEPTIONIST', 'ADMIN')))).toBe('/forbidden');
  });

  // Angular - Architecture and Shared Code, routing table: who may open which area
  it.each([
    ['patient1', 'PATIENT-only area', ['PATIENT'], true],
    ['doctor1', 'PATIENT-only area', ['PATIENT'], false],
    ['lab1', 'lab area', ['LAB_TECHNICIAN', 'DOCTOR', 'ADMIN'], true],
    ['pharmacist1', 'lab area', ['LAB_TECHNICIAN', 'DOCTOR', 'ADMIN'], false],
    ['admin1', 'staff area', ['ADMIN'], true],
    ['reception1', 'staff area', ['ADMIN'], false],
  ] as const)('%s on %s allowed=%s', (username, _area, roles, allowed) => {
    signInAs(username);
    expect(run(roleGuard(...roles)) === true).toBe(allowed);
  });
});
