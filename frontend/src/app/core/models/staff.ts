import type { Role } from './common';

export interface Staff {
  id: string;
  keycloakUserId?: string | null;
  firstName: string;
  lastName: string;
  role: Exclude<Role, 'PATIENT'>;
  specialty?: string | null;
  department: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface StaffPublic {
  id: string;
  fullName: string;
  role: Role;
  specialty?: string | null;
}
export interface Me {
  username: string;
  roles: Role[];
  staff: (StaffPublic & { department: string }) | null;
  patientId: string | null;
}
