import type { Role } from '../core/models/common';

export interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

const STATUS: MenuItem = { label: 'Status', path: '/status', icon: 'monitor_heart' };
const PATIENTS: MenuItem = { label: 'Patients', path: '/patients', icon: 'groups' };
const APPOINTMENTS: MenuItem = { label: 'Appointments', path: '/appointments', icon: 'event' };
const INVOICES: MenuItem = { label: 'Invoices', path: '/invoices', icon: 'receipt_long' };
const CONSULTATIONS: MenuItem = {
  label: 'Consultations',
  path: '/consultations',
  icon: 'medical_services',
};
const LAB_RESULTS: MenuItem = { label: 'Lab results', path: '/lab/results', icon: 'science' };

/**
 * Menu by role, from "Menu by role (layout/menu.ts)" in Angular - Architecture and Shared Code.
 * Profile and Logout are in the user menu of the toolbar for everyone.
 */
export const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  RECEPTIONIST: [PATIENTS, APPOINTMENTS, INVOICES, STATUS],
  DOCTOR: [
    { label: 'My agenda', path: '/appointments', icon: 'event' },
    PATIENTS,
    CONSULTATIONS,
    LAB_RESULTS,
    { label: 'Prescriptions status', path: '/pharmacy/prescriptions', icon: 'medication' },
    STATUS,
  ],
  NURSE: [
    PATIENTS,
    { label: 'Vital signs', path: '/vitals', icon: 'monitor_heart' },
    CONSULTATIONS,
    STATUS,
  ],
  LAB_TECHNICIAN: [
    { label: 'Lab queue', path: '/lab/requests', icon: 'science' },
    LAB_RESULTS,
    STATUS,
  ],
  PHARMACIST: [
    { label: 'Prescriptions', path: '/pharmacy/prescriptions', icon: 'medication' },
    { label: 'Drugs and stock', path: '/pharmacy/drugs', icon: 'inventory_2' },
    STATUS,
  ],
  ADMIN: [
    { label: 'Staff', path: '/staff', icon: 'badge' },
    PATIENTS,
    APPOINTMENTS,
    INVOICES,
    { label: 'Lab', path: '/lab/requests', icon: 'science' },
    { label: 'Pharmacy', path: '/pharmacy/prescriptions', icon: 'medication' },
    STATUS,
  ],
  PATIENT: [
    { label: 'My appointments', path: '/my/appointments', icon: 'event' },
    { label: 'My invoices', path: '/my/invoices', icon: 'receipt_long' },
    { label: 'My consultations', path: '/my/consultations', icon: 'medical_services' },
  ],
};

/** Menu for a user. With several roles the entries are merged and a path appears only once. */
export function menuFor(roles: readonly Role[]): MenuItem[] {
  const seen = new Set<string>();
  const items: MenuItem[] = [];
  for (const role of roles) {
    for (const item of MENU_BY_ROLE[role]) {
      if (!seen.has(item.path)) {
        seen.add(item.path);
        items.push(item);
      }
    }
  }
  return items;
}
