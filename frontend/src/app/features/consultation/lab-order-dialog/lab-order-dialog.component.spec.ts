import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { LabApi } from '../../../core/api/lab.api';
import type { LabOrder } from '../../../core/models/consultation';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { LabOrderDialogComponent } from './lab-order-dialog.component';

describe('LabOrderDialogComponent', () => {
  let component: LabOrderDialogComponent;
  let fixture: ComponentFixture<LabOrderDialogComponent>;
  let consultationApi: Partial<ConsultationApi>;
  let labApi: Partial<LabApi>;
  let serviceStatus: Partial<ServiceStatusService>;
  let dialogRef: Partial<MatDialogRef<LabOrderDialogComponent>>;

  const mockOrder: LabOrder = {
    id: 'lo-1',
    consultationId: 'c-1',
    patientId: 'p-1',
    doctorId: 'doc-1',
    priority: 'ROUTINE',
    status: 'REQUESTED',
    tests: [{ code: 'HGB', name: 'Hemoglobin' }],
    createdAt: '2026-10-12T09:00:00Z',
  };

  beforeEach(async () => {
    consultationApi = {
      createLabOrder: vi.fn().mockReturnValue(of(mockOrder)),
    };
    labApi = {
      getTests: vi.fn().mockReturnValue(
        of([
          {
            code: 'HGB',
            name: 'Hemoglobin',
            unit: 'g/dL',
            refLow: 12,
            refHigh: 17.5,
          },
        ]),
      ),
    };
    serviceStatus = {
      isUp: vi.fn().mockReturnValue(true),
    };
    dialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LabOrderDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: consultationApi },
        { provide: LabApi, useValue: labApi },
        { provide: ServiceStatusService, useValue: serviceStatus },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { consultationId: 'c-1' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LabOrderDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with test catalogue and invalid form (no tests selected)', () => {
    expect(component['availableTests']().length).toBeGreaterThan(0);
    expect(component['form'].valid).toBe(false);
  });

  it('submits lab order successfully', () => {
    component['form'].patchValue({
      priority: 'ROUTINE',
      tests: [{ code: 'HGB', name: 'Hemoglobin' }],
    });
    fixture.detectChanges();

    expect(component['form'].valid).toBe(true);

    component.onSubmit();

    expect(consultationApi.createLabOrder).toHaveBeenCalledWith('c-1', {
      priority: 'ROUTINE',
      tests: [{ code: 'HGB', name: 'Hemoglobin' }],
    });
    expect(dialogRef.close).toHaveBeenCalledWith(mockOrder);
  });

  it('falls back to built-in catalogue when lab is down', () => {
    serviceStatus.isUp = vi.fn().mockReturnValue(false);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component['labDown']()).toBe(true);
    expect(component['availableTests']().length).toBe(6);
  });
});
