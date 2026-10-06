import { FormControl, FormGroup, Validators } from '@angular/forms';
import { SERVER_ERROR, applyApiErrors, clearServerErrors, fieldErrorMessage } from './form-errors';
import { clampPaging, emptyPage, toHttpParams } from './paging';

function patientForm() {
  return new FormGroup({
    firstName: new FormControl('', [Validators.required, Validators.maxLength(80)]),
    birthDate: new FormControl(''),
    email: new FormControl('', [Validators.email]),
  });
}

describe('applyApiErrors (422 details onto controls)', () => {
  it('puts each problem on the control with that field name', () => {
    const form = patientForm();
    applyApiErrors(form, {
      status: 422,
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      details: [{ field: 'birthDate', problem: 'must not be in the future' }],
    });
    expect(form.controls.birthDate.errors?.[SERVER_ERROR]).toBe('must not be in the future');
    expect(form.controls.birthDate.touched).toBe(true);
    expect(form.errors).toBeNull();
  });

  it('a field the form does not have becomes a form-level error', () => {
    const form = patientForm();
    applyApiErrors(form, {
      status: 422,
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      details: [{ field: 'patientId', problem: 'patient not found' }],
    });
    expect(form.errors?.[SERVER_ERROR]).toBe('Validation failed');
  });

  it('a body without details (for example a 409) becomes a form-level error with its message', () => {
    const form = patientForm();
    applyApiErrors(form, { status: 409, error: 'Conflict', message: 'Duplicate patient' });
    expect(form.errors?.[SERVER_ERROR]).toBe('Duplicate patient');
  });

  it('keeps other validation errors on the control', () => {
    const form = patientForm();
    form.controls.firstName.setValue('');
    form.controls.firstName.updateValueAndValidity();
    applyApiErrors(form, {
      status: 422,
      error: 'x',
      message: 'm',
      details: [{ field: 'firstName', problem: 'server says no' }],
    });
    expect(form.controls.firstName.errors).toMatchObject({
      required: true,
      [SERVER_ERROR]: 'server says no',
    });
  });

  it('clearServerErrors removes only the server errors', () => {
    const form = patientForm();
    applyApiErrors(form, {
      status: 422,
      error: 'x',
      message: 'm',
      details: [{ field: 'birthDate', problem: 'bad' }],
    });
    clearServerErrors(form);
    expect(form.controls.birthDate.errors).toBeNull();
  });
});

describe('fieldErrorMessage', () => {
  it('is null for a valid or missing control', () => {
    expect(fieldErrorMessage(null)).toBeNull();
    expect(fieldErrorMessage(new FormControl('ok'))).toBeNull();
  });

  it('describes the common validators', () => {
    expect(fieldErrorMessage(new FormControl('', Validators.required))).toBe(
      'This field is required',
    );
    const long = new FormControl('x'.repeat(81), Validators.maxLength(80));
    expect(fieldErrorMessage(long)).toBe('At most 80 characters');
    expect(fieldErrorMessage(new FormControl('nope', Validators.email))).toBe(
      'Enter a valid e-mail address',
    );
    expect(fieldErrorMessage(new FormControl(0, Validators.min(1)))).toBe('Must be at least 1');
    expect(fieldErrorMessage(new FormControl('abc', Validators.pattern(/^\d+$/)))).toBe(
      'Invalid format',
    );
  });

  it('shows the server message first', () => {
    const control = new FormControl('', Validators.required);
    control.setErrors({ required: true, [SERVER_ERROR]: 'must not be in the future' });
    expect(fieldErrorMessage(control)).toBe('must not be in the future');
  });
});

describe('paging helpers', () => {
  it('emptyPage matches the paged response shape', () => {
    expect(emptyPage()).toEqual({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
  });

  it('clampPaging keeps page >= 0 and size between 1 and 100', () => {
    expect(clampPaging(-3, 500)).toEqual({ page: 0, size: 100 });
    expect(clampPaging(2.7, 0)).toEqual({ page: 2, size: 1 });
  });

  it('toHttpParams leaves out empty filters', () => {
    const params = toHttpParams({
      search: 'ben',
      status: '',
      page: 0,
      doctorId: null,
      size: undefined,
      open: false,
    });
    expect(params.keys().sort()).toEqual(['open', 'page', 'search']);
    expect(params.get('page')).toBe('0');
    expect(params.get('open')).toBe('false');
  });
});
