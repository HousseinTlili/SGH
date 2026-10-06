import type { LabResultLine, LabTestRef } from './consultation';

export type LabStatus = 'REQUESTED' | 'IN_PROGRESS' | 'RESULT_ENTERED' | 'VALIDATED';
export interface LabRequest {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  priority: 'ROUTINE' | 'URGENT';
  status: LabStatus;
  tests: LabTestRef[];
  results: LabResultLine[];
  requestedAt: string;
  startedAt?: string | null;
  validatedAt?: string | null;
}
export interface LabTest {
  code: string;
  name: string;
  unit: string;
  refLow: number;
  refHigh: number;
  criticalLow?: number | null;
  criticalHigh?: number | null;
}
