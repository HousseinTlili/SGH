import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { StaffApi } from '../../../core/api/staff.api';
import type { AuthUser } from '../../../core/auth/auth-backend';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Consultation } from '../../../core/models/consultation';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConsultationListComponent } from './consultation-list.component';

describe('ConsultationListComponent', () => {
  let component: ConsultationListComponent;
  let fixture: ComponentFixture<ConsultationListComponent>;
  let consultationApi: Partial<ConsultationApi>;
  let patientApi: Partial<PatientApi>;
  let staffApi: Partial<StaffApi>;
  let authService: Partial<AuthService>;
  let serviceStatus: Partial<ServiceStatusService>;
  let nameLookup: Partial<NameLookupService>;
  let router: Partial<Router>;

  const mockConsultation: Consultation = {
    id: 'c-1',
    patientId: 'p-1',
    patientSnapshot: { fullName: 'Nizar Khelifi', birthDate: '1978-11-02' },
    doctorId: 'doc-1',
    status: 'DRAFT',
    assessment: 'Atypical chest pain',
    createdAt: '2026-10-12T08:35:00Z',
    updatedAt: '2026-10-12T08:35:00Z',
  };

  beforeEach(async () => {
    consultationApi = {
      list: vi.fn().mockReturnValue(
        of({
          content: [mockConsultation],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 20,
        }),
      ),
    };
    patientApi = {
      list: vi
        .fn()
        .mockReturnValue(of({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 10 })),
    };
    staffApi = {
      directory: vi.fn().mockReturnValue(
        of([
          {
            id: 'doc-1',
            fullName: 'Amel Trabelsi',
            role: 'DOCTOR',
          },
        ]),
      ),
    };
    authService = {
      hasRole: vi.fn().mockImplementation((r: string) => r === 'DOCTOR'),
      user: signal<AuthUser | null>({
        username: 'doctor1',
        staffId: 'doc-1',
        roles: ['DOCTOR'],
      }),
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
      imports: [ConsultationListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: consultationApi },
        { provide: PatientApi, useValue: patientApi },
        { provide: StaffApi, useValue: staffApi },
        { provide: AuthService, useValue: authService },
        { provide: ServiceStatusService, useValue: serviceStatus },
        { provide: NameLookupService, useValue: nameLookup },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsultationListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads consultations and defaults doctor filter to current user for DOCTOR', () => {
    expect(staffApi.directory).toHaveBeenCalledWith('DOCTOR');
    expect(component['filterForm'].controls.doctorId.value).toBe('doc-1');
    expect(consultationApi.list).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: 'doc-1',
      }),
    );
    expect(component['consultations']().length).toBe(1);
  });

  it('navigates to consultation workspace on row click', () => {
    component.openConsultation(mockConsultation);
    expect(router.navigate).toHaveBeenCalledWith(['/consultations', 'c-1']);
  });

  it('truncates long assessments to 60 characters', () => {
    const short = component.truncateAssessment('Short assessment');
    expect(short).toBe('Short assessment');

    const long = 'A'.repeat(80);
    const truncated = component.truncateAssessment(long);
    expect(truncated.length).toBe(61); // 60 chars + ellipsis
    expect(truncated.endsWith('…')).toBe(true);
  });
});
