import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Invoice } from '../../../core/models/reception';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { InvoiceDetailComponent } from './invoice-detail.component';

describe('InvoiceDetailComponent', () => {
  let component: InvoiceDetailComponent;
  let fixture: ComponentFixture<InvoiceDetailComponent>;
  let receptionApi: Partial<ReceptionApi>;
  let authService: Partial<AuthService>;
  let dialog: Partial<MatDialog>;
  let confirmService: Partial<ConfirmService>;

  const mockPendingInvoice: Invoice = {
    id: 'e6e6e6e6-0000-4000-8000-000000000002',
    patientId: 'a1a1a1a1-0000-4000-8000-000000000003',
    lines: [{ description: 'Cardiology consultation', quantity: 1, unitPrice: 70 }],
    total: 70,
    currency: 'TND',
    status: 'PENDING',
    createdAt: '2026-10-12T09:15:00Z',
  };

  const mockPaidInvoice: Invoice = {
    ...mockPendingInvoice,
    status: 'PAID',
    paymentMethod: 'CASH',
    paidAt: '2026-10-12T10:00:00Z',
  };

  beforeEach(async () => {
    receptionApi = {
      getInvoice: vi.fn().mockReturnValue(of(mockPendingInvoice)),
      payInvoice: vi.fn().mockReturnValue(of(mockPaidInvoice)),
      cancelInvoice: vi.fn().mockReturnValue(of({ ...mockPendingInvoice, status: 'CANCELLED' })),
    };
    authService = {
      hasRole: vi.fn().mockReturnValue(true),
    };
    dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of('CASH')),
      }),
    };
    confirmService = {
      confirm: vi.fn().mockReturnValue(of(true)),
    };

    await TestBed.configureTestingModule({
      imports: [InvoiceDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReceptionApi, useValue: receptionApi },
        { provide: AuthService, useValue: authService },
        { provide: MatDialog, useValue: dialog },
        { provide: ConfirmService, useValue: confirmService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('e6e6e6e6-0000-4000-8000-000000000002'),
              },
            },
          },
        },
        {
          provide: NameLookupService,
          useValue: {
            getPatientName: vi.fn().mockReturnValue(of('Nizar Khelifi')),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads invoice and enables pay/cancel actions for PENDING status', () => {
    expect(component.invoice()).toEqual(mockPendingInvoice);
    expect(component.canPay()).toBe(true);
    expect(component.canCancel()).toBe(true);
  });

  it('marks invoice paid when confirmed via dialog', () => {
    component.onPay();
    expect(dialog.open).toHaveBeenCalled();
    expect(receptionApi.payInvoice).toHaveBeenCalledWith(
      'e6e6e6e6-0000-4000-8000-000000000002',
      'CASH',
    );
    expect(component.invoice()?.status).toBe('PAID');
  });

  it('cancels invoice when confirmed', () => {
    component.onCancelInvoice();
    expect(confirmService.confirm).toHaveBeenCalled();
    expect(receptionApi.cancelInvoice).toHaveBeenCalledWith('e6e6e6e6-0000-4000-8000-000000000002');
    expect(component.invoice()?.status).toBe('CANCELLED');
  });
});
