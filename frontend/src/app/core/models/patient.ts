export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  email?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  createdAt: string;
  updatedAt: string;
}
export type PatientInput = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>;
export interface PatientSummary {
  id: string;
  fullName: string;
  birthDate: string;
}
export interface MedicalFileEntry {
  id: string;
  patientId: string;
  type: 'CONSULTATION' | 'LAB' | 'PRESCRIPTION' | 'NOTE';
  summary: string;
  sourceService: string;
  referenceId?: string;
  createdAt: string;
}
