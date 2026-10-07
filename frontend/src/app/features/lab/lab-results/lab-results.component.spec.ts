import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LabApi } from '../../../core/api/lab.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { LabResultRow } from '../../../core/models/lab';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { PatientPickerComponent } from '../../../shared/components/patient-picker/patient-picker.component';
import { LabResultsComponent } from './lab-results.component';

const row = (testCode: string, flag: LabResultRow['flag'], value: number): LabResultRow => ({
  labRequestId: 'f9f9f9f9-0000-4000-8000-000000000001',
  patientId: 'a1a1a1a1-0000-4000-8000-000000000005',
  testCode,
  value,
  unit: '10^9/L',
  referenceRange: '4.0-11.0',
  flag,
  validatedAt: '2026-10-10T15:00:00Z',
});

const page = (content: LabResultRow[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
});

function setup(
  listResults = vi.fn(() => of(page([row('WBC', 'HIGH', 12.5), row('HGB', 'NORMAL', 14.2)]))),
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LabApi, useValue: { listResults } },
      { provide: NameLookupService, useValue: { getPatientName: () => of('Hatem Dridi') } },
    ],
  });
  const fixture = TestBed.createComponent(LabResultsComponent);
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  return { fixture, listResults, text, status: TestBed.inject(ServiceStatusService) };
}

describe('LabResultsComponent', () => {
  it('lists validated results with patient name, value, range and a flag with text', async () => {
    const { fixture, listResults, text } = setup();
    await fixture.whenStable();
    expect(listResults).toHaveBeenCalledWith(undefined, 0, 20);
    expect(text()).toContain('Hatem Dridi');
    expect(text()).toContain('WBC');
    expect(text()).toContain('12.5 10^9/L');
    expect(text()).toContain('4.0-11.0');
    expect(text()).toContain('High');
    expect(text()).toContain('Normal');
  });

  it('opens the lab request of a clicked row', async () => {
    const { fixture } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tr.mat-mdc-row')?.click();
    expect(navigate).toHaveBeenCalledWith([
      '/lab/requests',
      'f9f9f9f9-0000-4000-8000-000000000001',
    ]);
  });

  it('reloads for one patient when the patient filter changes, and for all when it is cleared', async () => {
    const { fixture, listResults } = setup();
    await fixture.whenStable();
    const picker = fixture.debugElement.query(By.directive(PatientPickerComponent));
    picker.componentInstance.selected.emit({
      id: 'p5',
      fullName: 'Hatem Dridi',
      birthDate: '1965-05-18',
    });
    expect(listResults).toHaveBeenLastCalledWith('p5', 0, 20);
    picker.componentInstance.selected.emit(null);
    expect(listResults).toHaveBeenLastCalledWith(undefined, 0, 20);
  });

  it('shows an empty state when there is nothing validated', async () => {
    const { fixture, text } = setup(vi.fn(() => of(page([]))));
    await fixture.whenStable();
    expect(text()).toContain('No validated results');
  });

  it('shows the error state with a working retry when loading fails', async () => {
    const failing = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(page([row('HGB', 'NORMAL', 14.2)])));
    const { fixture, text } = setup(failing);
    await fixture.whenStable();
    expect(text()).toContain('Something went wrong');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('app-error-state button')
      ?.click();
    await fixture.whenStable();
    expect(text()).toContain('HGB');
    expect(text()).not.toContain('Something went wrong');
  });

  it('while Lab is down it shows only the unavailable panel and sends no request, then loads on recovery', async () => {
    const { fixture, listResults, text, status } = setup();
    status.markDown('lab');
    await fixture.whenStable();
    expect(text()).toContain('Lab service is unavailable.');
    expect(listResults).not.toHaveBeenCalled();

    status.state.update((s) => ({ ...s, lab: 'UP' }));
    await fixture.whenStable();
    expect(listResults).toHaveBeenCalledOnce();
    expect(text()).toContain('WBC');
  });
});
