import type { Role } from '../models/common';

export const ALL_ROLES: readonly Role[] = [
  'PATIENT',
  'DOCTOR',
  'NURSE',
  'LAB_TECHNICIAN',
  'PHARMACIST',
  'RECEPTIONIST',
  'ADMIN',
];

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

/** Keeps only the seven SGH roles; Keycloak tokens also carry default roles such as offline_access. */
export function onlySghRoles(values: readonly string[]): Role[] {
  return values.filter(isRole);
}

/** Landing page per role (Angular - Screens A, "Landing redirect by role"). */
const LANDING: Record<Role, string> = {
  RECEPTIONIST: '/appointments',
  DOCTOR: '/appointments',
  NURSE: '/vitals',
  LAB_TECHNICIAN: '/lab/requests',
  PHARMACIST: '/pharmacy/prescriptions',
  ADMIN: '/status',
  PATIENT: '/my/appointments',
};

/** Used only when one user holds several roles: the first role in this list decides. */
const LANDING_PRIORITY: readonly Role[] = [
  'ADMIN',
  'DOCTOR',
  'RECEPTIONIST',
  'NURSE',
  'LAB_TECHNICIAN',
  'PHARMACIST',
  'PATIENT',
];

export function landingPathFor(roles: readonly Role[]): string {
  const role = LANDING_PRIORITY.find((r) => roles.includes(r));
  return role ? LANDING[role] : '/profile';
}
