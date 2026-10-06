import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MockAuthBackend } from './mock-auth.backend';

describe('MockAuthBackend', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('uses the fixed token', () => {
    expect(TestBed.inject(MockAuthBackend).token()).toBe('mock-token');
  });

  it('starts with nobody signed in', async () => {
    expect(await TestBed.inject(MockAuthBackend).init()).toBeNull();
  });

  it('signIn returns the seeded user and remembers it for a reload', async () => {
    const backend = TestBed.inject(MockAuthBackend);
    const user = backend.signIn('lab1');
    expect(user.roles).toEqual(['LAB_TECHNICIAN']);
    expect((await backend.init())?.username).toBe('lab1');
  });

  it('rejects an unknown user', () => {
    expect(() => TestBed.inject(MockAuthBackend).signIn('nobody')).toThrow();
  });

  it('logout forgets the user and goes to /login', async () => {
    const backend = TestBed.inject(MockAuthBackend);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    backend.signIn('admin1');
    backend.logout();
    expect(await backend.init()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
