import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Appointment, Availability } from '../../../core/models/reception';
import { AppointmentFormComponent } from './appointment-form.component';

describe('AppointmentFormComponent', () => {
  let component: AppointmentFormComponent;
  let fixture: ComponentFixture<AppointmentFormComponent>;
  let receptionApi: Partial<ReceptionApi>;
  let patientApi: Partial<PatientApi>;
  let staffApi: Partial<StaffApi>;
  let authService: Partial<AuthService>;
  let router: Partial<Router>;

  const mockAvailability: Availability = {
    doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
    date: '2026-10-13',
    slots: [
      {
        startAt: '2026-10-13T09:00:00Z',
        endAt: '2026-10-13T09:30:00Z',
        available: true,
      },
      {
        startAt: '2026-10-13T09:30:00Z',
        endAt: '2026-10-13T10:00:00Z',
        available: false,
      },
    ],
  };

  const mockAppointment: Appointment = {
    id: 'e5e5e5e5-0000-4000-8000-000000000001',
    patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
    patientVerified: true,
    doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
    startAt: '2026-10-13T09:00:00Z',
    endAt: '2026-10-13T09:30:00Z',
    reason: 'Cardiology follow-up',
    status: 'SCHEDULED',
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-10T08:00:00Z',
  };

  beforeEach(async () => {
    receptionApi = {
      getAppointment: vi.fn().mockReturnValue(of(mockAppointment)),
      createAppointment: vi.fn().mockReturnValue(of(mockAppointment)),
      updateAppointment: vi.fn().mockReturnValue(of(mockAppointment)),
      getAvailability: vi.fn().mockReturnValue(of(mockAvailability)),
    };
    patientApi = {
      get: vi.fn().mockReturnValue(of({ firstName: 'Youssef', lastName: 'Ben Salah' })),
      list: vi.fn().mockReturnValue(of({ content: [] })),
      summary: vi.fn().mockReturnValue(of({ fullName: 'Youssef Ben Salah' })),
    };
    staffApi = {
      directory: vi.fn().mockReturnValue(of([])),
    };
    authService = {
      hasRole: vi.fn().mockReturnValue(true),
    };
    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppointmentFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReceptionApi, useValue: receptionApi },
        { provide: PatientApi, useValue: patientApi },
        { provide: StaffApi, useValue: staffApi },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: vi.fn().mockReturnValue(null) },
              queryParamMap: { get: vi.fn().mockReturnValue(null) },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes invalid when empty', () => {
    expect(component.form.valid).toBe(false);
  });

  it('loads availability slots and allows selecting available slot', () => {
    component.form.patchValue({
      doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
      date: '2026-10-13',
    });
    component.loadAvailability();

    expect(component.slots().length).toBe(2);
    expect(component.slots()[0].available).toBe(true);

    component.onSelectSlot(component.slots()[0]);
    expect(component.selectedSlotStart()).toBe('2026-10-13T09:00:00Z');

    // Selecting taken slot is ignored
    component.onSelectSlot(component.slots()[1]);
    expect(component.selectedSlotStart()).toBe('2026-10-13T09:00:00Z');
  });

  it('handles 409 conflict error on submit and refreshes availability slots', () => {
    component.form.patchValue({
      patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
      doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
      date: '2026-10-13',
      duration: 30,
      reason: 'General checkup',
    });
    component.selectedSlotStart.set('2026-10-13T09:00:00Z');

    const error409 = new HttpErrorResponse({
      status: 409,
      error: {
        status: 409,
        error: 'Conflict',
        message: 'This doctor already has an appointment at that time',
      },
    });

    receptionApi.createAppointment = vi.fn().mockReturnValue(throwError(() => error409));

    component.onSubmit();

    expect(component.form.errors?.['server']).toBe(
      'This doctor already has an appointment at that time',
    );
    expect(receptionApi.getAvailability).toHaveBeenCalled();
  });
});
