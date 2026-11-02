import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth, signInAs } from '../../../../testing/auth';
import { ReceptionApi } from '../../../core/api/reception.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Appointment } from '../../../core/models/reception';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { MyAppointmentsComponent } from './my-appointments.component';

const sampleAppointment: Appointment = {
  id: 'c3c3c3c3-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
  patientVerified: true,
  doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
  startAt: '2026-10-10T09:00:00Z',
  endAt: '2026-10-10T09:30:00Z',
  status: 'SCHEDULED',
  reason: 'Follow-up check',
  createdAt: '2026-10-09T10:00:00Z',
  updatedAt: '2026-10-09T10:00:00Z',
};

describe('MyAppointmentsComponent', () => {
  let apiSpy: {
    listAppointments: ReturnType<typeof vi.fn>;
    cancelAppointment: ReturnType<typeof vi.fn>;
  };
  let nameSpy: { getDoctorName: ReturnType<typeof vi.fn> };
  let statusSpy: { isUp: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      listAppointments: vi.fn().mockReturnValue(
        of({
          content: [sampleAppointment],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      cancelAppointment: vi.fn().mockReturnValue(of(sampleAppointment)),
    };
    nameSpy = { getDoctorName: vi.fn().mockReturnValue(of('Dr. House')) };
    statusSpy = { isUp: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      imports: [MyAppointmentsComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReceptionApi, useValue: apiSpy },
        { provide: NameLookupService, useValue: nameSpy },
        { provide: ServiceStatusService, useValue: statusSpy },
      ],
    }).compileComponents();

    signInAs('patient1');
  });

  it('loads and displays patient appointments', () => {
    const fixture = TestBed.createComponent(MyAppointmentsComponent);
    fixture.detectChanges();

    expect(apiSpy.listAppointments).toHaveBeenCalled();
    const rows = fixture.componentInstance['rows']();
    expect(rows.length).toBe(1);
    expect(rows[0].doctorName).toBe('Dr. House');
    expect(rows[0].status).toBe('SCHEDULED');
  });
});
