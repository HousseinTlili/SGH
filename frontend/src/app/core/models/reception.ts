export type AppointmentStatus = 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
export interface Appointment {
  id: string;
  patientId: string;
  patientVerified: boolean;
  doctorId: string;
  startAt: string;
  endAt: string;
  reason: string;
  status: AppointmentStatus;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
export type AppointmentInput = Pick<
  Appointment,
  'patientId' | 'doctorId' | 'startAt' | 'endAt' | 'reason'
>;
export interface Slot {
  startAt: string;
  endAt: string;
  available: boolean;
}
export interface Availability {
  doctorId: string;
  date: string;
  slots: Slot[];
}
export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}
export interface Invoice {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  lines: InvoiceLine[];
  total: number;
  currency: 'TND';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentMethod?: 'CASH' | 'CARD' | null;
  paidAt?: string | null;
  createdAt: string;
}
