import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { PatientApi } from '../../../core/api/patient.api';
import type { PatientStatistics } from '../../../core/models/patient';
import { PatientStatisticsComponent } from './patient-statistics.component';

const sample: PatientStatistics = {
  period: { from: '2025-11-10', to: '2026-11-10', preset: 'LAST_12_MONTHS' },
  activePatients: 8,
  newRegistrations: 8,
  averageAge: 40.8,
  incompleteFiles: 0,
  registrationsByMonth: [
    { month: '2026-10', count: 8 },
    { month: '2026-11', count: 0 },
  ],
  ageGroups: [
    { name: '0-17', count: 0 },
    { name: '18-35', count: 3 },
    { name: '36-60', count: 4 },
    { name: '60+', count: 1 },
  ],
  genders: [
    { name: 'MALE', count: 4 },
    { name: 'FEMALE', count: 4 },
    { name: 'OTHER', count: 0 },
  ],
  completeness: { complete: 8, incomplete: 0 },
};

describe('PatientStatisticsComponent', () => {
  let fixture: ComponentFixture<PatientStatisticsComponent>;
  let api: { statistics: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = { statistics: vi.fn().mockReturnValue(of(sample)) };

    await TestBed.configureTestingModule({
      imports: [PatientStatisticsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PatientApi, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientStatisticsComponent);
    fixture.detectChanges();
  });

  it('loads default statistics on init', () => {
    expect(api.statistics).toHaveBeenCalled();
    expect(fixture.componentInstance.stats()?.activePatients).toBe(8);
    expect(fixture.componentInstance.monthBars().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Active patients');
    expect(fixture.nativeElement.textContent).toContain('8');
  });

  it('does not call the API for CUSTOM without dates', () => {
    api.statistics.mockClear();
    fixture.componentInstance.filterForm.patchValue({ period: 'CUSTOM', from: '', to: '' });
    fixture.componentInstance.load();
    expect(api.statistics).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('custom period');
  });
});
