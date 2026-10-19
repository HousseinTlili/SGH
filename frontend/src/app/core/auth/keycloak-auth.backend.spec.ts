import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { KEYCLOAK_CLIENT, KeycloakAuthBackend, type KeycloakClient } from './keycloak-auth.backend';

function fakeKeycloak(overrides: Partial<KeycloakClient> & Record<string, unknown> = {}) {
  const client = {
    authenticated: true,
    token: 'access-token',
    tokenParsed: {
      preferred_username: 'doctor1',
      given_name: 'Amel',
      family_name: 'Trabelsi',
      staffId: 'b2b2b2b2-0000-4000-8000-000000000001',
      realm_access: { roles: ['DOCTOR', 'offline_access', 'uma_authorization'] },
    },
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  return client as unknown as KeycloakClient & typeof client;
}

function backendWith(client: KeycloakClient): KeycloakAuthBackend {
  TestBed.configureTestingModule({ providers: [{ provide: KEYCLOAK_CLIENT, useValue: client }] });
  return TestBed.inject(KeycloakAuthBackend);
}

describe('KeycloakAuthBackend', () => {
  it('uses the authorization code flow with PKCE and looks for an existing session', async () => {
    const client = fakeKeycloak();
    await backendWith(client).init();
    expect(client.init).toHaveBeenCalledWith(
      expect.objectContaining({ pkceMethod: 'S256', onLoad: 'check-sso' }),
    );
  });

  it('turns the token into the signed-in user, keeping only the SGH roles', async () => {
    const user = await backendWith(fakeKeycloak()).init();
    expect(user).toEqual({
      username: 'doctor1',
      fullName: 'Amel Trabelsi',
      roles: ['DOCTOR'],
      staffId: 'b2b2b2b2-0000-4000-8000-000000000001',
      patientId: undefined,
    });
  });

  it('reads patientId for a patient and prefers the name claim when there is one', async () => {
    const user = await backendWith(
      fakeKeycloak({
        tokenParsed: {
          preferred_username: 'patient1',
          name: 'Youssef Ben Salah',
          patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
          realm_access: { roles: ['PATIENT'] },
        },
      }),
    ).init();
    expect(user).toMatchObject({
      username: 'patient1',
      fullName: 'Youssef Ben Salah',
      roles: ['PATIENT'],
      patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
    });
  });

  it('resolves null when nobody is signed in', async () => {
    expect(
      await backendWith(fakeKeycloak({ init: vi.fn().mockResolvedValue(false) })).init(),
    ).toBeNull();
  });

  it('still lets the app start when Keycloak cannot be reached', async () => {
    const down = fakeKeycloak({ init: vi.fn().mockRejectedValue(new Error('network')) });
    expect(await backendWith(down).init()).toBeNull();
  });

  it('hands out the current access token, and an empty one before sign-in', () => {
    expect(backendWith(fakeKeycloak()).token()).toBe('access-token');
    TestBed.resetTestingModule();
    expect(backendWith(fakeKeycloak({ token: undefined })).token()).toBe('');
  });

  it('refreshes silently and reports a failure instead of throwing', async () => {
    const ok = backendWith(fakeKeycloak());
    expect(await ok.refresh()).toBe(true);
    TestBed.resetTestingModule();
    const failing = fakeKeycloak({ updateToken: vi.fn().mockRejectedValue(new Error('expired')) });
    expect(await backendWith(failing).refresh()).toBe(false);
  });

  it('refreshes ahead of the expiry while the page is open', async () => {
    const client = fakeKeycloak();
    await backendWith(client).init();
    client.onTokenExpired?.();
    expect(client.updateToken).toHaveBeenCalledWith(30);
  });

  it('sends the user to Keycloak to sign in and to sign out, coming back to this app', () => {
    const client = fakeKeycloak();
    const backend = backendWith(client);
    backend.login();
    backend.logout();
    expect(client.login).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/` });
    expect(client.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/login` });
  });
});
