import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth, signInAs } from '../../../../testing/auth';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Consultation } from '../../../core/models/consultation';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { MyConsultationsComponent } from './my-consultations.component';

const sampleConsultation: Consultation = {
  id: 'f7f7f7f7-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
  doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
  appointmentId: 'c3c3c3c3-0000-4000-8000-000000000001',
  status: 'SIGNED',
  subjective: 'Mild headache',
  objective: 'BP normal',
  assessment: 'Tension headache',
  plan: 'Rest and hydration',
  signedAt: '2026-10-10T10:30:00Z',
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:30:00Z',
  patientSnapshot: {
    fullName: 'Alice Dupont',
    birthDate: '1990-01-01',
  },
};

describe('MyConsultationsComponent', () => {
  let apiSpy: { list: ReturnType<typeof vi.fn> };
  let nameSpy: { getDoctorName: ReturnType<typeof vi.fn> };
  let statusSpy: { isUp: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      list: vi.fn().mockReturnValue(
        of({
          content: [sampleConsultation],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    };
    nameSpy = { getDoctorName: vi.fn().mockReturnValue(of('Dr. House')) };
    statusSpy = { isUp: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      imports: [MyConsultationsComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: apiSpy },
        { provide: NameLookupService, useValue: nameSpy },
        { provide: ServiceStatusService, useValue: statusSpy },
      ],
    }).compileComponents();

    signInAs('patient1');
  });

  it('loads and displays patient consultations', () => {
    const fixture = TestBed.createComponent(MyConsultationsComponent);
    fixture.detectChanges();

    expect(apiSpy.list).toHaveBeenCalled();
    const rows = fixture.componentInstance['rows']();
    expect(rows.length).toBe(1);
    expect(rows[0].doctorName).toBe('Dr. House');
    expect(rows[0].status).toBe('SIGNED');
  });
});
