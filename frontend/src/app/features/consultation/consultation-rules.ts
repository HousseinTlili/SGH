import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { Role } from '../../core/models/common';
import type { Consultation, LabTestRef } from '../../core/models/consultation';

export const FALLBACK_CATALOGUE_TESTS: readonly LabTestRef[] = [
  { code: 'HGB', name: 'Hemoglobin' },
  { code: 'WBC', name: 'White blood cells' },
  { code: 'GLU', name: 'Fasting glucose' },
  { code: 'CHOL', name: 'Total cholesterol' },
  { code: 'CRE', name: 'Creatinine' },
  { code: 'K', name: 'Potassium' },
];

export const VITALS_RANGES = {
  temperature: { min: 30.0, max: 45.0, unit: '°C' },
  heartRate: { min: 20, max: 250, unit: 'bpm' },
  systolic: { min: 50, max: 260, unit: 'mmHg' },
  diastolic: { min: 30, max: 160, unit: 'mmHg' },
  spo2: { min: 50, max: 100, unit: '%' },
  weight: { min: 0.5, max: 400.0, unit: 'kg' },
} as const;

export interface VitalSignsFormValues {
  temperature?: number | null;
  heartRate?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  spo2?: number | null;
  weight?: number | null;
}

export function validateTemperature(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (val < VITALS_RANGES.temperature.min || val > VITALS_RANGES.temperature.max) {
    return `Temperature must be between ${VITALS_RANGES.temperature.min} and ${VITALS_RANGES.temperature.max} °C`;
  }
  return null;
}

export function validateHeartRate(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (val < VITALS_RANGES.heartRate.min || val > VITALS_RANGES.heartRate.max) {
    return `Heart rate must be between ${VITALS_RANGES.heartRate.min} and ${VITALS_RANGES.heartRate.max} bpm`;
  }
  return null;
}

export function validateSystolic(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (val < VITALS_RANGES.systolic.min || val > VITALS_RANGES.systolic.max) {
    return `Systolic BP must be between ${VITALS_RANGES.systolic.min} and ${VITALS_RANGES.systolic.max} mmHg`;
  }
  return null;
}

export function validateDiastolic(
  val: number | null | undefined,
  systolic?: number | null | undefined,
): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (val < VITALS_RANGES.diastolic.min || val > VITALS_RANGES.diastolic.max) {
    return `Diastolic BP must be between ${VITALS_RANGES.diastolic.min} and ${VITALS_RANGES.diastolic.max} mmHg`;
  }
  if (systolic !== null && systolic !== undefined && !isNaN(systolic) && val >= systolic) {
    return 'Diastolic BP must be strictly lower than systolic BP';
  }
  return null;
}

export function validateSpo2(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (val < VITALS_RANGES.spo2.min || val > VITALS_RANGES.spo2.max) {
    return `SpO2 must be between ${VITALS_RANGES.spo2.min} and ${VITALS_RANGES.spo2.max} %`;
  }
  return null;
}

export function validateWeight(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (val < VITALS_RANGES.weight.min || val > VITALS_RANGES.weight.max) {
    return `Weight must be between ${VITALS_RANGES.weight.min} and ${VITALS_RANGES.weight.max} kg`;
  }
  return null;
}

export function hasAtLeastOneVital(values: VitalSignsFormValues): boolean {
  const fields: (keyof VitalSignsFormValues)[] = [
    'temperature',
    'heartRate',
    'systolic',
    'diastolic',
    'spo2',
    'weight',
  ];
  return fields.some((k) => {
    const v = values[k];
    return v !== null && v !== undefined && v !== ('' as unknown) && !isNaN(v as number);
  });
}

/** Form-level validator for vital signs form. */
export function vitalsFormValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const tempCtrl = group.get('temperature');
    const hrCtrl = group.get('heartRate');
    const sysCtrl = group.get('systolic');
    const diaCtrl = group.get('diastolic');
    const spo2Ctrl = group.get('spo2');
    const weightCtrl = group.get('weight');

    const rawValues: VitalSignsFormValues = {
      temperature:
        tempCtrl?.value !== '' && tempCtrl?.value !== null ? Number(tempCtrl?.value) : null,
      heartRate: hrCtrl?.value !== '' && hrCtrl?.value !== null ? Number(hrCtrl?.value) : null,
      systolic: sysCtrl?.value !== '' && sysCtrl?.value !== null ? Number(sysCtrl?.value) : null,
      diastolic: diaCtrl?.value !== '' && diaCtrl?.value !== null ? Number(diaCtrl?.value) : null,
      spo2: spo2Ctrl?.value !== '' && spo2Ctrl?.value !== null ? Number(spo2Ctrl?.value) : null,
      weight:
        weightCtrl?.value !== '' && weightCtrl?.value !== null ? Number(weightCtrl?.value) : null,
    };

    let hasFieldError = false;

    // Check temperature
    if (rawValues.temperature !== null) {
      const err = validateTemperature(rawValues.temperature);
      if (err) {
        tempCtrl?.setErrors({ ...tempCtrl?.errors, range: err });
        hasFieldError = true;
      } else if (tempCtrl?.hasError('range')) {
        const errors = { ...tempCtrl?.errors };
        delete errors['range'];
        tempCtrl?.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    // Check heart rate
    if (rawValues.heartRate !== null) {
      const err = validateHeartRate(rawValues.heartRate);
      if (err) {
        hrCtrl?.setErrors({ ...hrCtrl?.errors, range: err });
        hasFieldError = true;
      } else if (hrCtrl?.hasError('range')) {
        const errors = { ...hrCtrl?.errors };
        delete errors['range'];
        hrCtrl?.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    // Check systolic
    if (rawValues.systolic !== null) {
      const err = validateSystolic(rawValues.systolic);
      if (err) {
        sysCtrl?.setErrors({ ...sysCtrl?.errors, range: err });
        hasFieldError = true;
      } else if (sysCtrl?.hasError('range')) {
        const errors = { ...sysCtrl?.errors };
        delete errors['range'];
        sysCtrl?.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    // Check diastolic (and relation to systolic)
    if (rawValues.diastolic !== null) {
      const err = validateDiastolic(rawValues.diastolic, rawValues.systolic);
      if (err) {
        diaCtrl?.setErrors({ ...diaCtrl?.errors, range: err });
        hasFieldError = true;
      } else if (diaCtrl?.hasError('range')) {
        const errors = { ...diaCtrl?.errors };
        delete errors['range'];
        diaCtrl?.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    // Check spo2
    if (rawValues.spo2 !== null) {
      const err = validateSpo2(rawValues.spo2);
      if (err) {
        spo2Ctrl?.setErrors({ ...spo2Ctrl?.errors, range: err });
        hasFieldError = true;
      } else if (spo2Ctrl?.hasError('range')) {
        const errors = { ...spo2Ctrl?.errors };
        delete errors['range'];
        spo2Ctrl?.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    // Check weight
    if (rawValues.weight !== null) {
      const err = validateWeight(rawValues.weight);
      if (err) {
        weightCtrl?.setErrors({ ...weightCtrl?.errors, range: err });
        hasFieldError = true;
      } else if (weightCtrl?.hasError('range')) {
        const errors = { ...weightCtrl?.errors };
        delete errors['range'];
        weightCtrl?.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }

    if (!hasAtLeastOneVital(rawValues)) {
      return { atLeastOneRequired: 'At least one vital measurement is required' };
    }

    return hasFieldError ? { invalidVitals: true } : null;
  };
}

export function canEditConsultationNotes(
  consultation: Consultation | null,
  userStaffId?: string | null,
  isDoctor?: boolean,
): boolean {
  if (!consultation || consultation.status !== 'DRAFT') {
    return false;
  }
  if (!isDoctor) {
    return false;
  }
  return Boolean(userStaffId && consultation.doctorId === userStaffId);
}

export function canSignConsultation(
  consultation: Consultation | null,
  userStaffId?: string | null,
  isDoctor?: boolean,
  assessment?: string | null,
  plan?: string | null,
): boolean {
  if (!canEditConsultationNotes(consultation, userStaffId, isDoctor)) {
    return false;
  }
  const hasAssessment = Boolean(assessment && assessment.trim().length > 0);
  const hasPlan = Boolean(plan && plan.trim().length > 0);
  return hasAssessment && hasPlan;
}

export function canRecordVitals(hasRole: (role: Role) => boolean): boolean {
  return hasRole('DOCTOR') || hasRole('NURSE');
}

export function canPrescribe(hasRole: (role: Role) => boolean): boolean {
  return hasRole('DOCTOR');
}

export function canOrderLab(hasRole: (role: Role) => boolean): boolean {
  return hasRole('DOCTOR');
}
