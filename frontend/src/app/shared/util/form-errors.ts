import type { AbstractControl, FormGroup } from '@angular/forms';
import type { ApiError } from '../../core/models/common';

/** Error key set on controls and on the form for problems reported by the server. */
export const SERVER_ERROR = 'server';

/**
 * Maps a 422 body onto a reactive form: details[field] goes to the control with that name,
 * everything else (unknown fields, or a body without details) becomes a form-level error.
 */
export function applyApiErrors(form: FormGroup, apiError: ApiError): void {
  let formLevel = false;
  for (const detail of apiError.details ?? []) {
    const control = form.get(detail.field);
    if (control) {
      control.setErrors({ ...control.errors, [SERVER_ERROR]: detail.problem });
      control.markAsTouched();
    } else {
      formLevel = true;
    }
  }
  if (formLevel || !apiError.details?.length) {
    form.setErrors({ ...form.errors, [SERVER_ERROR]: apiError.message });
  }
}

/** Clears server errors once the user edits a field again, so the form can be re-submitted. */
export function clearServerErrors(form: FormGroup): void {
  const strip = (control: AbstractControl) => {
    if (control.errors && SERVER_ERROR in control.errors) {
      const rest = { ...control.errors };
      delete rest[SERVER_ERROR];
      control.setErrors(Object.keys(rest).length ? rest : null);
    }
  };
  strip(form);
  Object.values(form.controls).forEach(strip);
}

/** Message for the first validation error of a control, or null when it is valid. */
export function fieldErrorMessage(control: AbstractControl | null): string | null {
  const errors = control?.errors;
  if (!errors) {
    return null;
  }
  if (typeof errors[SERVER_ERROR] === 'string') {
    return errors[SERVER_ERROR] as string;
  }
  if (errors['required']) {
    return 'This field is required';
  }
  if (errors['email']) {
    return 'Enter a valid e-mail address';
  }
  if (errors['maxlength']) {
    return `At most ${(errors['maxlength'] as { requiredLength: number }).requiredLength} characters`;
  }
  if (errors['minlength']) {
    return `At least ${(errors['minlength'] as { requiredLength: number }).requiredLength} characters`;
  }
  if (errors['min']) {
    return `Must be at least ${(errors['min'] as { min: number }).min}`;
  }
  if (errors['max']) {
    return `Must be at most ${(errors['max'] as { max: number }).max}`;
  }
  if (errors['pattern']) {
    return 'Invalid format';
  }
  if (errors['futureDate']) {
    return 'Must not be in the future';
  }
  return 'Invalid value';
}
