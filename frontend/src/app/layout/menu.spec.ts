import { menuFor } from './menu';

const labels = (roles: Parameters<typeof menuFor>[0]) => menuFor(roles).map((i) => i.label);

describe('menuFor', () => {
  // Angular - Architecture and Shared Code: "Menu by role"
  it('RECEPTIONIST', () => {
    expect(labels(['RECEPTIONIST'])).toEqual(['Patients', 'Appointments', 'Invoices', 'Status']);
  });

  it('DOCTOR', () => {
    expect(labels(['DOCTOR'])).toEqual([
      'My agenda',
      'Patients',
      'Consultations',
      'Lab results',
      'Prescriptions status',
      'Status',
    ]);
  });

  it('NURSE', () => {
    expect(labels(['NURSE'])).toEqual(['Patients', 'Vital signs', 'Consultations', 'Status']);
  });

  it('LAB_TECHNICIAN', () => {
    expect(labels(['LAB_TECHNICIAN'])).toEqual(['Lab queue', 'Lab results', 'Status']);
  });

  it('PHARMACIST', () => {
    expect(labels(['PHARMACIST'])).toEqual(['Prescriptions', 'Drugs and stock', 'Status']);
  });

  it('ADMIN', () => {
    expect(labels(['ADMIN'])).toEqual([
      'Staff',
      'Patients',
      'Appointments',
      'Invoices',
      'Lab',
      'Pharmacy',
      'Status',
    ]);
  });

  it('PATIENT has no staff entries and no Status', () => {
    expect(labels(['PATIENT'])).toEqual(['My appointments', 'My invoices', 'My consultations']);
  });

  it('lists a path only once when several roles overlap', () => {
    const paths = menuFor(['DOCTOR', 'NURSE']).map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('every menu entry points at a route that exists for that role (no dead links)', () => {
    const known = [
      '/patients',
      '/appointments',
      '/invoices',
      '/consultations',
      '/vitals',
      '/lab/requests',
      '/lab/results',
      '/pharmacy/prescriptions',
      '/pharmacy/drugs',
      '/staff',
      '/status',
      '/my/appointments',
      '/my/invoices',
      '/my/consultations',
    ];
    for (const role of [
      'RECEPTIONIST',
      'DOCTOR',
      'NURSE',
      'LAB_TECHNICIAN',
      'PHARMACIST',
      'ADMIN',
      'PATIENT',
    ] as const) {
      for (const item of menuFor([role])) {
        expect(known).toContain(item.path);
      }
    }
  });
});
