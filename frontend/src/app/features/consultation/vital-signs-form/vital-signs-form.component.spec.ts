import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationApi } from '../../../core/api/consultation.api';
import type { VitalSigns } from '../../../core/models/consultation';
import { VitalSignsFormComponent } from './vital-signs-form.component';

describe('VitalSignsFormComponent', () => {
  let component: VitalSignsFormComponent;
  let fixture: ComponentFixture<VitalSignsFormComponent>;
  let consultationApi: Partial<ConsultationApi>;

  const mockVital: VitalSigns = {
    id: 'v-1',
    patientId: 'p-1',
    consultationId: 'c-1',
    recordedBy: 'doc-1',
    temperature: 37.0,
    heartRate: 72,
    systolic: 120,
    diastolic: 80,
    spo2: 98,
    weight: 70,
    recordedAt: '2026-10-12T09:00:00Z',
  };

  beforeEach(async () => {
    consultationApi = {
      recordVitals: vi.fn().mockReturnValue(of(mockVital)),
    };

    await TestBed.configureTestingModule({
      imports: [VitalSignsFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConsultationApi, useValue: consultationApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VitalSignsFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('patientId', 'p-1');
    fixture.detectChanges();
  });

  it('initializes with invalid state due to no vitals entered', () => {
    expect(component['form'].valid).toBe(false);
  });

  it('submits successfully when valid vitals are entered', () => {
    component['form'].patchValue({
      temperature: 37.0,
      heartRate: 72,
    });
    fixture.detectChanges();

    expect(component['form'].valid).toBe(true);

    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    component.onSubmit();

    expect(consultationApi.recordVitals).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'p-1',
        temperature: 37.0,
        heartRate: 72,
      }),
    );
    expect(savedSpy).toHaveBeenCalledWith(mockVital);
  });
});
