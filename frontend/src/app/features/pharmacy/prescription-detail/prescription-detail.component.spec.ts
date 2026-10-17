import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Dispensing, PharmacyPrescription } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { PrescriptionDetailComponent } from './prescription-detail.component';

const ID = 'f8f8f8f8-0000-4000-8000-000000000001';

const rx: PharmacyPrescription = {
  id: ID,
  consultationId: 'f7f7f7f7-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000005',
  doctorId: 'b2b2b2b2-0000-4000-8000-000000000002',
  status: 'PARTIALLY_DISPENSED',
  items: [
    {
      index: 0,
      drugName: 'Paracetamol 500 mg',
      dosage: '1 tablet',
      frequency: '3 per day',
      duration: '5 days',
      dispensed: true,
    },
    {
      index: 1,
      drugName: 'Cetirizine 10 mg',
      dosage: '1 tablet',
      frequency: '1 per day',
      duration: '7 days',
      dispensed: false,
    },
  ],
  createdAt: '2026-10-10T11:35:00Z',
};

const history: Dispensing[] = [
  {
    id: 'disp-1',
    prescriptionId: ID,
    pharmacistId: 'b2b2b2b2-0000-4000-8000-000000000005',
    lines: [{ itemIndex: 0, drugId: 'd4d4d4d4-0000-4000-8000-000000000001', quantity: 15 }],
    dispensedAt: '2026-10-12T10:00:00Z',
  },
];

function setup(
  api: Partial<Record<'getPrescription' | 'getDispensings', ReturnType<typeof vi.fn>>> = {},
) {
  const pharmacy = {
    getPrescription: vi.fn(() => of(rx)),
    getDispensings: vi.fn(() => of(history)),
    ...api,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } },
      },
      { provide: PharmacyApi, useValue: pharmacy },
      {
        provide: NameLookupService,
        useValue: {
          getPatientName: () => of('Hatem Dridi'),
          getDoctorName: () => of('Karim Jlassi'),
          getStaffMember: () => of({ id: 'x', fullName: 'Ines Chaabane', role: 'PHARMACIST' }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(PrescriptionDetailComponent);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, pharmacy, text: () => el.textContent ?? '' };
}

describe('PrescriptionDetailComponent', () => {
  it('shows who, when, status and the progress', async () => {
    const { fixture, pharmacy, text } = setup();
    await fixture.whenStable();
    expect(pharmacy.getPrescription).toHaveBeenCalledWith(ID);
    expect(text()).toContain('Hatem Dridi');
    expect(text()).toContain('Karim Jlassi');
    expect(text()).toContain('Partially dispensed');
    expect(text()).toContain('1 of 2 dispensed');
  });

  it('lists the items as written by the doctor, each with a dispensed state in words', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    const rows = Array.from(el.querySelectorAll('table[aria-label="Prescription items"] tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Paracetamol 500 mg');
    expect(rows[0].textContent).toContain('Dispensed');
    expect(rows[1].textContent).toContain('Cetirizine 10 mg');
    expect(rows[1].textContent).toContain('Waiting');
  });

  it('shows the dispensing history with the pharmacist and what was handed out', async () => {
    const { fixture, text } = setup();
    await fixture.whenStable();
    expect(text()).toContain('Ines Chaabane');
    expect(text()).toContain('Paracetamol 500 mg × 15');
  });

  it('says nothing was dispensed when the history is empty', async () => {
    const { fixture, text } = setup({ getDispensings: vi.fn(() => of([])) });
    await fixture.whenStable();
    expect(text()).toContain('Nothing dispensed yet');
  });

  it('keeps the items on screen when only the history fails, and can retry it', async () => {
    const getDispensings = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(history));
    const { fixture, el, text } = setup({ getDispensings });
    await fixture.whenStable();
    expect(text()).toContain('Cetirizine 10 mg');
    expect(text()).toContain('dispensing history is unavailable');
    el.querySelector<HTMLElement>('.notice button')?.click();
    await fixture.whenStable();
    expect(text()).toContain('Ines Chaabane');
  });

  it('shows the error state with retry when the prescription is unknown', async () => {
    const getPrescription = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })))
      .mockReturnValue(of(rx));
    const { fixture, el, text } = setup({ getPrescription });
    await fixture.whenStable();
    expect(text()).toContain('Something went wrong');
    el.querySelector<HTMLElement>('app-error-state button')?.click();
    await fixture.whenStable();
    expect(text()).toContain('Hatem Dridi');
  });

  it('sends no request while Pharmacy is down', async () => {
    const { fixture, pharmacy, text } = setup();
    TestBed.inject(ServiceStatusService).markDown('pharmacy');
    await fixture.whenStable();
    expect(pharmacy.getPrescription).not.toHaveBeenCalled();
    expect(text()).toContain('Pharmacy service is unavailable.');
  });
});
