import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../core/models/common';
import {
  calculateInvoiceTotal,
  canCancelAppointment,
  canCancelInvoice,
  canCheckInAppointment,
  canCompleteAppointment,
  canCreateAppointment,
  canCreateInvoice,
  canEditAppointment,
  canPayInvoice,
  canStartConsultationFromAppointment,
  durationValidator,
  nonNegativeDecimalValidator,
  positiveIntegerValidator,
} from './reception-rules';

describe('reception-rules', () => {
  it('validates appointment duration 10 to 120 minutes', () => {
    const validator = durationValidator(10, 120);
    expect(validator(new FormControl(30))).toBeNull();
    expect(validator(new FormControl(10))).toBeNull();
    expect(validator(new FormControl(120))).toBeNull();
    expect(validator(new FormControl(5))).toEqual({
      durationRange: { min: 10, max: 120, actual: 5 },
    });
    expect(validator(new FormControl(130))).toEqual({
      durationRange: { min: 10, max: 120, actual: 130 },
    });
  });

  it('validates invoice quantity integer >= 1', () => {
    const validator = positiveIntegerValidator();
    expect(validator(new FormControl(1))).toBeNull();
    expect(validator(new FormControl(5))).toBeNull();
    expect(validator(new FormControl(0))).toEqual({ positiveInteger: true });
    expect(validator(new FormControl(-2))).toEqual({ positiveInteger: true });
    expect(validator(new FormControl(1.5))).toEqual({ positiveInteger: true });
  });

  it('validates invoice unit price >= 0 with at most 2 decimals', () => {
    const validator = nonNegativeDecimalValidator(2);
    expect(validator(new FormControl(50))).toBeNull();
    expect(validator(new FormControl(50.25))).toBeNull();
    expect(validator(new FormControl(0))).toBeNull();
    expect(validator(new FormControl(-5))).toEqual({ nonNegative: true });
    expect(validator(new FormControl(50.125))).toEqual({
      maxDecimals: { max: 2 },
    });
  });

  it('calculates invoice live total correctly', () => {
    const lines = [
      { quantity: 1, unitPrice: 50 },
      { quantity: 2, unitPrice: 15.5 },
    ];
    expect(calculateInvoiceTotal(lines)).toBe(81);
  });

  it('verifies appointment role permissions', () => {
    const mockAuth = (assigned: Role[]) => (role: Role) => assigned.includes(role);

    expect(canCreateAppointment(mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCreateAppointment(mockAuth(['DOCTOR']))).toBe(false);

    expect(canCheckInAppointment('SCHEDULED', mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCheckInAppointment('COMPLETED', mockAuth(['RECEPTIONIST']))).toBe(false);

    expect(canEditAppointment('SCHEDULED', mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canEditAppointment('CHECKED_IN', mockAuth(['RECEPTIONIST']))).toBe(false);

    expect(canCancelAppointment('SCHEDULED', mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCancelAppointment('CHECKED_IN', mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCancelAppointment('COMPLETED', mockAuth(['RECEPTIONIST']))).toBe(false);

    expect(canCompleteAppointment('CHECKED_IN', mockAuth(['DOCTOR']))).toBe(true);
    expect(canCompleteAppointment('CHECKED_IN', mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCompleteAppointment('SCHEDULED', mockAuth(['DOCTOR']))).toBe(false);

    expect(canStartConsultationFromAppointment('CHECKED_IN', mockAuth(['DOCTOR']))).toBe(true);
    expect(canStartConsultationFromAppointment('CHECKED_IN', mockAuth(['RECEPTIONIST']))).toBe(
      false,
    );
  });

  it('verifies invoice role permissions', () => {
    const mockAuth = (assigned: Role[]) => (role: Role) => assigned.includes(role);

    expect(canCreateInvoice(mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canCreateInvoice(mockAuth(['ADMIN']))).toBe(false);

    expect(canPayInvoice('PENDING', mockAuth(['RECEPTIONIST']))).toBe(true);
    expect(canPayInvoice('PENDING', mockAuth(['ADMIN']))).toBe(true);
    expect(canPayInvoice('PAID', mockAuth(['RECEPTIONIST']))).toBe(false);

    expect(canCancelInvoice('PENDING', mockAuth(['ADMIN']))).toBe(true);
    expect(canCancelInvoice('CANCELLED', mockAuth(['ADMIN']))).toBe(false);
  });
});
