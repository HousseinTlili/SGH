import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { Role } from '../../../core/models/common';
import type { Staff, StaffInput } from '../../../core/models/staff';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { FormErrorsComponent } from '../../../shared/components/form-errors/form-errors.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import {
  applyApiErrors,
  clearServerErrors,
  fieldErrorMessage,
} from '../../../shared/util/form-errors';
import { STAFF_ROLES } from '../staff-list/staff-list.component';

@Component({
  selector: 'app-staff-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
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
  templateUrl: './staff-form.component.html',
  styleUrl: './staff-form.component.scss',
})
export class StaffFormComponent implements OnInit {
  private readonly staffApi = inject(StaffApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirm = inject(ConfirmService);

  readonly isEdit = signal(false);
  readonly staffId = signal<string | null>(null);
  readonly currentStaff = signal<Staff | null>(null);
  readonly saving = signal(false);
  readonly loading = signal(false);

  protected readonly roles = STAFF_ROLES as Exclude<Role, 'PATIENT'>[];

  readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    role: new FormControl<Exclude<Role, 'PATIENT'>>('DOCTOR', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    specialty: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)],
    }),
    department: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(120)],
    }),
    keycloakUserId: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    if (!this.auth.hasRole('ADMIN')) {
      this.router.navigate(['/forbidden']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.staffId.set(id);
      this.loadStaff(id);
    }

    this.form.valueChanges.subscribe(() => {
      clearServerErrors(this.form);
    });
  }

  loadStaff(id: string): void {
    this.loading.set(true);
    this.staffApi.get(id).subscribe({
      next: (staff) => {
        this.currentStaff.set(staff);
        this.form.patchValue({
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: staff.role,
          specialty: staff.specialty ?? '',
          department: staff.department,
          email: staff.email,
          keycloakUserId: staff.keycloakUserId ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
    const input: StaffInput = {
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      role: raw.role,
      specialty: raw.specialty.trim() || null,
      department: raw.department.trim(),
      email: raw.email.trim(),
      keycloakUserId: raw.keycloakUserId.trim() || null,
    };

    this.saving.set(true);
    const save$ =
      this.isEdit() && this.staffId()
        ? this.staffApi.update(this.staffId()!, input)
        : this.staffApi.create(input);

    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Staff member saved', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/staff']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          if (err.status === 409) {
            this.form.setErrors({ server: 'This e-mail is already used' });
          } else if (err.status === 422) {
            applyApiErrors(this.form, toApiError(err));
          }
        }
      },
    });
  }

  onDeactivate(): void {
    const staff = this.currentStaff();
    if (!staff || !staff.active) return;

    this.confirm
      .confirm({
        title: 'Deactivate staff member',
        message: `Are you sure you want to deactivate ${staff.firstName} ${staff.lastName}? They will no longer be active in the system.`,
        confirmLabel: 'Deactivate',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.staffApi.deactivate(staff.id).subscribe({
            next: (updated) => {
              this.currentStaff.set(updated);
              this.snackBar.open('Staff member deactivated', 'Dismiss', {
                duration: 3000,
              });
            },
            error: (err: unknown) => {
              if (err instanceof HttpErrorResponse && err.status === 409) {
                this.snackBar.open('Staff member is already inactive', 'Dismiss', {
                  duration: 4000,
                });
              }
            },
          });
        }
      });
  }

  onCancel(): void {
    this.router.navigate(['/staff']);
  }
}
