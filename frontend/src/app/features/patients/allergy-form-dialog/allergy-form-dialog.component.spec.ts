import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PatientApi } from '../../../core/api/patient.api';
import type { PatientAllergy } from '../../../core/models/patient';
import { AllergyFormDialogComponent } from './allergy-form-dialog.component';

const created: PatientAllergy = {
  id: 'a1',
  patientId: 'p1',
  allergen: 'Latex',
  category: 'ENVIRONMENT',
  clinicalStatus: 'ACTIVE',
  verificationStatus: 'DECLARED',
  criticality: 'UNABLE_TO_ASSESS',
  version: 0,
  recordedByUsername: 'reception1',
  recordedByRole: 'RECEPTIONIST',
  createdAt: '2026-11-10T12:00:00Z',
  updatedAt: '2026-11-10T12:00:00Z',
};

describe('AllergyFormDialogComponent', () => {
  it('submits a typed structured allergy', async () => {
    const api = { createAllergy: vi.fn().mockReturnValue(of(created)) };
    const dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AllergyFormDialogComponent],
      providers: [
        { provide: PatientApi, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { patientId: 'p1' } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AllergyFormDialogComponent);
    fixture.componentInstance.form.patchValue({
      allergen: 'Latex',
      category: 'ENVIRONMENT',
      clinicalStatus: 'ACTIVE',
      criticality: 'UNABLE_TO_ASSESS',
    });
    fixture.componentInstance.submit();

    expect(api.createAllergy).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        allergen: 'Latex',
        category: 'ENVIRONMENT',
        version: 0,
      }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith(created);
  });
});
