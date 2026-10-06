import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { Role } from '../../core/models/common';

export const PHONE_PATTERN = /^[+]?[0-9 ]{8,15}$/;

export function notFutureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    const val = new Date(control.value);
    if (isNaN(val.getTime())) {
      return null;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return val > today ? { futureDate: true } : null;
  };
}

export function notBefore1900Validator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    const val = new Date(control.value);
    if (isNaN(val.getTime())) {
      return null;
    }
    const minDate = new Date('1900-01-01T00:00:00Z');
    return val < minDate ? { minDate: true } : null;
  };
}

export function calculateAge(birthDateStr: string | null | undefined): number | null {
  if (!birthDateStr) {
    return null;
  }
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function canCreatePatient(hasRole: (role: Role) => boolean): boolean {
  return hasRole('RECEPTIONIST');
}

export function canEditPatient(hasRole: (role: Role) => boolean): boolean {
  return hasRole('RECEPTIONIST');
}

export function canDeletePatient(hasRole: (role: Role) => boolean): boolean {
  return hasRole('ADMIN');
}

export function canAddMedicalNote(hasRole: (role: Role) => boolean): boolean {
  return hasRole('DOCTOR');
}

export function canViewMedicalFile(hasRole: (role: Role) => boolean): boolean {
  return hasRole('DOCTOR') || hasRole('NURSE');
}

export function canStartConsultationForPatient(hasRole: (role: Role) => boolean): boolean {
  return hasRole('DOCTOR');
}
