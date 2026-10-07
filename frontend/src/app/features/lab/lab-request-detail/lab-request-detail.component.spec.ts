import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LabApi } from '../../../core/api/lab.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { LabRequest } from '../../../core/models/lab';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { LabRequestDetailComponent } from './lab-request-detail.component';

const ID = 'f9f9f9f9-0000-4000-8000-000000000001';

const request = (over: Partial<LabRequest> = {}): LabRequest => ({
  id: ID,
  consultationId: 'f7f7f7f7-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000005',
  doctorId: 'b2b2b2b2-0000-4000-8000-000000000002',
  priority: 'ROUTINE',
  status: 'VALIDATED',
  tests: [
    { code: 'HGB', name: 'Hemoglobin' },
    { code: 'WBC', name: 'White blood cells' },
  ],
  results: [
    { testCode: 'HGB', value: 14.2, unit: 'g/dL', referenceRange: '12.0-17.0', flag: 'NORMAL' },
    { testCode: 'WBC', value: 12.5, unit: '10^9/L', referenceRange: '4.0-11.0', flag: 'HIGH' },
  ],
  requestedAt: '2026-10-10T11:30:00Z',
  startedAt: '2026-10-10T13:00:00Z',
  validatedAt: '2026-10-10T15:00:00Z',
  ...over,
});

function setup(getRequest = vi.fn(() => of(request()))) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } },
      },
      { provide: LabApi, useValue: { getRequest } },
      {
        provide: NameLookupService,
        useValue: {
          getPatientName: () => of('Hatem Dridi'),
          getDoctorName: () => of('Karim Jlassi'),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(LabRequestDetailComponent);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, getRequest, text: () => el.textContent ?? '' };
}

const stepStates = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.stepper .step')).map((s) => s.getAttribute('data-state'));

describe('LabRequestDetailComponent', () => {
  it('loads the request by the id in the address and shows who, what and when', async () => {
    const { fixture, getRequest, text } = setup();
    await fixture.whenStable();
    expect(getRequest).toHaveBeenCalledWith(ID);
    expect(text()).toContain('Hatem Dridi');
    expect(text()).toContain('Karim Jlassi');
    expect(text()).toContain('HGB (Hemoglobin)');
    expect(text()).toContain('Validated');
  });

  it('shows every step as done for a validated request', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    expect(stepStates(el)).toEqual(['done', 'done', 'done', 'done']);
  });

  it('marks the current step for a request still being processed (and says it is not final)', async () => {
    const { fixture, el, text } = setup(
      vi.fn(() => of(request({ status: 'IN_PROGRESS', results: [], validatedAt: null }))),
    );
    await fixture.whenStable();
    expect(stepStates(el)).toEqual(['done', 'current', 'todo', 'todo']);
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('In progress');
    expect(text()).toContain('not validated this request yet');
    expect(text()).toContain('No results yet');
  });

  it('lists results with flag text, and warns about critical values', async () => {
    const critical = request({
      results: [
        { testCode: 'K', value: 6.8, unit: 'mmol/L', referenceRange: '3.5-5.1', flag: 'CRITICAL' },
      ],
    });
    const { fixture, el, text } = setup(vi.fn(() => of(critical)));
    await fixture.whenStable();
    expect(text()).toContain('6.8 mmol/L');
    expect(text()).toContain('Critical');
    expect(el.querySelector('.critical-banner')?.textContent).toContain('1 critical value');
    expect(el.querySelector('tr.critical')).not.toBeNull();
  });

  it('has no critical banner when everything is within limits', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    expect(el.querySelector('.critical-banner')).toBeNull();
  });

  it('shows an error with a retry when the request cannot be loaded', async () => {
    const failing = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })))
      .mockReturnValue(of(request()));
    const { fixture, el, text } = setup(failing);
    await fixture.whenStable();
    expect(text()).toContain('Something went wrong');
    el.querySelector<HTMLElement>('app-error-state button')?.click();
    await fixture.whenStable();
    expect(text()).toContain('Hatem Dridi');
  });

  it('sends no request while Lab is down', async () => {
    const { fixture, getRequest, text } = setup();
    TestBed.inject(ServiceStatusService).markDown('lab');
    await fixture.whenStable();
    expect(getRequest).not.toHaveBeenCalled();
    expect(text()).toContain('Lab service is unavailable.');
  });
});
