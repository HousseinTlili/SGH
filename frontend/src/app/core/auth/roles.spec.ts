import { landingPathFor, onlySghRoles } from './roles';

describe('landingPathFor', () => {
  // Angular - Screens A: "Landing redirect by role"
  it.each([
    ['RECEPTIONIST', '/appointments'],
    ['DOCTOR', '/appointments'],
    ['NURSE', '/vitals'],
    ['LAB_TECHNICIAN', '/lab/requests'],
    ['PHARMACIST', '/pharmacy/prescriptions'],
    ['ADMIN', '/status'],
    ['PATIENT', '/my/appointments'],
  ] as const)('%s lands on %s', (role, path) => {
    expect(landingPathFor([role])).toBe(path);
  });

  it('falls back to the profile page when there is no known role', () => {
    expect(landingPathFor([])).toBe('/profile');
  });

  it('uses the first role of the priority list when a user holds several', () => {
    expect(landingPathFor(['NURSE', 'DOCTOR'])).toBe('/appointments');
    expect(landingPathFor(['PATIENT', 'ADMIN'])).toBe('/status');
  });
});

describe('onlySghRoles', () => {
  it('drops the default roles Keycloak adds to every token', () => {
    expect(
      onlySghRoles(['offline_access', 'DOCTOR', 'uma_authorization', 'default-roles-sgh']),
    ).toEqual(['DOCTOR']);
  });
});
