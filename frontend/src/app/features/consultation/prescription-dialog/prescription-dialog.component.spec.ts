import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import type { Prescription } from '../../../core/models/consultation';
import { PrescriptionDialogComponent } from './prescription-dialog.component';

describe('PrescriptionDialogComponent', () => {
  let component: PrescriptionDialogComponent;
  let fixture: ComponentFixture<PrescriptionDialogComponent>;
  let consultationApi: Partial<ConsultationApi>;
  let dialogRef: Partial<MatDialogRef<PrescriptionDialogComponent>>;

  const mockPrescription: Prescription = {
    id: 'pr-1',
    consultationId: 'c-1',
    patientId: 'p-1',
    doctorId: 'doc-1',
    status: 'ISSUED',
    items: [
      {
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        duration: '7 days',
      },
    ],
    createdAt: '2026-10-12T09:00:00Z',
  };

  beforeEach(async () => {
    consultationApi = {
      createPrescription: vi.fn().mockReturnValue(of(mockPrescription)),
    };
    dialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PrescriptionDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: consultationApi },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { consultationId: 'c-1' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrescriptionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with 1 empty row and invalid state', () => {
    expect(component['itemsArray'].length).toBe(1);
    expect(component['form'].valid).toBe(false);
  });

  it('can add and remove medication rows within limits (1 to 20)', () => {
    component.addItem();
    expect(component['itemsArray'].length).toBe(2);

    component.removeItem(1);
    expect(component['itemsArray'].length).toBe(1);

    // cannot remove the only row
    component.removeItem(0);
    expect(component['itemsArray'].length).toBe(1);
  });

  it('submits prescription and closes dialog with result', () => {
    component['itemsArray'].at(0).patchValue({
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: '3 times daily',
      duration: '7 days',
    });
    fixture.detectChanges();

    expect(component['form'].valid).toBe(true);

    component.onSubmit();

    expect(consultationApi.createPrescription).toHaveBeenCalledWith('c-1', [
      {
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        duration: '7 days',
      },
    ]);
    expect(dialogRef.close).toHaveBeenCalledWith(mockPrescription);
  });
});
