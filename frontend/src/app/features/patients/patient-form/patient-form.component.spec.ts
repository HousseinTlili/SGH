import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PatientApi } from '../../../core/api/patient.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Patient } from '../../../core/models/patient';
import { PatientFormComponent } from './patient-form.component';

describe('PatientFormComponent', () => {
  let component: PatientFormComponent;
  let fixture: ComponentFixture<PatientFormComponent>;
  let patientApi: Partial<PatientApi>;
  let authService: Partial<AuthService>;
  let router: Partial<Router>;

  const mockPatient: Patient = {
    id: 'a1a1a1a1-0000-4000-8000-000000000001',
    firstName: 'Youssef',
    lastName: 'Ben Salah',
    birthDate: '1985-03-14',
    gender: 'MALE',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  beforeEach(async () => {
    patientApi = {
      get: vi.fn().mockReturnValue(of(mockPatient)),
      create: vi.fn().mockReturnValue(of(mockPatient)),
      update: vi.fn().mockReturnValue(of(mockPatient)),
    };
    authService = {
      hasRole: vi.fn().mockReturnValue(true),
    };
    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PatientFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PatientApi, useValue: patientApi },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue(null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes form with invalid state when empty', () => {
    expect(component.form.valid).toBe(false);
  });

  it('marks valid when required fields are supplied', () => {
    component.form.patchValue({
      firstName: 'Youssef',
      lastName: 'Ben Salah',
      birthDate: '1985-03-14',
      gender: 'MALE',
    });
    expect(component.form.valid).toBe(true);
  });

  it('handles 409 conflict duplicate response at form level', () => {
    component.form.patchValue({
      firstName: 'Youssef',
      lastName: 'Ben Salah',
      birthDate: '1985-03-14',
      gender: 'MALE',
    });

    const error409 = new HttpErrorResponse({
      status: 409,
      error: {
        status: 409,
        error: 'Conflict',
        message: 'A patient with the same name and birth date already exists',
      },
    });

    patientApi.create = vi.fn().mockReturnValue(throwError(() => error409));

    component.onSubmit();

    expect(component.form.errors?.['server']).toBe(
      'A patient with the same name and birth date already exists',
    );
  });

  it('handles 422 validation response and maps fields', () => {
    component.form.patchValue({
      firstName: 'Youssef',
      lastName: 'Ben Salah',
      birthDate: '1985-03-14',
      gender: 'MALE',
    });

    const error422 = new HttpErrorResponse({
      status: 422,
      error: {
        status: 422,
        error: 'Unprocessable Entity',
        message: 'Validation failed',
        details: [{ field: 'birthDate', problem: 'Must not be in the future' }],
      },
    });

    patientApi.create = vi.fn().mockReturnValue(throwError(() => error422));

    component.onSubmit();

    expect(component.form.get('birthDate')?.errors?.['server']).toBe('Must not be in the future');
  });
});
