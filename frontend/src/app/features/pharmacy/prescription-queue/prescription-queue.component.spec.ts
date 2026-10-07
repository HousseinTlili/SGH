import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideFakeAuth, signInAs } from '../../../../testing/auth';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { PharmacyPrescription } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { PatientPickerComponent } from '../../../shared/components/patient-picker/patient-picker.component';
import { QUEUE_REFRESH_MS, PrescriptionQueueComponent } from './prescription-queue.component';

const rx: PharmacyPrescription = {
  id: 'f8f8f8f8-0000-4000-8000-000000000001',
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

const page = (content: PharmacyPrescription[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
});

function setup(username = 'doctor1', listPrescriptions = vi.fn(() => of(page([rx])))) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideFakeAuth(),
      { provide: PharmacyApi, useValue: { listPrescriptions } },
      {
        provide: NameLookupService,
        useValue: {
          getPatientName: () => of('Hatem Dridi'),
          getDoctorName: () => of('Karim Jlassi'),
        },
      },
    ],
  });
  signInAs(username);
  const fixture = TestBed.createComponent(PrescriptionQueueComponent);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, listPrescriptions, text: () => el.textContent ?? '' };
}

describe('PrescriptionQueueComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('asks for open prescriptions by default and shows names, progress and status', async () => {
    const { fixture, listPrescriptions, text } = setup();
    await fixture.whenStable();
    expect(listPrescriptions).toHaveBeenCalledWith({
      status: 'ISSUED,PARTIALLY_DISPENSED',
      patientId: undefined,
      page: 0,
      size: 20,
    });
    expect(text()).toContain('Hatem Dridi');
    expect(text()).toContain('Karim Jlassi');
    expect(text()).toContain('1 of 2 dispensed');
    expect(text()).toContain('Partially dispensed');
  });

  it('is called "Prescriptions status" for a doctor and "Prescriptions" for the pharmacist', async () => {
    const doctor = setup('doctor1');
    await doctor.fixture.whenStable();
    expect(doctor.el.querySelector('h1')?.textContent).toBe('Prescriptions status');
    TestBed.resetTestingModule();
    const pharmacist = setup('pharmacist1');
    await pharmacist.fixture.whenStable();
    expect(pharmacist.el.querySelector('h1')?.textContent).toBe('Prescriptions');
  });

  it('changing the status filter reloads from the first page', async () => {
    const { fixture, listPrescriptions } = setup();
    await fixture.whenStable();
    (
      fixture.componentInstance as unknown as { statusControl: { setValue(v: string): void } }
    ).statusControl.setValue('ALL');
    expect(listPrescriptions).toHaveBeenLastCalledWith({
      status: undefined,
      patientId: undefined,
      page: 0,
      size: 20,
    });
  });

  it('filters by the chosen patient', async () => {
    const { fixture, listPrescriptions } = setup();
    await fixture.whenStable();
    fixture.debugElement
      .query(By.directive(PatientPickerComponent))
      .componentInstance.selected.emit({
        id: 'p5',
        fullName: 'Hatem Dridi',
        birthDate: '1965-05-18',
      });
    expect(listPrescriptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ patientId: 'p5' }),
    );
  });

  it('opens the prescription of a clicked row', async () => {
    const { fixture } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tr.mat-mdc-row')?.click();
    expect(navigate).toHaveBeenCalledWith(['/pharmacy/prescriptions', rx.id]);
  });

  it('refreshes by itself every 10 seconds, but not while Pharmacy is down or after the page is left', () => {
    vi.useFakeTimers();
    const { fixture, listPrescriptions } = setup();
    fixture.detectChanges();
    expect(listPrescriptions).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(QUEUE_REFRESH_MS);
    expect(listPrescriptions).toHaveBeenCalledTimes(2);

    TestBed.inject(ServiceStatusService).markDown('pharmacy');
    vi.advanceTimersByTime(QUEUE_REFRESH_MS);
    expect(listPrescriptions).toHaveBeenCalledTimes(2);

    TestBed.inject(ServiceStatusService).state.update((s) => ({ ...s, pharmacy: 'UP' }));
    fixture.destroy();
    vi.advanceTimersByTime(QUEUE_REFRESH_MS * 3);
    expect(listPrescriptions).toHaveBeenCalledTimes(2);
  });

  it('shows only the unavailable panel and sends nothing while Pharmacy is down', async () => {
    const { fixture, listPrescriptions, text } = setup();
    TestBed.inject(ServiceStatusService).markDown('pharmacy');
    await fixture.whenStable();
    expect(listPrescriptions).not.toHaveBeenCalled();
    expect(text()).toContain('Pharmacy service is unavailable.');
  });
});
