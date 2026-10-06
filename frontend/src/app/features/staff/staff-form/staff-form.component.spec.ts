import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Staff } from '../../../core/models/staff';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { StaffFormComponent } from './staff-form.component';

describe('StaffFormComponent', () => {
  let component: StaffFormComponent;
  let fixture: ComponentFixture<StaffFormComponent>;
  let staffApi: Partial<StaffApi>;
  let authService: Partial<AuthService>;
  let confirmService: Partial<ConfirmService>;
  let router: Partial<Router>;

  const mockStaff: Staff = {
    id: 'b2b2b2b2-0000-4000-8000-000000000001',
    firstName: 'Amel',
    lastName: 'Trabelsi',
    role: 'DOCTOR',
    specialty: 'Cardiology',
    department: 'Cardiology',
    email: 'doctor1@sgh.local',
    active: true,
    keycloakUserId: null,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  beforeEach(async () => {
    staffApi = {
      get: vi.fn().mockReturnValue(of(mockStaff)),
      create: vi.fn().mockReturnValue(of(mockStaff)),
      update: vi.fn().mockReturnValue(of(mockStaff)),
      deactivate: vi.fn().mockReturnValue(of({ ...mockStaff, active: false })),
    };
    authService = {
      hasRole: vi.fn().mockReturnValue(true),
    };
    confirmService = {
      confirm: vi.fn().mockReturnValue(of(true)),
    };
    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StaffFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StaffApi, useValue: staffApi },
        { provide: AuthService, useValue: authService },
        { provide: ConfirmService, useValue: confirmService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: vi.fn().mockReturnValue(null) },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes form with invalid state when required fields are missing', () => {
    expect(component.form.valid).toBe(false);
  });

  it('marks valid when required fields are supplied', () => {
    component.form.patchValue({
      firstName: 'Amel',
      lastName: 'Trabelsi',
      role: 'DOCTOR',
      department: 'Cardiology',
      email: 'doctor1@sgh.local',
    });
    expect(component.form.valid).toBe(true);
  });

  it('handles 409 conflict duplicate email on submit', () => {
    component.form.patchValue({
      firstName: 'Amel',
      lastName: 'Trabelsi',
      role: 'DOCTOR',
      department: 'Cardiology',
      email: 'doctor1@sgh.local',
    });

    const error409 = new HttpErrorResponse({
      status: 409,
      error: {
        status: 409,
        error: 'Conflict',
        message: 'This e-mail is already used',
      },
    });

    staffApi.create = vi.fn().mockReturnValue(throwError(() => error409));

    component.onSubmit();

    expect(component.form.errors?.['server']).toBe('This e-mail is already used');
  });

  it('triggers deactivate with confirmation dialog', () => {
    component.currentStaff.set(mockStaff);
    component.onDeactivate();

    expect(confirmService.confirm).toHaveBeenCalled();
    expect(staffApi.deactivate).toHaveBeenCalledWith(mockStaff.id);
    expect(component.currentStaff()?.active).toBe(false);
  });
});
