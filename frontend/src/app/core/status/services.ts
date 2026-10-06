import type { ServiceName } from '../models/common';

export const SERVICES: readonly ServiceName[] = [
  'patient',
  'reception',
  'consultation',
  'lab',
  'pharmacy',
  'staff',
];

const LABELS: Record<ServiceName, string> = {
  patient: 'Patient',
  reception: 'Reception',
  consultation: 'Consultation',
  lab: 'Lab',
  pharmacy: 'Pharmacy',
  staff: 'Staff',
};

export function serviceLabel(service: ServiceName): string {
  return LABELS[service];
}
