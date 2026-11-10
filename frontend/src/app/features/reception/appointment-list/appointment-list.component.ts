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
import { CommonModule } from '@angular/common';
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

export type AgendaViewMode = 'day' | 'week' | 'month' | 'table';

export interface DayColumn {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  appointments: Appointment[];
}

export interface MonthCell {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  appointments: Appointment[];
}

function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

@Component({
  selector: 'app-appointment-list',
  imports: [
    CommonModule,
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
  private readonly nameLookup = inject(NameLookupService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly appointments = signal<Appointment[]>([]);
  readonly allLoadedAppointments = signal<Appointment[]>([]);
  readonly doctors = signal<StaffPublic[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly loading = signal(false);

  readonly viewMode = signal<AgendaViewMode>('day');
  readonly selectedDate = signal<Date>(new Date());

  readonly isDoctor = computed(() => this.auth.hasRole('DOCTOR'));
  readonly currentDoctorId = computed(() => this.auth.user()?.staffId ?? '');
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

  // Computed period title
  readonly periodTitle = computed(() => {
    const d = this.selectedDate();
    const mode = this.viewMode();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    if (mode === 'day') {
      return d.toLocaleDateString('en-US', options);
    }
    if (mode === 'week') {
      const days = this.weekDays();
      if (days.length === 7) {
        const first = days[0].date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        const last = days[6].date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        return `${first} – ${last}`;
      }
      return 'Week View';
    }
    if (mode === 'month') {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return 'Appointments Register';
  });

  // Appointments for the selected day
  readonly selectedDayAppointments = computed(() => {
    const sel = this.selectedDate();
    return this.allLoadedAppointments().filter((a) => {
      const apptDate = new Date(a.startAt);
      return isSameDay(apptDate, sel);
    });
  });

  // Next checked-in patient for today waiting for consultation
  readonly checkedInPatient = computed(() => {
    return (
      this.selectedDayAppointments().find(
        (a) => a.status === 'CHECKED_IN'
      ) ?? null
    );
  });

  // Week days (Mon to Sun)
  readonly weekDays = computed<DayColumn[]>(() => {
    const sel = this.selectedDate();
    const dayOfWeek = sel.getDay(); // 0 is Sun, 1 is Mon, etc.
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(sel);
    monday.setDate(sel.getDate() + diffToMon);

    const today = new Date();
    const columns: DayColumn[] = [];

    for (let i = 0; i < 7; i++) {
      const colDate = new Date(monday);
      colDate.setDate(monday.getDate() + i);

      const appts = this.allLoadedAppointments().filter((a) => {
        const apptDate = new Date(a.startAt);
        return isSameDay(apptDate, colDate);
      });

      columns.push({
        date: colDate,
        dateStr: formatDateStr(colDate),
        dayName: colDate.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: colDate.getDate(),
        monthName: colDate.toLocaleDateString('en-US', { month: 'short' }),
        isToday: isSameDay(colDate, today),
        appointments: appts,
      });
    }

    return columns;
  });

  // Month grid
  readonly monthGrid = computed<MonthCell[]>(() => {
    const sel = this.selectedDate();
    const year = sel.getFullYear();
    const month = sel.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    // Monday-based start
    const firstDayOfWeek = firstOfMonth.getDay(); // 0 is Sun
    const padDaysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const startDate = new Date(firstOfMonth);
    startDate.setDate(startDate.getDate() - padDaysBefore);

    const today = new Date();
    const cells: MonthCell[] = [];

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);

      if (i >= 35 && cellDate.getMonth() !== month) {
        break; // Stop at 5 weeks if 6th week is entirely next month
      }

      const appts = this.allLoadedAppointments().filter((a) => {
        const apptDate = new Date(a.startAt);
        return isSameDay(apptDate, cellDate);
      });

      cells.push({
        date: cellDate,
        dateStr: formatDateStr(cellDate),
        dayNumber: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
        isToday: isSameDay(cellDate, today),
        isSelected: isSameDay(cellDate, sel),
        appointments: appts,
      });
    }

    return cells;
  });

  // Period stats
  readonly currentPeriodAppointments = computed(() => {
    const mode = this.viewMode();
    if (mode === 'day') return this.selectedDayAppointments();
    if (mode === 'week') {
      const days = this.weekDays();
      return days.flatMap((d) => d.appointments);
    }
    if (mode === 'month') {
      const selMonth = this.selectedDate().getMonth();
      return this.allLoadedAppointments().filter(
        (a) => new Date(a.startAt).getMonth() === selMonth
      );
    }
    return this.appointments();
  });

  readonly checkedInCount = computed(
    () => this.currentPeriodAppointments().filter((a) => a.status === 'CHECKED_IN').length
  );

  readonly scheduledCount = computed(
    () => this.currentPeriodAppointments().filter((a) => a.status === 'SCHEDULED').length
  );

  readonly completedCount = computed(
    () => this.currentPeriodAppointments().filter((a) => a.status === 'COMPLETED').length
  );

  ngOnInit(): void {
    this.loadDoctors();

    if (this.isDoctor() && this.currentDoctorId()) {
      this.filterForm.controls.doctorId.setValue(this.currentDoctorId());
    }

    this.loadAppointments();
    this.loadAllAppointmentsForCalendar();

    this.filterForm.valueChanges.pipe(debounceTime(250)).subscribe(() => {
      this.page.set(0);
      this.loadAppointments();
      this.loadAllAppointmentsForCalendar();
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

    const doctorId =
      this.isDoctor() && this.currentDoctorId()
        ? this.currentDoctorId()
        : raw.doctorId || undefined;

    const date = this.viewMode() === 'table' ? (raw.date || undefined) : undefined;
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

  loadAllAppointmentsForCalendar(): void {
    const raw = this.filterForm.getRawValue();
    const doctorId =
      this.isDoctor() && this.currentDoctorId()
        ? this.currentDoctorId()
        : raw.doctorId || undefined;

    this.receptionApi
      .listAppointments({
        doctorId,
        size: 100,
      })
      .subscribe({
        next: (res) => {
          this.allLoadedAppointments.set(res.content);
          this.resolveNames(res.content);
        },
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

  // Navigation handlers
  setViewMode(mode: AgendaViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'table') {
      this.loadAppointments();
    }
  }

  goToPrevious(): void {
    const cur = new Date(this.selectedDate());
    const mode = this.viewMode();
    if (mode === 'day') {
      cur.setDate(cur.getDate() - 1);
    } else if (mode === 'week') {
      cur.setDate(cur.getDate() - 7);
    } else if (mode === 'month') {
      cur.setMonth(cur.getMonth() - 1);
    }
    this.selectedDate.set(cur);
    this.filterForm.controls.date.setValue(formatDateStr(cur));
  }

  goToNext(): void {
    const cur = new Date(this.selectedDate());
    const mode = this.viewMode();
    if (mode === 'day') {
      cur.setDate(cur.getDate() + 1);
    } else if (mode === 'week') {
      cur.setDate(cur.getDate() + 7);
    } else if (mode === 'month') {
      cur.setMonth(cur.getMonth() + 1);
    }
    this.selectedDate.set(cur);
    this.filterForm.controls.date.setValue(formatDateStr(cur));
  }

  goToToday(): void {
    const today = new Date();
    this.selectedDate.set(today);
    this.filterForm.controls.date.setValue(formatDateStr(today));
  }

  onSelectDay(date: Date): void {
    this.selectedDate.set(date);
    this.filterForm.controls.date.setValue(formatDateStr(date));
    this.viewMode.set('day');
  }

  // Action helpers
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
    // Doctors can initiate consultation directly from agenda for active visits
    return (
      (this.isDoctor() && appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED') ||
      canStartConsultationFromAppointment(appt.status, (r) => this.auth.hasRole(r))
    );
  }

  // Actions
  onCheckIn(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.receptionApi.checkInAppointment(appt.id).subscribe({
      next: () => {
        this.snackBar.open('Patient checked in', 'Dismiss', { duration: 3000 });
        this.loadAppointments();
        this.loadAllAppointmentsForCalendar();
      },
    });
  }

  onComplete(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.receptionApi.completeAppointment(appt.id).subscribe({
      next: () => {
        this.snackBar.open('Appointment completed', 'Dismiss', { duration: 3000 });
        this.loadAppointments();
        this.loadAllAppointmentsForCalendar();
      },
    });
  }

  onCancelAppointment(appt: Appointment, event: Event): void {
    event.stopPropagation();
    this.dialog
      .open<CancelAppointmentDialogComponent, { appointmentId: string }, string | null>(
        CancelAppointmentDialogComponent,
        { data: { appointmentId: appt.id }, width: '420px' }
      )
      .afterClosed()
      .subscribe((reason) => {
        if (reason !== null && reason !== undefined) {
          this.receptionApi.cancelAppointment(appt.id, reason).subscribe({
            next: () => {
              this.snackBar.open('Appointment cancelled', 'Dismiss', { duration: 3000 });
              this.loadAppointments();
              this.loadAllAppointmentsForCalendar();
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
