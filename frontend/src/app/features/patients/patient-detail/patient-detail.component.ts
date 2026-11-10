import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Consultation, VitalSigns } from '../../../core/models/consultation';
import type { MedicalFileEntry, Patient } from '../../../core/models/patient';
import type { Appointment } from '../../../core/models/reception';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { ServiceUnavailableComponent } from '../../../shared/components/service-unavailable/service-unavailable.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import {
  calculateAge,
  canAddMedicalNote,
  canDeletePatient,
  canEditPatient,
  canStartConsultationForPatient,
  canViewMedicalFile,
} from '../patient-rules';

export interface ChartPoint {
  x: number;
  y: number;
  val: number;
  label: string;
  dateStr: string;
}

export interface BpChartData {
  sysPoints: ChartPoint[];
  diaPoints: ChartPoint[];
  sysPath: string;
  diaPath: string;
  dates: string[];
}

export interface SingleChartData {
  points: ChartPoint[];
  path: string;
  dates: string[];
}

@Component({
  selector: 'app-patient-detail',
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule,
    PageHeaderComponent,
    ServiceGateDirective,
    ServiceUnavailableComponent,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss',
})
export class PatientDetailComponent implements OnInit {
  private readonly patientApi = inject(PatientApi);
  private readonly receptionApi = inject(ReceptionApi);
  private readonly consultationApi = inject(ConsultationApi);
  private readonly nameLookup = inject(NameLookupService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirm = inject(ConfirmService);
  protected readonly statusService = inject(ServiceStatusService);

  readonly patient = signal<Patient | null>(null);
  readonly loading = signal(true);
  readonly age = computed(() => calculateAge(this.patient()?.birthDate));

  // Medical file
  readonly medicalFiles = signal<MedicalFileEntry[]>([]);
  readonly medFileTotal = signal(0);
  readonly medFilePage = signal(0);
  readonly medFileLoading = signal(false);
  readonly noteForm = new FormGroup({
    summary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
  });
  readonly addingNote = signal(false);

  // Appointments
  readonly appointments = signal<Appointment[]>([]);
  readonly apptLoading = signal(false);
  readonly apptError = signal(false);

  // Consultations
  readonly consultations = signal<Consultation[]>([]);
  readonly consultLoading = signal(false);
  readonly consultError = signal(false);

  // Vital Signs
  readonly vitals = signal<VitalSigns[]>([]);
  readonly vitalsLoading = signal(false);

  // Selected Tab Index (0: Overview, 1: Consultations & Vitals, 2: Medical File, 3: Appointments)
  readonly selectedTabIndex = signal(0);

  // Permissions
  protected readonly canEdit = computed(() => canEditPatient((role) => this.auth.hasRole(role)));
  protected readonly canDelete = computed(() =>
    canDeletePatient((role) => this.auth.hasRole(role)),
  );
  protected readonly canAddNote = computed(() =>
    canAddMedicalNote((role) => this.auth.hasRole(role)),
  );
  protected readonly canViewMedFile = computed(() =>
    canViewMedicalFile((role) => this.auth.hasRole(role)),
  );
  protected readonly canStartConsultation = computed(() =>
    canStartConsultationForPatient((role) => this.auth.hasRole(role)),
  );
  protected readonly canCreateAppointment = computed(() => this.auth.hasRole('RECEPTIONIST'));
  protected readonly canViewAppointments = computed(
    () =>
      this.auth.hasRole('RECEPTIONIST') ||
      this.auth.hasRole('DOCTOR') ||
      this.auth.hasRole('ADMIN'),
  );
  protected readonly canViewConsultations = computed(
    () => this.auth.hasRole('DOCTOR') || this.auth.hasRole('NURSE') || this.auth.hasRole('ADMIN'),
  );

  // Clinical Vitals Computed Signals
  readonly latestVitals = computed<VitalSigns | null>(() => {
    const list = this.vitals();
    return list.length > 0 ? list[0] : null;
  });

  readonly chronologicalVitals = computed<VitalSigns[]>(() => {
    return [...this.vitals()].reverse();
  });

  // Clinical Evaluations
  readonly bpEvaluation = computed<{ category: string; tone: string }>(() => {
    const v = this.latestVitals();
    if (!v || v.systolic === undefined || v.diastolic === undefined) {
      return { category: 'No data', tone: 'neutral' };
    }
    const sys = v.systolic;
    const dia = v.diastolic;
    if (sys < 120 && dia < 80) return { category: 'Optimal', tone: 'success' };
    if (sys <= 129 && dia < 80) return { category: 'Normal', tone: 'success' };
    if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) {
      return { category: 'Stage 1 HTN', tone: 'warning' };
    }
    return { category: 'Stage 2 HTN', tone: 'danger' };
  });

  readonly hrEvaluation = computed<{ category: string; tone: string }>(() => {
    const v = this.latestVitals();
    if (!v || v.heartRate === undefined) {
      return { category: 'No data', tone: 'neutral' };
    }
    const hr = v.heartRate;
    if (hr < 60) return { category: 'Bradycardia', tone: 'warning' };
    if (hr <= 100) return { category: 'Normal sinus', tone: 'success' };
    return { category: 'Tachycardia', tone: 'danger' };
  });

  // Blood pressure SVG chart
  readonly bpChart = computed<BpChartData | null>(() => {
    const items = this.chronologicalVitals().filter(
      (v) => v.systolic !== undefined && v.diastolic !== undefined
    );
    if (items.length < 2) return null;

    const width = 480;
    const height = 160;
    const padX = 40;
    const padY = 25;
    const minVal = 50;
    const maxVal = 180;

    const scaleX = (i: number) => padX + (i / (items.length - 1)) * (width - padX * 2);
    const scaleY = (val: number) =>
      height - padY - ((val - minVal) / (maxVal - minVal)) * (height - padY * 2);

    const sysPoints: ChartPoint[] = [];
    const diaPoints: ChartPoint[] = [];
    const dates: string[] = [];

    items.forEach((item, i) => {
      const x = Math.round(scaleX(i));
      const ySys = Math.round(scaleY(item.systolic!));
      const yDia = Math.round(scaleY(item.diastolic!));
      const d = new Date(item.recordedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      dates.push(d);

      sysPoints.push({
        x,
        y: ySys,
        val: item.systolic!,
        label: `${item.systolic} mmHg`,
        dateStr: d,
      });

      diaPoints.push({
        x,
        y: yDia,
        val: item.diastolic!,
        label: `${item.diastolic} mmHg`,
        dateStr: d,
      });
    });

    const sysPath = sysPoints.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`,
      ''
    );
    const diaPath = diaPoints.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`,
      ''
    );

    return { sysPoints, diaPoints, sysPath, diaPath, dates };
  });

  // Heart rate SVG chart
  readonly hrChart = computed<SingleChartData | null>(() => {
    const items = this.chronologicalVitals().filter((v) => v.heartRate !== undefined);
    if (items.length < 2) return null;

    const width = 480;
    const height = 160;
    const padX = 40;
    const padY = 25;
    const minVal = 40;
    const maxVal = 120;

    const scaleX = (i: number) => padX + (i / (items.length - 1)) * (width - padX * 2);
    const scaleY = (val: number) =>
      height - padY - ((val - minVal) / (maxVal - minVal)) * (height - padY * 2);

    const points: ChartPoint[] = [];
    const dates: string[] = [];

    items.forEach((item, i) => {
      const x = Math.round(scaleX(i));
      const y = Math.round(scaleY(item.heartRate!));
      const d = new Date(item.recordedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      dates.push(d);

      points.push({
        x,
        y,
        val: item.heartRate!,
        label: `${item.heartRate} bpm`,
        dateStr: d,
      });
    });

    const path = points.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`,
      ''
    );
    return { points, path, dates };
  });

  // Weight SVG chart
  readonly weightChart = computed<SingleChartData | null>(() => {
    const items = this.chronologicalVitals().filter((v) => v.weight !== undefined);
    if (items.length < 2) return null;

    const width = 480;
    const height = 160;
    const padX = 40;
    const padY = 25;
    const weights = items.map((it) => it.weight!);
    const minVal = Math.min(...weights) - 5;
    const maxVal = Math.max(...weights) + 5;

    const scaleX = (i: number) => padX + (i / (items.length - 1)) * (width - padX * 2);
    const scaleY = (val: number) =>
      height - padY - ((val - minVal) / (maxVal - minVal)) * (height - padY * 2);

    const points: ChartPoint[] = [];
    const dates: string[] = [];

    items.forEach((item, i) => {
      const x = Math.round(scaleX(i));
      const y = Math.round(scaleY(item.weight!));
      const d = new Date(item.recordedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      dates.push(d);

      points.push({
        x,
        y,
        val: item.weight!,
        label: `${item.weight} kg`,
        dateStr: d,
      });
    });

    const path = points.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`,
      ''
    );
    return { points, path, dates };
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/patients']);
      return;
    }
    this.loadPatient(id);
  }

  loadPatient(id: string): void {
    this.loading.set(true);
    this.patientApi.get(id).subscribe({
      next: (p) => {
        this.patient.set(p);
        this.loading.set(false);
        if (this.canViewMedFile()) {
          this.loadMedicalFile();
        }
        if (this.canViewAppointments()) {
          this.loadAppointments();
        }
        if (this.canViewConsultations()) {
          this.loadConsultations();
          this.loadVitals();
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadMedicalFile(): void {
    const p = this.patient();
    if (!p) return;
    this.medFileLoading.set(true);
    this.patientApi.medicalFile(p.id, undefined, this.medFilePage(), 20).subscribe({
      next: (res) => {
        this.medicalFiles.set(res.content);
        this.medFileTotal.set(res.totalElements);
        this.medFileLoading.set(false);
      },
      error: () => this.medFileLoading.set(false),
    });
  }

  onAddNote(): void {
    const p = this.patient();
    if (!p || this.noteForm.invalid || this.addingNote()) return;
    const summary = this.noteForm.getRawValue().summary.trim();
    if (!summary) return;

    this.addingNote.set(true);
    this.patientApi.addMedicalFileNote(p.id, summary).subscribe({
      next: () => {
        this.addingNote.set(false);
        this.noteForm.reset();
        this.snackBar.open('Medical note added', 'Dismiss', { duration: 3000 });
        this.loadMedicalFile();
      },
      error: () => this.addingNote.set(false),
    });
  }

  loadAppointments(): void {
    const p = this.patient();
    if (!p) return;
    this.apptLoading.set(true);
    this.apptError.set(false);
    this.receptionApi.listAppointments({ patientId: p.id }).subscribe({
      next: (res) => {
        this.appointments.set(res.content);
        this.apptLoading.set(false);
      },
      error: () => {
        this.apptLoading.set(false);
        this.apptError.set(true);
      },
    });
  }

  loadConsultations(): void {
    const p = this.patient();
    if (!p) return;
    this.consultLoading.set(true);
    this.consultError.set(false);
    this.consultationApi.list({ patientId: p.id }).subscribe({
      next: (res) => {
        this.consultations.set(res.content);
        this.consultLoading.set(false);
      },
      error: () => {
        this.consultLoading.set(false);
        this.consultError.set(true);
      },
    });
  }

  loadVitals(): void {
    const p = this.patient();
    if (!p) return;
    this.vitalsLoading.set(true);
    this.consultationApi.listVitals({ patientId: p.id, size: 50 }).subscribe({
      next: (res) => {
        this.vitals.set(res.content);
        this.vitalsLoading.set(false);
      },
      error: () => this.vitalsLoading.set(false),
    });
  }

  onEdit(): void {
    const p = this.patient();
    if (p) {
      this.router.navigate(['/patients', p.id, 'edit']);
    }
  }

  onDelete(): void {
    const p = this.patient();
    if (!p) return;

    this.confirm
      .confirm({
        title: 'Delete patient',
        message: `Are you sure you want to delete patient "${p.firstName} ${p.lastName}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.patientApi.delete(p.id).subscribe({
            next: () => {
              this.snackBar.open('Patient deleted', 'Dismiss', { duration: 3000 });
              this.router.navigate(['/patients']);
            },
          });
        }
      });
  }

  onNewAppointment(): void {
    const p = this.patient();
    if (p) {
      this.router.navigate(['/appointments/new'], {
        queryParams: { patientId: p.id },
      });
    }
  }

  onNewConsultation(): void {
    const p = this.patient();
    if (!p) return;

    this.consultationApi.create({ patientId: p.id }).subscribe({
      next: (consultation) => {
        this.snackBar.open('Consultation created', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/consultations', consultation.id]);
      },
    });
  }

  onOpenConsultation(consultationId: string): void {
    this.router.navigate(['/consultations', consultationId]);
  }

  doctorName(doctorId: string) {
    return this.nameLookup.getDoctorName(doctorId);
  }
}
