export type Role =
  'PATIENT' | 'DOCTOR' | 'NURSE' | 'LAB_TECHNICIAN' | 'PHARMACIST' | 'RECEPTIONIST' | 'ADMIN';

export type ServiceName = 'patient' | 'reception' | 'consultation' | 'lab' | 'pharmacy' | 'staff';

export interface Paged<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiError {
  timestamp?: string;
  status: number;
  error: string;
  message: string;
  path?: string;
  correlationId?: string;
  service?: ServiceName;
  details?: { field: string; problem: string }[];
}
