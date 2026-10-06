import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientApi } from '../../../core/api/patient.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { PatientInput } from '../../../core/models/patient';
import { FormErrorsComponent } from '../../../shared/components/form-errors/form-errors.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import {
  applyApiErrors,
  clearServerErrors,
  fieldErrorMessage,
} from '../../../shared/util/form-errors';
import { PHONE_PATTERN, notBefore1900Validator, notFutureDateValidator } from '../patient-rules';

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'app-patient-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    FormErrorsComponent,
    PageHeaderComponent,
    ServiceGateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.scss',
})
export class PatientFormComponent implements OnInit {
  private readonly api = inject(PatientApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  readonly isEdit = signal(false);
  readonly patientId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly loading = signal(false);

  protected readonly bloodTypes = BLOOD_TYPES;
  protected readonly genders = GENDERS;

  readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    birthDate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, notFutureDateValidator(), notBefore1900Validator()],
    }),
    gender: new FormControl<'MALE' | 'FEMALE' | 'OTHER'>('MALE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(PHONE_PATTERN)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(120)],
    }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
    bloodType: new FormControl('', { nonNullable: true }),
    allergies: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    insuranceProvider: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    insuranceNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
  });

  ngOnInit(): void {
    if (!this.auth.hasRole('RECEPTIONIST')) {
      this.router.navigate(['/forbidden']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.patientId.set(id);
      this.loadPatient(id);
    }

    this.form.valueChanges.subscribe(() => {
      clearServerErrors(this.form);
    });
  }

  loadPatient(id: string): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (patient) => {
        this.form.patchValue({
          firstName: patient.firstName,
          lastName: patient.lastName,
          birthDate: patient.birthDate,
          gender: patient.gender,
          phone: patient.phone ?? '',
          email: patient.email ?? '',
          address: patient.address ?? '',
          bloodType: patient.bloodType ?? '',
          allergies: patient.allergies ?? '',
          insuranceProvider: patient.insuranceProvider ?? '',
          insuranceNumber: patient.insuranceNumber ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  errorMessage(controlName: string): string | null {
    const control = this.form.get(controlName);
    return fieldErrorMessage(control);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    // Trim empty strings to undefined
    const input: PatientInput = {
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      birthDate: typeof raw.birthDate === 'string' ? raw.birthDate.trim() : raw.birthDate,
      gender: raw.gender,
      phone: raw.phone.trim() || undefined,
      email: raw.email.trim() || undefined,
      address: raw.address.trim() || undefined,
      bloodType: raw.bloodType || undefined,
      allergies: raw.allergies.trim() || undefined,
      insuranceProvider: raw.insuranceProvider.trim() || undefined,
      insuranceNumber: raw.insuranceNumber.trim() || undefined,
    };

    this.saving.set(true);
    const save$ =
      this.isEdit() && this.patientId()
        ? this.api.update(this.patientId()!, input)
        : this.api.create(input);

    save$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.snackBar.open('Patient saved', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/patients', saved.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          if (err.status === 409) {
            this.form.setErrors({
              server: 'A patient with the same name and birth date already exists',
            });
          } else if (err.status === 422) {
            applyApiErrors(this.form, toApiError(err));
          }
        }
      },
    });
  }

  onCancel(): void {
    if (this.isEdit() && this.patientId()) {
      this.router.navigate(['/patients', this.patientId()]);
    } else {
      this.router.navigate(['/patients']);
    }
  }
}
