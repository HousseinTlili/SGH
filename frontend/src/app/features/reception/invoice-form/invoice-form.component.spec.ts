import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Invoice } from '../../../core/models/reception';
import { InvoiceFormComponent } from './invoice-form.component';

describe('InvoiceFormComponent', () => {
  let component: InvoiceFormComponent;
  let fixture: ComponentFixture<InvoiceFormComponent>;
  let receptionApi: Partial<ReceptionApi>;
  let patientApi: Partial<PatientApi>;
  let authService: Partial<AuthService>;
  let router: Partial<Router>;

  const mockInvoice: Invoice = {
    id: 'e6e6e6e6-0000-4000-8000-000000000001',
    patientId: 'a1a1a1a1-0000-4000-8000-000000000005',
    lines: [{ description: 'General consultation', quantity: 1, unitPrice: 50 }],
    total: 50,
    currency: 'TND',
    status: 'PENDING',
    createdAt: '2026-10-10T11:45:00Z',
  };

  beforeEach(async () => {
    receptionApi = {
      createInvoice: vi.fn().mockReturnValue(of(mockInvoice)),
      listAppointments: vi.fn().mockReturnValue(of({ content: [] })),
    };
    patientApi = {
      list: vi.fn().mockReturnValue(of({ content: [] })),
    };
    authService = {
      hasRole: vi.fn().mockReturnValue(true),
    };
    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InvoiceFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReceptionApi, useValue: receptionApi },
        { provide: PatientApi, useValue: patientApi },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('manages line items dynamically and computes live total', () => {
    expect(component.linesArray.length).toBe(1);

    component.linesArray.at(0).patchValue({
      description: 'Consultation',
      quantity: 1,
      unitPrice: 50,
    });
    component.updateLiveTotal();
    expect(component.liveTotal()).toBe(50);

    // Add second line
    component.addLine();
    expect(component.linesArray.length).toBe(2);

    component.linesArray.at(1).patchValue({
      description: 'Blood test',
      quantity: 2,
      unitPrice: 15.5,
    });
    component.updateLiveTotal();
    expect(component.liveTotal()).toBe(81);

    // Remove first line
    component.removeLine(0);
    expect(component.linesArray.length).toBe(1);
    expect(component.liveTotal()).toBe(31);
  });

  it('submits invoice lines without sending computed total in payload', () => {
    component.form.controls.patientId.setValue('a1a1a1a1-0000-4000-8000-000000000005');
    component.linesArray.at(0).patchValue({
      description: 'General consultation',
      quantity: 1,
      unitPrice: 50,
    });

    component.onSubmit();

    expect(receptionApi.createInvoice).toHaveBeenCalledWith({
      patientId: 'a1a1a1a1-0000-4000-8000-000000000005',
      appointmentId: undefined,
      lines: [
        {
          description: 'General consultation',
          quantity: 1,
          unitPrice: 50,
        },
      ],
    });
  });
});
