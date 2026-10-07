import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PatientApi } from '../../../core/api/patient.api';
import type { Patient, PatientSummary } from '../../../core/models/patient';
import { PatientPickerComponent } from './patient-picker.component';

const patient = (id: string, firstName: string, lastName: string): Patient => ({
  id,
  firstName,
  lastName,
  birthDate: '1965-05-18',
  gender: 'MALE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});

const page = (content: Patient[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
});

function setup(list = vi.fn(() => of(page([patient('p5', 'Hatem', 'Dridi')])))) {
  TestBed.configureTestingModule({ providers: [{ provide: PatientApi, useValue: { list } }] });
  const fixture = TestBed.createComponent(PatientPickerComponent);
  const emitted: (PatientSummary | null)[] = [];
  fixture.componentInstance.selected.subscribe((p) => emitted.push(p));
  const el = fixture.nativeElement as HTMLElement;
  const overlay = TestBed.inject(OverlayContainer).getContainerElement();
  return { fixture, list, emitted, el, overlay, control: fixture.componentInstance.control };
}

async function openPanel(fixture: ReturnType<typeof setup>['fixture']) {
  await fixture.whenStable();
  const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  input.focus();
  input.dispatchEvent(new Event('focusin'));
  await fixture.whenStable();
}

describe('PatientPickerComponent', () => {
  afterEach(() => TestBed.inject(OverlayContainer).ngOnDestroy());

  it('searches after a pause once at least 2 letters are typed', async () => {
    const { fixture, list, control } = setup();
    await fixture.whenStable();
    control.setValue('h');
    await new Promise((r) => setTimeout(r, 450));
    expect(list).not.toHaveBeenCalled();
    control.setValue('hat');
    await vi.waitFor(() => expect(list).toHaveBeenCalledWith('hat', 0, 10));
    expect(list).toHaveBeenCalledOnce();
  });

  it('offers the matches and emits the chosen patient', async () => {
    const { fixture, list, control, emitted, overlay } = setup();
    await openPanel(fixture);
    control.setValue('hat');
    await vi.waitFor(() => expect(list).toHaveBeenCalled());
    await openPanel(fixture);
    await vi.waitFor(() => expect(overlay.textContent).toContain('Hatem Dridi'));
    (overlay.querySelector('mat-option') as HTMLElement).click();
    await fixture.whenStable();
    expect(emitted).toEqual([{ id: 'p5', fullName: 'Hatem Dridi', birthDate: '1965-05-18' }]);
  });

  it('clear() empties the box and emits null', async () => {
    const { fixture, control, emitted } = setup();
    await fixture.whenStable();
    control.setValue('hat');
    fixture.componentInstance.clear();
    expect(control.value).toBe('');
    expect(emitted).toEqual([null]);
  });

  it('says so when patient search fails', async () => {
    const list = vi.fn(() => throwError(() => new Error('down')));
    const { fixture, control, el } = setup(list);
    await fixture.whenStable();
    control.setValue('hat');
    await vi.waitFor(() => expect(list).toHaveBeenCalled());
    await fixture.whenStable();
    expect(el.textContent).toContain('Patient search is unavailable');
  });
});
