import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppointmentListComponent } from './appointment-list.component';
import { ReceptionApi } from '../../../core/api/reception.api';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import type { Appointment } from '../../../core/models/reception';

describe('AppointmentListComponent', () => {
  let fixture: ComponentFixture<AppointmentListComponent>;
  let component: AppointmentListComponent;

  const mockAppointments: Appointment[] = [
    {
      id: 'appt-1',
      patientId: 'pat-1',
      patientVerified: true,
      doctorId: 'doc-1',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 30 * 60000).toISOString(),
      reason: 'Routine Cardiology Follow-up',
      status: 'CHECKED_IN',
      cancelReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'appt-2',
      patientId: 'pat-2',
      patientVerified: true,
      doctorId: 'doc-1',
      startAt: new Date(Date.now() + 60 * 60000).toISOString(),
      endAt: new Date(Date.now() + 90 * 60000).toISOString(),
      reason: 'Chest pain review',
      status: 'SCHEDULED',
      cancelReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ReceptionApi,
          useValue: {
            listAppointments: () => of({ content: mockAppointments, totalElements: 2 }),
            checkInAppointment: () => of({}),
            completeAppointment: () => of({}),
            cancelAppointment: () => of({}),
          },
        },
        {
          provide: ConsultationApi,
          useValue: {
            create: () => of({ id: 'cons-1' }),
          },
        },
        {
          provide: StaffApi,
          useValue: {
            directory: () => of([]),
          },
        },
        {
          provide: AuthService,
          useValue: {
            hasRole: (role: string) => role === 'DOCTOR',
            roles: () => ['DOCTOR'],
            user: () => ({ staffId: 'doc-1', username: 'doctor1' }),
            isAuthenticated: () => true,
          },
        },
        {
          provide: ServiceStatusService,
          useValue: {
            isUp: () => true,
            statusOf: () => 'UP',
            gateway: () => 'UP',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with default day view mode and loads appointments', () => {
    expect(component.viewMode()).toBe('day');
    expect(component.allLoadedAppointments().length).toBe(2);
  });

  it('switches between view modes (day, week, month, table)', () => {
    component.setViewMode('week');
    expect(component.viewMode()).toBe('week');

    component.setViewMode('month');
    expect(component.viewMode()).toBe('month');

    component.setViewMode('table');
    expect(component.viewMode()).toBe('table');
  });

  it('navigates previous and next periods cleanly', () => {
    const originalDate = new Date(component.selectedDate());
    component.goToNext();
    expect(component.selectedDate().getTime()).toBeGreaterThan(originalDate.getTime());

    component.goToPrevious();
    expect(component.selectedDate().getDate()).toBe(originalDate.getDate());
  });

  it('identifies checked-in patients ready for consultation on the agenda', () => {
    expect(component.checkedInPatient()).not.toBeNull();
    expect(component.checkedInPatient()?.id).toBe('appt-1');
  });
});
