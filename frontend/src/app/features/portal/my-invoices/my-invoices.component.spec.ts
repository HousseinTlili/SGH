import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth, signInAs } from '../../../../testing/auth';
import { ReceptionApi } from '../../../core/api/reception.api';
import type { Invoice } from '../../../core/models/reception';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { MyInvoicesComponent } from './my-invoices.component';

const sampleInvoice: Invoice = {
  id: 'e5e5e5e5-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000001',
  appointmentId: 'c3c3c3c3-0000-4000-8000-000000000001',
  total: 60,
  currency: 'TND',
  status: 'PENDING',
  paymentMethod: null,
  lines: [{ description: 'General Consultation', quantity: 1, unitPrice: 60 }],
  createdAt: '2026-10-10T10:00:00Z',
  paidAt: null,
};

describe('MyInvoicesComponent', () => {
  let apiSpy: {
    listInvoices: ReturnType<typeof vi.fn>;
    payInvoice: ReturnType<typeof vi.fn>;
  };
  let statusSpy: { isUp: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      listInvoices: vi.fn().mockReturnValue(
        of({
          content: [sampleInvoice],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      payInvoice: vi.fn().mockReturnValue(of({ ...sampleInvoice, status: 'PAID' })),
    };
    statusSpy = { isUp: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      imports: [MyInvoicesComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReceptionApi, useValue: apiSpy },
        { provide: ServiceStatusService, useValue: statusSpy },
      ],
    }).compileComponents();

    signInAs('patient1');
  });

  it('loads and displays patient invoices', () => {
    const fixture = TestBed.createComponent(MyInvoicesComponent);
    fixture.detectChanges();

    expect(apiSpy.listInvoices).toHaveBeenCalled();
    const rows = fixture.componentInstance['rows']();
    expect(rows.length).toBe(1);
    expect(rows[0].total).toBe(60);
    expect(rows[0].status).toBe('PENDING');
  });
});
