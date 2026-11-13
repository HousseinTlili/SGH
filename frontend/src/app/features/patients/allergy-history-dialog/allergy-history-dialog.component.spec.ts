import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PatientApi } from '../../../core/api/patient.api';
import type { PatientAllergy } from '../../../core/models/patient';
import { AllergyHistoryDialogComponent } from './allergy-history-dialog.component';

const allergy: PatientAllergy = {
  id: 'a1',
  patientId: 'p1',
  allergen: 'Penicillin',
  category: 'MEDICATION',
  clinicalStatus: 'ACTIVE',
  verificationStatus: 'CONFIRMED',
  criticality: 'HIGH',
  version: 1,
  recordedByUsername: 'doctor1',
  recordedByRole: 'DOCTOR',
  createdAt: '2026-11-10T12:00:00Z',
  updatedAt: '2026-11-10T12:00:00Z',
};

describe('AllergyHistoryDialogComponent', () => {
  it('loads and displays immutable audit metadata', async () => {
    const api = {
      allergyHistory: vi.fn().mockReturnValue(
        of([
          {
            id: 'h1',
            allergyId: 'a1',
            patientId: 'p1',
            action: 'CONFIRM',
            afterSnapshot: { verificationStatus: 'CONFIRMED' },
            changedByUsername: 'doctor1',
            changedByRole: 'DOCTOR',
            correlationId: 'abc12345',
            changedAt: '2026-11-10T12:00:00Z',
          },
        ]),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [AllergyHistoryDialogComponent],
      providers: [
        { provide: PatientApi, useValue: api },
        { provide: MAT_DIALOG_DATA, useValue: { patientId: 'p1', allergy } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AllergyHistoryDialogComponent);
    fixture.detectChanges();
    expect(api.allergyHistory).toHaveBeenCalledWith('p1', 'a1');
    expect(fixture.nativeElement.textContent).toContain('CONFIRM');
    expect(fixture.nativeElement.textContent).toContain('doctor1');
    expect(fixture.nativeElement.textContent).toContain('abc12345');
  });
});
