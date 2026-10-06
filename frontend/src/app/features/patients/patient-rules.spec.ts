import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../core/models/common';
import {
  PHONE_PATTERN,
  calculateAge,
  canAddMedicalNote,
  canCreatePatient,
  canDeletePatient,
  canEditPatient,
  canStartConsultationForPatient,
  canViewMedicalFile,
  notBefore1900Validator,
  notFutureDateValidator,
} from './patient-rules';

describe('patient-rules', () => {
  it('validates not future date', () => {
    const validator = notFutureDateValidator();
    expect(validator(new FormControl('1990-01-01'))).toBeNull();

    const futureYear = new Date().getFullYear() + 2;
    expect(validator(new FormControl(`${futureYear}-01-01`))).toEqual({ futureDate: true });
  });

  it('validates not before 1900', () => {
    const validator = notBefore1900Validator();
    expect(validator(new FormControl('1900-01-01'))).toBeNull();
    expect(validator(new FormControl('1985-03-14'))).toBeNull();
    expect(validator(new FormControl('1899-12-31'))).toEqual({ minDate: true });
  });

  it('validates phone pattern', () => {
    expect(PHONE_PATTERN.test('+21620111001')).toBe(true);
    expect(PHONE_PATTERN.test('12345678')).toBe(true);
    expect(PHONE_PATTERN.test('123')).toBe(false);
    expect(PHONE_PATTERN.test('abc12345678')).toBe(false);
  });

  it('calculates age correctly', () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge('invalid')).toBeNull();
    const age = calculateAge('2000-01-01');
    expect(age).toBeGreaterThanOrEqual(25);
  });

  it('verifies role permissions for patient actions', () => {
    const mockAuth = (assigned: Role[]) => (role: Role) => assigned.includes(role);

    expect(canCreatePatient(mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCreatePatient(mockAuth(['DOCTOR']))).toBe(false);

    expect(canEditPatient(mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canEditPatient(mockAuth(['ADMIN']))).toBe(false);

    expect(canDeletePatient(mockAuth(['ADMIN']))).toBe(true);
    expect(canDeletePatient(mockAuth(['RECEPTIONIST']))).toBe(false);

    expect(canAddMedicalNote(mockAuth(['DOCTOR']))).toBe(true);
    expect(canAddMedicalNote(mockAuth(['NURSE']))).toBe(false);

    expect(canViewMedicalFile(mockAuth(['NURSE']))).toBe(true);
    expect(canViewMedicalFile(mockAuth(['RECEPTIONIST']))).toBe(false);

    expect(canStartConsultationForPatient(mockAuth(['DOCTOR']))).toBe(true);
    expect(canStartConsultationForPatient(mockAuth(['ADMIN']))).toBe(false);
  });
});
