import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { Role } from '../../core/models/common';
import type { AppointmentStatus } from '../../core/models/reception';

export function durationValidator(min = 10, max = 120): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = Number(control.value);
    if (isNaN(val)) {
      return { invalidNumber: true };
    }
    if (val < min || val > max) {
      return { durationRange: { min, max, actual: val } };
    }
    return null;
  };
}

export function positiveIntegerValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = Number(control.value);
    if (!Number.isInteger(val) || val < 1) {
      return { positiveInteger: true };
    }
    return null;
  };
}

export function nonNegativeDecimalValidator(maxDecimals = 2): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = Number(control.value);
    if (isNaN(val) || val < 0) {
      return { nonNegative: true };
    }
    const str = String(control.value);
    const decimalPart = str.split('.')[1];
    if (decimalPart && decimalPart.length > maxDecimals) {
      return { maxDecimals: { max: maxDecimals } };
    }
    return null;
  };
}

export function calculateInvoiceTotal(lines: { quantity: number; unitPrice: number }[]): number {
  const sum = lines.reduce((acc, line) => {
    const q = Number(line.quantity) || 0;
    const p = Number(line.unitPrice) || 0;
    return acc + q * p;
  }, 0);
  return Math.round(sum * 100) / 100;
}

// Appointment action permissions
export function canCreateAppointment(hasRole: (role: Role) => boolean): boolean {
  return hasRole('RECEPTIONIST');
}

export function canCheckInAppointment(
  status: AppointmentStatus,
  hasRole: (role: Role) => boolean,
): boolean {
  return status === 'SCHEDULED' && hasRole('RECEPTIONIST');
}

export function canEditAppointment(
  status: AppointmentStatus,
  hasRole: (role: Role) => boolean,
): boolean {
  return status === 'SCHEDULED' && hasRole('RECEPTIONIST');
}

export function canCancelAppointment(
  status: AppointmentStatus,
  hasRole: (role: Role) => boolean,
): boolean {
  return (status === 'SCHEDULED' || status === 'CHECKED_IN') && hasRole('RECEPTIONIST');
}

export function canCompleteAppointment(
  status: AppointmentStatus,
  hasRole: (role: Role) => boolean,
): boolean {
  return status === 'CHECKED_IN' && (hasRole('DOCTOR') || hasRole('RECEPTIONIST'));
}

export function canStartConsultationFromAppointment(
  status: AppointmentStatus,
  hasRole: (role: Role) => boolean,
): boolean {
  return status === 'CHECKED_IN' && hasRole('DOCTOR');
}

// Invoice action permissions
export function canCreateInvoice(hasRole: (role: Role) => boolean): boolean {
  return hasRole('RECEPTIONIST');
}

export function canPayInvoice(status: string, hasRole: (role: Role) => boolean): boolean {
  return status === 'PENDING' && (hasRole('RECEPTIONIST') || hasRole('ADMIN'));
}

export function canCancelInvoice(status: string, hasRole: (role: Role) => boolean): boolean {
  return status === 'PENDING' && (hasRole('RECEPTIONIST') || hasRole('ADMIN'));
}
