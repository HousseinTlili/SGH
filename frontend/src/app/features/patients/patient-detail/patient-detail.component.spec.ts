import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { AllergyPassport, Patient } from '../../../core/models/patient';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { PatientDetailComponent } from './patient-detail.component';

const patient: Patient = {
  id: 'p1',
  firstName: 'Youssef',
  lastName: 'Ben Salah',
  birthDate: '1985-03-14',
  gender: 'MALE',
  allergies: 'Penicillin',
  createdAt: '2026-10-12T08:00:00Z',
  updatedAt: '2026-10-12T08:00:00Z',
};

const passport: AllergyPassport = {
  patientId: 'p1',
  passportToken: 'c0ffeeee-0000-4000-8000-000000000001',
  fullName: 'Youssef Ben Salah',
  birthDate: '1985-03-14',
  allergies: [],
  generatedAt: '2026-11-10T12:00:00Z',
};

describe('PatientDetailComponent allergy passport', () => {
  it('loads the secure passport and keeps the immediate legacy warning visible', async () => {
    const patientApi = {
      get: vi.fn().mockReturnValue(of(patient)),
      allergyPassport: vi.fn().mockReturnValue(of(passport)),
    };
    await TestBed.configureTestingModule({
      imports: [PatientDetailComponent],
      providers: [
        { provide: PatientApi, useValue: patientApi },
        { provide: ReceptionApi, useValue: {} },
        { provide: ConsultationApi, useValue: {} },
        { provide: NameLookupService, useValue: {} },
        { provide: AuthService, useValue: { hasRole: vi.fn().mockReturnValue(false) } },
        { provide: ServiceStatusService, useValue: { isUp: vi.fn().mockReturnValue(true) } },
        { provide: ConfirmService, useValue: { confirm: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('p1') } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PatientDetailComponent);
    fixture.detectChanges();

    expect(patientApi.allergyPassport).toHaveBeenCalledWith('p1');
    expect(fixture.nativeElement.textContent).toContain('Allergies:');
    expect(fixture.nativeElement.textContent).toContain('Penicillin');
    expect(fixture.nativeElement.textContent).toContain('Smart Allergy Passport');
  });
});
