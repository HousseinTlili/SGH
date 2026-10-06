import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import type { AuthUser } from '../../../core/auth/auth-backend';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Consultation } from '../../../core/models/consultation';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { ConsultationWorkspaceComponent } from './consultation-workspace.component';

describe('ConsultationWorkspaceComponent', () => {
  let component: ConsultationWorkspaceComponent;
  let fixture: ComponentFixture<ConsultationWorkspaceComponent>;
  let consultationApi: Partial<ConsultationApi>;
  let patientApi: Partial<PatientApi>;
  let pharmacyApi: Partial<PharmacyApi>;
  let authService: Partial<AuthService>;
  let confirmService: Partial<ConfirmService>;
  let serviceStatus: Partial<ServiceStatusService>;
  let nameLookup: Partial<NameLookupService>;
  let router: Partial<Router>;

  const mockConsultation: Consultation = {
    id: 'c-1',
    patientId: 'p-1',
    patientSnapshot: { fullName: 'Nizar Khelifi', birthDate: '1978-11-02' },
    doctorId: 'doc-1',
    status: 'DRAFT',
    subjective: 'Chest discomfort',
    objective: 'Normal breath sounds',
    assessment: 'Atypical chest pain',
    plan: 'Prescribed basic relief',
    signedAt: null,
    createdAt: '2026-10-12T08:35:00Z',
    updatedAt: '2026-10-12T08:35:00Z',
  };

  beforeEach(async () => {
    consultationApi = {
      get: vi.fn().mockReturnValue(of(mockConsultation)),
      updateNotes: vi.fn().mockReturnValue(of(mockConsultation)),
      sign: vi.fn().mockReturnValue(of({ ...mockConsultation, status: 'SIGNED' })),
      listVitals: vi.fn().mockReturnValue(of({ content: [], totalElements: 0, page: 0, size: 20 })),
      getPrescriptions: vi.fn().mockReturnValue(of([])),
      getLabOrders: vi.fn().mockReturnValue(of([])),
      getLabResults: vi.fn().mockReturnValue(of([])),
    };
    patientApi = {
      get: vi.fn().mockReturnValue(
        of({
          id: 'p-1',
          firstName: 'Nizar',
          lastName: 'Khelifi',
          birthDate: '1978-11-02',
          allergies: 'Penicillin',
        }),
      ),
    };
    pharmacyApi = {
      getPrescription: vi.fn().mockReturnValue(of({ status: 'ISSUED' })),
    };
    authService = {
      hasRole: vi.fn().mockImplementation((r: string) => r === 'DOCTOR'),
      user: signal<AuthUser | null>({
        username: 'doctor1',
        staffId: 'doc-1',
        roles: ['DOCTOR'],
      }),
    };
    confirmService = {
      confirm: vi.fn().mockReturnValue(of(true)),
    };
    serviceStatus = {
      isUp: vi.fn().mockReturnValue(true),
    };
    nameLookup = {
      getDoctorName: vi.fn().mockReturnValue(of('Dr. Amel Trabelsi')),
      getPatientName: vi.fn().mockReturnValue(of('Nizar Khelifi')),
    };
    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConsultationWorkspaceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: consultationApi },
        { provide: PatientApi, useValue: patientApi },
        { provide: PharmacyApi, useValue: pharmacyApi },
        { provide: AuthService, useValue: authService },
        { provide: ConfirmService, useValue: confirmService },
        { provide: ServiceStatusService, useValue: serviceStatus },
        { provide: NameLookupService, useValue: nameLookup },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'c-1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsultationWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads consultation data and initializes SOAP form', () => {
    expect(consultationApi.get).toHaveBeenCalledWith('c-1');
    expect(component.consultation()?.id).toBe('c-1');
    expect(component['soapForm'].controls.assessment.value).toBe('Atypical chest pain');
    expect(component['isEditable']()).toBe(true);
    expect(component['canSign']()).toBe(true);
  });

  it('saves draft SOAP notes', () => {
    component['soapForm'].patchValue({
      assessment: 'Updated assessment',
      plan: 'Updated plan',
    });
    component.onSaveDraft();

    expect(consultationApi.updateNotes).toHaveBeenCalledWith('c-1', {
      subjective: 'Chest discomfort',
      objective: 'Normal breath sounds',
      assessment: 'Updated assessment',
      plan: 'Updated plan',
    });
  });

  it('signs consultation after confirmation', () => {
    component.onSign();

    expect(confirmService.confirm).toHaveBeenCalled();
    expect(consultationApi.sign).toHaveBeenCalledWith('c-1');
  });
});
