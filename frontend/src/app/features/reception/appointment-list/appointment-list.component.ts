import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime } from 'rxjs';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Appointment, AppointmentStatus } from '../../../core/models/reception';
import type { StaffPublic } from '../../../core/models/staff';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { CancelAppointmentDialogComponent } from '../dialogs/cancel-appointment-dialog.component';
import {
  canCancelAppointment,
  canCheckInAppointment,
  canCompleteAppointment,
  canCreateAppointment,
  canEditAppointment,
  canStartConsultationFromAppointment,
} from '../reception-rules';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
];

@Component({
  selector: 'app-appointment-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.scss',
})
export class AppointmentListComponent implements OnInit {
  private readonly receptionApi = inject(ReceptionApi);
  private readonly consultationApi = inject(ConsultationApi);
  private readonly staffApi = inject(StaffApi);
  private readonly patientApi = inject(PatientApi);
  private readonly nameLookup = inject(NameLookupService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly appointments = signal<Appointment[]>([]);
  readonly doctors = signal<StaffPublic[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly loading = signal(false);

  readonly isDoctor = computed(() => this.auth.hasRole('DOCTOR'));
  readonly currentDoctorId = computed(() => {
    // Current user staff id if role is DOCTOR
    return this.auth.user()?.staffId ?? '';
  });

  readonly canCreate = computed(() => canCreateAppointment((role) => this.auth.hasRole(role)));

  readonly filterForm = new FormGroup({
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true }),
    doctorId: new FormControl('', { nonNullable: true }),
    statuses: new FormControl<AppointmentStatus[]>([]),
    patientSearch: new FormControl('', { nonNullable: true }),
  });

  // Cached names maps
  readonly patientNames = signal<Record<string, string>>({});
  readonly doctorNames = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.loadDoctors();

    if (this.isDoctor() && this.currentDoctorId()) {
      this.filterForm.controls.doctorId.setValue(this.currentDoctorId());
    }

    this.loadAppointments();

    this.filterForm.valueChanges.pipe(debounceTime(250)).subscribe(() => {
      this.page.set(0);
      this.loadAppointments();
    });
  }

  loadDoctors(): void {
    this.staffApi.directory('DOCTOR').subscribe({
      next: (docs) => this.doctors.set(docs),
    });
  }

  loadAppointments(): void {
    this.loading.set(true);
    const raw = this.filterForm.getRawValue();

    // If logged in as DOCTOR, doctorId is forced to themselves
    const doctorId =
      this.isDoctor() && this.currentDoctorId()
        ? this.currentDoctorId()
        : raw.doctorId || undefined;

    const date = raw.date || undefined;
    const status = raw.statuses?.length ? raw.statuses.join(',') : undefined;

    this.receptionApi
      .listAppointments({
        doctorId,
        date,
        status,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (res) => {
          this.appointments.set(res.content);
          this.total.set(res.totalElements);
          this.loading.set(false);
          this.resolveNames(res.content);
        },
        error: () => this.loading.set(false),
      });
  }

  resolveNames(appts: Appointment[]): void {
    for (const a of appts) {
      if (!this.patientNames()[a.patientId]) {
        this.nameLookup.getPatientName(a.patientId).subscribe((name) => {
          this.patientNames.update((prev) => ({ ...prev, [a.patientId]: name }));
        });
      }
      if (!this.doctorNames()[a.doctorId]) {
        this.nameLookup.getDoctorName(a.doctorId).subscribe((name) => {
          this.doctorNames.update((prev) => ({ ...prev, [a.doctorId]: name }));
        });
      }
    }
  }

  // Row permissions helpers
  canCheckIn(appt: Appointment): boolean {
    return canCheckInAppointment(appt.status, (r) => this.auth.hasRole(r));
  }

  canEdit(appt: Appointment): boolean {
    return canEditAppointment(appt.status, (r) => this.auth.hasRole(r));
  }

  canCancel(appt: Appointment): boolean {
    return canCancelAppointment(appt.status, (r) => this.auth.hasRole(r));
  }

  canComplete(appt: Appointment): boolean {
    return canCompleteAppointment(appt.status, (r) => this.auth.hasRole(r));
  }

  canStartConsultation(appt: Appointment): boolean {
    return canStartConsultationFromAppointment(appt.status, (r) => this.auth.hasRole(r));
  }

  // Actions
  onCheckIn(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.receptionApi.checkInAppointment(appt.id).subscribe({
      next: () => {
        this.snackBar.open('Patient checked in', 'Dismiss', { duration: 3000 });
        this.loadAppointments();
      },
    });
  }

  onComplete(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.receptionApi.completeAppointment(appt.id).subscribe({
      next: () => {
        this.snackBar.open('Appointment completed', 'Dismiss', { duration: 3000 });
        this.loadAppointments();
      },
    });
  }

  onCancelAppointment(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.dialog
      .open<CancelAppointmentDialogComponent, { appointmentId: string }, string | null>(
        CancelAppointmentDialogComponent,
        { data: { appointmentId: appt.id }, width: '420px' },
      )
      .afterClosed()
      .subscribe((reason) => {
        if (reason !== null && reason !== undefined) {
          this.receptionApi.cancelAppointment(appt.id, reason).subscribe({
            next: () => {
              this.snackBar.open('Appointment cancelled', 'Dismiss', { duration: 3000 });
              this.loadAppointments();
            },
          });
        }
      });
  }

  onEditAppointment(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/appointments', appt.id]);
  }

  onStartConsultation(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.consultationApi.create({ patientId: appt.patientId, appointmentId: appt.id }).subscribe({
      next: (consultation) => {
        this.snackBar.open('Consultation started', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/consultations', consultation.id]);
      },
    });
  }

  onRowClick(appt: Appointment): void {
    this.router.navigate(['/appointments', appt.id]);
  }

  onCreate(): void {
    this.router.navigate(['/appointments/new']);
  }
}
