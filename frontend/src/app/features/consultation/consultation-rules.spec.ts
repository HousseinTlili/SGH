import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import type { Consultation } from '../../core/models/consultation';
import {
  FALLBACK_CATALOGUE_TESTS,
  canEditConsultationNotes,
  canOrderLab,
  canPrescribe,
  canRecordVitals,
  canSignConsultation,
  hasAtLeastOneVital,
  validateDiastolic,
  validateHeartRate,
  validateSpo2,
  validateSystolic,
  validateTemperature,
  validateWeight,
  vitalsFormValidator,
} from './consultation-rules';

describe('consultation-rules', () => {
  describe('Vital signs range validators', () => {
    it('validates temperature (30.0 - 45.0 °C)', () => {
      expect(validateTemperature(null)).toBeNull();
      expect(validateTemperature(undefined)).toBeNull();
      expect(validateTemperature(36.6)).toBeNull();
      expect(validateTemperature(30.0)).toBeNull();
      expect(validateTemperature(45.0)).toBeNull();
      expect(validateTemperature(29.9)).toContain('Temperature must be between');
      expect(validateTemperature(45.1)).toContain('Temperature must be between');
    });

    it('validates heart rate (20 - 250 bpm)', () => {
      expect(validateHeartRate(null)).toBeNull();
      expect(validateHeartRate(72)).toBeNull();
      expect(validateHeartRate(20)).toBeNull();
      expect(validateHeartRate(250)).toBeNull();
      expect(validateHeartRate(19)).toContain('Heart rate must be between');
      expect(validateHeartRate(251)).toContain('Heart rate must be between');
    });

    it('validates systolic blood pressure (50 - 260 mmHg)', () => {
      expect(validateSystolic(null)).toBeNull();
      expect(validateSystolic(120)).toBeNull();
      expect(validateSystolic(50)).toBeNull();
      expect(validateSystolic(260)).toBeNull();
      expect(validateSystolic(49)).toContain('Systolic BP must be between');
      expect(validateSystolic(261)).toContain('Systolic BP must be between');
    });

    it('validates diastolic blood pressure (30 - 160 mmHg and strictly lower than systolic)', () => {
      expect(validateDiastolic(null)).toBeNull();
      expect(validateDiastolic(80, 120)).toBeNull();
      expect(validateDiastolic(30, 100)).toBeNull();
      expect(validateDiastolic(160, 200)).toBeNull();
      expect(validateDiastolic(29)).toContain('Diastolic BP must be between');
      expect(validateDiastolic(161)).toContain('Diastolic BP must be between');
      // Diastolic must be lower than systolic
      expect(validateDiastolic(120, 120)).toContain(
        'Diastolic BP must be strictly lower than systolic BP',
      );
      expect(validateDiastolic(130, 120)).toContain(
        'Diastolic BP must be strictly lower than systolic BP',
      );
    });

    it('validates SpO2 (50 - 100 %)', () => {
      expect(validateSpo2(null)).toBeNull();
      expect(validateSpo2(98)).toBeNull();
      expect(validateSpo2(50)).toBeNull();
      expect(validateSpo2(100)).toBeNull();
      expect(validateSpo2(49)).toContain('SpO2 must be between');
      expect(validateSpo2(101)).toContain('SpO2 must be between');
    });

    it('validates weight (0.5 - 400.0 kg)', () => {
      expect(validateWeight(null)).toBeNull();
      expect(validateWeight(70)).toBeNull();
      expect(validateWeight(0.5)).toBeNull();
      expect(validateWeight(400.0)).toBeNull();
      expect(validateWeight(0.4)).toContain('Weight must be between');
      expect(validateWeight(400.1)).toContain('Weight must be between');
    });
  });

  describe('hasAtLeastOneVital', () => {
    it('returns false when all values are null or undefined or empty', () => {
      expect(hasAtLeastOneVital({})).toBe(false);
      expect(
        hasAtLeastOneVital({
          temperature: null,
          heartRate: null,
          systolic: null,
          diastolic: null,
          spo2: null,
          weight: null,
        }),
      ).toBe(false);
    });

    it('returns true when at least one value is provided', () => {
      expect(hasAtLeastOneVital({ temperature: 37.0 })).toBe(true);
      expect(hasAtLeastOneVital({ heartRate: 75 })).toBe(true);
      expect(hasAtLeastOneVital({ weight: 68.5 })).toBe(true);
    });
  });

  describe('vitalsFormValidator', () => {
    function createForm() {
      return new FormGroup(
        {
          temperature: new FormControl<number | null>(null),
          heartRate: new FormControl<number | null>(null),
          systolic: new FormControl<number | null>(null),
          diastolic: new FormControl<number | null>(null),
          spo2: new FormControl<number | null>(null),
          weight: new FormControl<number | null>(null),
        },
        { validators: vitalsFormValidator() },
      );
    }

    it('flags error if all fields are empty', () => {
      const form = createForm();
      form.updateValueAndValidity();
      expect(form.errors).toEqual({
        atLeastOneRequired: 'At least one vital measurement is required',
      });
    });

    it('passes if at least one valid measurement is present', () => {
      const form = createForm();
      form.patchValue({ temperature: 37.0 });
      form.updateValueAndValidity();
      expect(form.errors).toBeNull();
      expect(form.valid).toBe(true);
    });

    it('sets field errors if temperature is out of range', () => {
      const form = createForm();
      form.patchValue({ temperature: 50.0 });
      form.updateValueAndValidity();
      expect(form.get('temperature')?.hasError('range')).toBe(true);
      expect(form.valid).toBe(false);
    });

    it('sets error on diastolic if diastolic >= systolic', () => {
      const form = createForm();
      form.patchValue({ systolic: 120, diastolic: 130 });
      form.updateValueAndValidity();
      expect(form.get('diastolic')?.hasError('range')).toBe(true);
      expect(form.valid).toBe(false);
    });
  });

  describe('Consultation rules and permissions', () => {
    const baseConsultation: Consultation = {
      id: 'c-1',
      patientId: 'p-1',
      patientSnapshot: { fullName: 'Jane Doe', birthDate: '1990-01-01' },
      doctorId: 'doc-1',
      status: 'DRAFT',
      createdAt: '2026-10-10T09:00:00Z',
      updatedAt: '2026-10-10T09:00:00Z',
    };

    it('canEditConsultationNotes returns true only for draft consultations owned by the doctor', () => {
      expect(canEditConsultationNotes(baseConsultation, 'doc-1', true)).toBe(true);
      expect(canEditConsultationNotes(baseConsultation, 'doc-2', true)).toBe(false);
      expect(canEditConsultationNotes(baseConsultation, 'doc-1', false)).toBe(false);
      expect(
        canEditConsultationNotes({ ...baseConsultation, status: 'SIGNED' }, 'doc-1', true),
      ).toBe(false);
      expect(canEditConsultationNotes(null, 'doc-1', true)).toBe(false);
    });

    it('canSignConsultation requires editable draft plus non-empty assessment and plan', () => {
      expect(canSignConsultation(baseConsultation, 'doc-1', true, '', '')).toBe(false);
      expect(canSignConsultation(baseConsultation, 'doc-1', true, 'Assessment', '')).toBe(false);
      expect(canSignConsultation(baseConsultation, 'doc-1', true, '', 'Plan')).toBe(false);
      expect(canSignConsultation(baseConsultation, 'doc-1', true, 'Assessment', 'Plan')).toBe(true);
      // Not owner
      expect(canSignConsultation(baseConsultation, 'doc-2', true, 'Assessment', 'Plan')).toBe(
        false,
      );
      // Not draft
      expect(
        canSignConsultation(
          { ...baseConsultation, status: 'SIGNED' },
          'doc-1',
          true,
          'Assessment',
          'Plan',
        ),
      ).toBe(false);
    });

    it('checks roles for vitals, prescribing, and ordering lab', () => {
      expect(canRecordVitals((r) => r === 'DOCTOR')).toBe(true);
      expect(canRecordVitals((r) => r === 'NURSE')).toBe(true);
      expect(canRecordVitals((r) => r === 'ADMIN')).toBe(false);

      expect(canPrescribe((r) => r === 'DOCTOR')).toBe(true);
      expect(canPrescribe((r) => r === 'NURSE')).toBe(false);

      expect(canOrderLab((r) => r === 'DOCTOR')).toBe(true);
      expect(canOrderLab((r) => r === 'NURSE')).toBe(false);
    });

    it('has 6 fallback catalogue tests', () => {
      expect(FALLBACK_CATALOGUE_TESTS).toHaveLength(6);
      expect(FALLBACK_CATALOGUE_TESTS.map((t) => t.code)).toEqual([
        'HGB',
        'WBC',
        'GLU',
        'CHOL',
        'CRE',
        'K',
      ]);
    });
  });
});
