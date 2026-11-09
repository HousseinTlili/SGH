import type { ServiceName } from '../models/common';

export const SERVICES: readonly ServiceName[] = [
  'patient',
  'reception',
  'consultation',
  'lab',
  'pharmacy',
  'staff',
  'notification',
];

const LABELS: Record<ServiceName, string> = {
  patient: 'Patient',
  reception: 'Reception',
  consultation: 'Consultation',
  lab: 'Lab',
  pharmacy: 'Pharmacy',
  staff: 'Staff',
  notification: 'Notification',
};

export function serviceLabel(service: ServiceName): string {
  return LABELS[service];
}
