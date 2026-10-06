export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

/** Status -> colour, exactly as the StatusBadge table of Angular - Architecture and Shared Code. */
const STATUS_TONES: Record<string, Tone> = {
  SCHEDULED: 'info',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  PENDING: 'warning',
  PAID: 'success',
  DRAFT: 'warning',
  SIGNED: 'success',
  REQUESTED: 'info',
  IN_PROGRESS: 'warning',
  RESULT_ENTERED: 'accent',
  VALIDATED: 'success',
  ISSUED: 'info',
  PARTIALLY_DISPENSED: 'warning',
  DISPENSED: 'success',
  URGENT: 'danger',
  ROUTINE: 'neutral',
};

export function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? 'neutral';
}

/** CHECKED_IN -> "Checked in" */
export function statusLabel(status: string): string {
  const text = status.toLowerCase().replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
