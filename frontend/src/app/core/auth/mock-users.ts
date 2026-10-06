import type { AuthUser } from './auth-backend';

/** The eight seeded users (Seed Data and Fixtures), with the same fixed ids. */
export const MOCK_USERS: readonly AuthUser[] = [
  {
    username: 'doctor1',
    fullName: 'Amel Trabelsi',
    roles: ['DOCTOR'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000001',
  },
  {
    username: 'doctor2',
    fullName: 'Karim Jlassi',
    roles: ['DOCTOR'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000002',
  },
  {
    username: 'nurse1',
    fullName: 'Sonia Gharbi',
    roles: ['NURSE'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000003',
  },
  {
    username: 'lab1',
    fullName: 'Walid Mansouri',
    roles: ['LAB_TECHNICIAN'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000004',
  },
  {
    username: 'pharmacist1',
    fullName: 'Ines Chaabane',
    roles: ['PHARMACIST'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000005',
  },
  {
    username: 'reception1',
    fullName: 'Rim Bouazizi',
    roles: ['RECEPTIONIST'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000006',
  },
  {
    username: 'admin1',
    fullName: 'Sami Hamdi',
    roles: ['ADMIN'],
    staffId: 'b2b2b2b2-0000-4000-8000-000000000007',
  },
  {
    username: 'patient1',
    fullName: 'Youssef Ben Salah',
    roles: ['PATIENT'],
    patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
  },
];
