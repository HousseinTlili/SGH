import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { Patient } from '../../../core/models/patient';
import type { AppointmentInput, Slot } from '../../../core/models/reception';
import type { StaffPublic } from '../../../core/models/staff';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { FormErrorsComponent } from '../../../shared/components/form-errors/form-errors.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import {
  applyApiErrors,
  clearServerErrors,
  fieldErrorMessage,
} from '../../../shared/util/form-errors';
import { durationValidator } from '../reception-rules';

@Component({
  selector: 'app-appointment-form',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
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
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent implements OnInit {
  private readonly receptionApi = inject(ReceptionApi);
  private readonly patientApi = inject(PatientApi);
  private readonly staffApi = inject(StaffApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly statusService = inject(ServiceStatusService);

  readonly isEdit = signal(false);
  readonly appointmentId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly slotsLoading = signal(false);

  readonly doctors = signal<StaffPublic[]>([]);
  readonly patientResults = signal<Patient[]>([]);
  readonly slots = signal<Slot[]>([]);
  readonly selectedSlotStart = signal<string | null>(null);

  readonly patientServiceUp = computed(() => this.statusService.isUp('patient'));

  readonly minDate = new Date().toISOString().slice(0, 10);

  readonly form = new FormGroup({
    patientId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    patientSearch: new FormControl('', { nonNullable: true }),
    doctorId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    date: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    duration: new FormControl<number>(30, {
      nonNullable: true,
      validators: [Validators.required, durationValidator(10, 120)],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(255)],
    }),
  });

  ngOnInit(): void {
    if (!this.auth.hasRole('RECEPTIONIST')) {
      this.router.navigate(['/forbidden']);
      return;
    }

    this.loadDoctors();

    const id = this.route.snapshot.paramMap.get('id');
    const prefillPatientId = this.route.snapshot.queryParamMap.get('patientId');

    if (id) {
      this.isEdit.set(true);
      this.appointmentId.set(id);
      this.loadAppointment(id);
    } else if (prefillPatientId) {
      this.form.controls.patientId.setValue(prefillPatientId);
      if (this.patientServiceUp()) {
        this.patientApi.get(prefillPatientId).subscribe({
          next: (p) => {
            this.form.controls.patientSearch.setValue(`${p.firstName} ${p.lastName}`);
          },
          error: () => {
            this.form.controls.patientSearch.setValue(prefillPatientId);
          },
        });
      }
    }

    // Patient search autocomplete
    this.form.controls.patientSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        if (this.patientServiceUp() && query && query.length >= 2) {
          this.patientApi.list(query, 0, 10).subscribe({
            next: (res) => this.patientResults.set(res.content),
          });
        } else {
          this.patientResults.set([]);
        }
      });

    // When doctor or date changes, refresh availability slots
    this.form.controls.doctorId.valueChanges.subscribe(() => this.loadAvailability());
    this.form.controls.date.valueChanges.subscribe(() => this.loadAvailability());

    this.form.valueChanges.subscribe(() => {
      clearServerErrors(this.form);
    });
  }

  loadDoctors(): void {
    this.staffApi.directory('DOCTOR').subscribe({
      next: (docs) => this.doctors.set(docs),
    });
  }

  loadAppointment(id: string): void {
    this.loading.set(true);
    this.receptionApi.getAppointment(id).subscribe({
      next: (appt) => {
        if (appt.status !== 'SCHEDULED') {
          this.snackBar.open('Only SCHEDULED appointments can be edited', 'Dismiss', {
            duration: 4000,
          });
          this.router.navigate(['/appointments']);
          return;
        }

        const dateStr = appt.startAt.slice(0, 10);
        const startTime = new Date(appt.startAt).getTime();
        const endTime = new Date(appt.endAt).getTime();
        const durationMin = Math.round((endTime - startTime) / 60000);

        this.selectedSlotStart.set(appt.startAt);

        this.form.patchValue({
          patientId: appt.patientId,
          patientSearch: appt.patientId,
          doctorId: appt.doctorId,
          date: dateStr,
          duration: durationMin,
          reason: appt.reason,
        });

        // Resolve patient name for display
        if (this.patientServiceUp()) {
          this.patientApi.summary(appt.patientId).subscribe({
            next: (s) => this.form.controls.patientSearch.setValue(s.fullName),
          });
        }

        this.loading.set(false);
        this.loadAvailability();
      },
      error: () => this.loading.set(false),
    });
  }

  loadAvailability(): void {
    const doctorId = this.form.controls.doctorId.value;
    const date = this.form.controls.date.value;
    if (!doctorId || !date) {
      this.slots.set([]);
      return;
    }

    this.slotsLoading.set(true);
    this.receptionApi.getAvailability(doctorId, date).subscribe({
      next: (avail) => {
        this.slots.set(avail.slots);
        this.slotsLoading.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.slotsLoading.set(false);
      },
    });
  }

  onSelectPatient(patient: Patient): void {
    this.form.controls.patientId.setValue(patient.id);
    this.form.controls.patientSearch.setValue(`${patient.firstName} ${patient.lastName}`);
    this.patientResults.set([]);
  }

  onPatientPasteOrIdChange(val: string): void {
    // If patient service is down, user can directly paste UUID into patientId
    this.form.controls.patientId.setValue(val.trim());
  }

  onSelectSlot(slot: Slot): void {
    if (!slot.available && slot.startAt !== this.selectedSlotStart()) {
      return;
    }
    this.selectedSlotStart.set(slot.startAt);
  }

  setPresetDuration(min: number): void {
    this.form.controls.duration.setValue(min);
  }

  formatSlotTime(isoString: string): string {
    const d = new Date(isoString);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  errorMessage(controlName: string): string | null {
    const control = this.form.get(controlName);
    return fieldErrorMessage(control);
  }

  onSubmit(): void {
    if (this.form.invalid || !this.selectedSlotStart() || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const startAt = this.selectedSlotStart()!;
    const durationMin = Number(this.form.controls.duration.value) || 30;
    const startDate = new Date(startAt);
    const endDate = new Date(startDate.getTime() + durationMin * 60000);
    const endAt = endDate.toISOString();

    const input: AppointmentInput = {
      patientId: this.form.controls.patientId.value.trim(),
      doctorId: this.form.controls.doctorId.value,
      startAt,
      endAt,
      reason: this.form.controls.reason.value.trim(),
    };

    this.saving.set(true);
    const save$ =
      this.isEdit() && this.appointmentId()
        ? this.receptionApi.updateAppointment(this.appointmentId()!, input)
        : this.receptionApi.createAppointment(input);

    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Appointment saved', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/appointments']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          if (err.status === 409) {
            this.form.setErrors({
              server: 'This doctor already has an appointment at that time',
            });
            this.loadAvailability();
          } else if (err.status === 422) {
            applyApiErrors(this.form, toApiError(err));
          }
        }
      },
    });
  }

  onCancel(): void {
    this.router.navigate(['/appointments']);
  }
}
