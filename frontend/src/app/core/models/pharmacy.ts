import type { PrescriptionItem } from './consultation';

export interface Drug {
  id: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  stock: number;
  reorderThreshold: number;
  createdAt: string;
  updatedAt: string;
}
export type DrugInput = Pick<
  Drug,
  'name' | 'form' | 'strength' | 'unit' | 'stock' | 'reorderThreshold'
>;
export interface PharmacyItem extends PrescriptionItem {
  index: number;
  dispensed: boolean;
}
export interface PharmacyPrescription {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  status: 'ISSUED' | 'PARTIALLY_DISPENSED' | 'DISPENSED';
  items: PharmacyItem[];
  createdAt: string;
}
export interface DispenseLine {
  itemIndex: number;
  drugId: string;
  quantity: number;
}

/** One dispensing event of a prescription (GET /api/prescriptions/{id}/dispensings). */
export interface Dispensing {
  id: string;
  prescriptionId: string;
  pharmacistId: string;
  lines: DispenseLine[];
  dispensedAt: string;
}
