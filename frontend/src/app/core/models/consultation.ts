export interface Consultation {
  id: string;
  appointmentId?: string | null;
  patientId: string;
  patientSnapshot: { fullName: string; birthDate: string } | null;
  doctorId: string;
  doctorSpecialty?: string | null;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  status: 'DRAFT' | 'SIGNED';
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  consultationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  data: string;
  caption: string | null;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AttachmentInput {
  fileName: string;
  fileType: string;
  fileSize: number;
  data: string;
  caption?: string | null;
}
export interface VitalSigns {
  id: string;
  patientId: string;
  consultationId?: string | null;
  recordedBy: string;
  temperature?: number;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  spo2?: number;
  weight?: number;
  recordedAt: string;
}
export interface PrescriptionItem {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
}
export interface Prescription {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  items: PrescriptionItem[];
  status: 'ISSUED';
  createdAt: string;
}
export interface LabTestRef {
  code: string;
  name: string;
}
export interface LabOrder {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  priority: 'ROUTINE' | 'URGENT';
  tests: LabTestRef[];
  status: 'REQUESTED' | 'VALIDATED';
  createdAt: string;
}
export type LabFlag = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';
export interface LabResultLine {
  testCode: string;
  value: number;
  unit: string;
  referenceRange: string;
  flag: LabFlag;
}
export interface LabResultCopy {
  labRequestId: string;
  consultationId: string;
  patientId: string;
  results: LabResultLine[];
  validatedAt: string;
}
