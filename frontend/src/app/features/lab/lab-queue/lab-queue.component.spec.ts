import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth } from '../../../../testing/auth';
import { LabApi } from '../../../core/api/lab.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { LabRequest } from '../../../core/models/lab';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { LabQueueComponent } from './lab-queue.component';

const sampleRequest: LabRequest = {
  id: 'f9f9f9f9-0000-4000-8000-000000000001',
  consultationId: 'f7f7f7f7-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
  doctorId: 'b2b2b2b2-0000-4000-8000-000000000001',
  priority: 'URGENT',
  status: 'REQUESTED',
  tests: [{ code: 'GLU', name: 'Glucose' }],
  results: [],
  requestedAt: '2026-10-10T10:00:00Z',
  startedAt: null,
  validatedAt: null,
};

describe('LabQueueComponent', () => {
  let apiSpy: { listRequests: ReturnType<typeof vi.fn> };
  let nameSpy: {
    getPatientName: ReturnType<typeof vi.fn>;
    getDoctorName: ReturnType<typeof vi.fn>;
  };
  let statusSpy: { isUp: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      listRequests: vi.fn().mockReturnValue(
        of({
          content: [sampleRequest],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    };
    nameSpy = {
      getPatientName: vi.fn().mockReturnValue(of('Alice Dupont')),
      getDoctorName: vi.fn().mockReturnValue(of('Dr. House')),
    };
    statusSpy = {
      isUp: vi.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [LabQueueComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LabApi, useValue: apiSpy },
        { provide: NameLookupService, useValue: nameSpy },
        { provide: ServiceStatusService, useValue: statusSpy },
      ],
    }).compileComponents();
  });

  it('loads lab requests and formats table rows', () => {
    const fixture = TestBed.createComponent(LabQueueComponent);
    fixture.detectChanges();

    expect(apiSpy.listRequests).toHaveBeenCalled();
    const rows = fixture.componentInstance['rows']();
    expect(rows.length).toBe(1);
    expect(rows[0].patientName).toBe('Alice Dupont');
    expect(rows[0].doctorName).toBe('Dr. House');
    expect(rows[0].priority).toBe('URGENT');
    expect(rows[0].testsFormatted).toBe('GLU');
  });
});
