import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { VitalSigns } from '../../../core/models/consultation';
import type { PatientSummary } from '../../../core/models/patient';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { VitalsPageComponent } from './vitals-page.component';

describe('VitalsPageComponent', () => {
  let component: VitalsPageComponent;
  let fixture: ComponentFixture<VitalsPageComponent>;
  let consultationApi: Partial<ConsultationApi>;
  let patientApi: Partial<PatientApi>;
  let serviceStatus: Partial<ServiceStatusService>;
  let nameLookup: Partial<NameLookupService>;

  const mockVital: VitalSigns = {
    id: 'v-1',
    patientId: 'p-1',
    consultationId: null,
    recordedBy: 'nurse-1',
    temperature: 36.8,
    heartRate: 70,
    systolic: 118,
    diastolic: 76,
    spo2: 99,
    weight: 75,
    recordedAt: '2026-10-12T08:00:00Z',
  };

  const mockPatient: PatientSummary = {
    id: 'p-1',
    fullName: 'Nizar Khelifi',
    birthDate: '1978-11-02',
  };

  beforeEach(async () => {
    consultationApi = {
      listVitals: vi.fn().mockReturnValue(
        of({
          content: [mockVital],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 20,
        }),
      ),
      recordVitals: vi.fn().mockReturnValue(of(mockVital)),
    };
    patientApi = {
      list: vi.fn().mockReturnValue(
        of({
          content: [
            {
              id: 'p-1',
              firstName: 'Nizar',
              lastName: 'Khelifi',
              birthDate: '1978-11-02',
              gender: 'MALE',
            },
          ],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        }),
      ),
    };
    serviceStatus = {
      isUp: vi.fn().mockReturnValue(true),
    };
    nameLookup = {
      getDoctorName: vi.fn().mockReturnValue(of('Sonia Gharbi')),
      getPatientName: vi.fn().mockReturnValue(of('Nizar Khelifi')),
    };

    await TestBed.configureTestingModule({
      imports: [VitalsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: consultationApi },
        { provide: PatientApi, useValue: patientApi },
        { provide: ServiceStatusService, useValue: serviceStatus },
        { provide: NameLookupService, useValue: nameLookup },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VitalsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with no selected patient', () => {
    expect(component['selectedPatient']()).toBeNull();
  });

  it('loads vitals history when a patient is selected', () => {
    component.onPatientSelected(mockPatient);
    fixture.detectChanges();

    expect(component['selectedPatient']()).toEqual(mockPatient);
    expect(consultationApi.listVitals).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'p-1',
      }),
    );
    expect(component['vitalsList']().length).toBe(1);
  });

  it('clears patient and resets history', () => {
    component.onPatientSelected(mockPatient);
    component.clearPatient();

    expect(component['selectedPatient']()).toBeNull();
    expect(component['vitalsList']().length).toBe(0);
  });
});
