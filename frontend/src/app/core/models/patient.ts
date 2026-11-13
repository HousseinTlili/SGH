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
/** Restricted identity returned by GET /api/patients/similar (no contact or clinical fields). */
export interface SimilarPatient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  match: 'EXACT' | 'SIMILAR';
  score: number;
}
export interface PatientStatisticsQuery {
  period?: 'THIS_MONTH' | 'LAST_3_MONTHS' | 'LAST_12_MONTHS' | 'CUSTOM';
  from?: string;
  to?: string;
  ageGroup?: 'ALL' | '0-17' | '18-35' | '36-60' | '60+';
  gender?: 'ALL' | 'MALE' | 'FEMALE' | 'OTHER';
}
export interface PatientStatistics {
  period: {
    from: string;
    to: string;
    preset: PatientStatisticsQuery['period'];
  };
  activePatients: number;
  newRegistrations: number;
  averageAge: number | null;
  incompleteFiles: number;
  registrationsByMonth: { month: string; count: number }[];
  ageGroups: { name: string; count: number }[];
  genders: { name: string; count: number }[];
  completeness: { complete: number; incomplete: number };
}
export type AllergyCategory = 'MEDICATION' | 'FOOD' | 'ENVIRONMENT' | 'BIOLOGIC' | 'OTHER';
export type ReactionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';
export type AllergyClinicalStatus = 'ACTIVE' | 'INACTIVE' | 'RESOLVED';
export type AllergyVerificationStatus = 'DECLARED' | 'UNCONFIRMED' | 'CONFIRMED' | 'REFUTED';
export type AllergyCriticality = 'LOW' | 'HIGH' | 'UNABLE_TO_ASSESS';
export interface PatientAllergyInput {
  allergen: string;
  category: AllergyCategory;
  observedReaction?: string;
  reactionDate?: string;
  reactionSeverity?: ReactionSeverity;
  clinicalStatus: AllergyClinicalStatus;
  criticality: AllergyCriticality;
  version: number;
}
export interface PatientAllergy extends PatientAllergyInput {
  id: string;
  patientId: string;
  verificationStatus: AllergyVerificationStatus;
  recordedByUsername: string;
  recordedByRole: string;
  createdAt: string;
  updatedAt: string;
}
export interface AllergyHistory {
  id: string;
  allergyId: string;
  patientId: string;
  action: 'CREATE' | 'UPDATE' | 'CONFIRM' | 'REFUTE';
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  changedByUsername: string;
  changedByRole: string;
  correlationId: string;
  changedAt: string;
}
export interface AllergyPassport {
  patientId: string;
  /** Opaque QR token — never contains allergen or clinical text. */
  passportToken: string;
  fullName: string;
  birthDate: string;
  bloodType?: string;
  allergies: PatientAllergy[];
  generatedAt: string;
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
