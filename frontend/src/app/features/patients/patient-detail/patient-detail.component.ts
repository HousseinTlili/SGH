import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Consultation } from '../../../core/models/consultation';
import type {
  AllergyPassport,
  MedicalFileEntry,
  Patient,
  PatientAllergy,
} from '../../../core/models/patient';
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
  canEditAllergy,
  canDeletePatient,
  canEditPatient,
  canRecordAllergy,
  canStartConsultationForPatient,
  canVerifyAllergy,
  canViewAllergyHistory,
  canViewMedicalFile,
} from '../patient-rules';
import { AllergyPassportComponent } from '../allergy-passport/allergy-passport.component';
import {
  AllergyFormDialogComponent,
  type AllergyFormDialogData,
} from '../allergy-form-dialog/allergy-form-dialog.component';
import {
  AllergyHistoryDialogComponent,
  type AllergyHistoryDialogData,
} from '../allergy-history-dialog/allergy-history-dialog.component';

@Component({
  selector: 'app-patient-detail',
  imports: [
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
    PageHeaderComponent,
    ServiceGateDirective,
    ServiceUnavailableComponent,
    StatusBadgeComponent,
    LocalDatetimePipe,
    AllergyPassportComponent,
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
  private readonly dialog = inject(MatDialog);
  protected readonly statusService = inject(ServiceStatusService);

  readonly patient = signal<Patient | null>(null);
  readonly loading = signal(true);
  readonly age = computed(() => calculateAge(this.patient()?.birthDate));
  readonly allergyPassport = signal<AllergyPassport | null>(null);
  readonly allergyLoading = signal(false);
  readonly allergyError = signal(false);

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
  protected readonly canRecordAllergy = computed(() =>
    canRecordAllergy((role) => this.auth.hasRole(role)),
  );
  protected readonly canVerifyAllergy = computed(() =>
    canVerifyAllergy((role) => this.auth.hasRole(role)),
  );
  protected readonly canViewAllergyHistory = computed(() =>
    canViewAllergyHistory((role) => this.auth.hasRole(role)),
  );
  protected readonly canEditAllergy = (allergy: PatientAllergy) =>
    canEditAllergy((role) => this.auth.hasRole(role), allergy.verificationStatus);
  protected readonly canViewAppointments = computed(
    () =>
      this.auth.hasRole('RECEPTIONIST') ||
      this.auth.hasRole('DOCTOR') ||
      this.auth.hasRole('ADMIN'),
  );
  protected readonly canViewConsultations = computed(
    () => this.auth.hasRole('DOCTOR') || this.auth.hasRole('NURSE') || this.auth.hasRole('ADMIN'),
  );

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
        this.loadAllergyPassport();
        if (this.canViewMedFile()) {
          this.loadMedicalFile();
        }
        if (this.canViewAppointments()) {
          this.loadAppointments();
        }
        if (this.canViewConsultations()) {
          this.loadConsultations();
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

  loadAllergyPassport(): void {
    const p = this.patient();
    if (!p) return;
    this.allergyLoading.set(true);
    this.allergyError.set(false);
    this.patientApi.allergyPassport(p.id).subscribe({
      next: (passport) => {
        this.allergyPassport.set(passport);
        this.allergyLoading.set(false);
      },
      error: () => {
        this.allergyLoading.set(false);
        this.allergyError.set(true);
      },
    });
  }

  onAddAllergy(): void {
    this.openAllergyDialog();
  }

  onEditAllergy(allergy: PatientAllergy): void {
    this.openAllergyDialog(allergy);
  }

  onVerifyAllergy(event: {
    allergy: PatientAllergy;
    status: 'CONFIRMED' | 'REFUTED';
  }): void {
    const p = this.patient();
    if (!p) return;
    const verb = event.status === 'CONFIRMED' ? 'confirm' : 'refute';
    this.confirm
      .confirm({
        title: `${verb[0].toUpperCase()}${verb.slice(1)} allergy`,
        message: `Do you want to ${verb} "${event.allergy.allergen}"? This clinical action will be audited.`,
        confirmLabel: event.status === 'CONFIRMED' ? 'Confirm allergy' : 'Refute allergy',
        danger: event.status === 'REFUTED',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.patientApi
          .verifyAllergy(p.id, event.allergy.id, event.status, event.allergy.version)
          .subscribe({
            next: () => {
              this.snackBar.open(`Allergy ${verb}ed`, 'Dismiss', { duration: 3000 });
              this.loadAllergyPassport();
              this.loadPatientProjection();
            },
          });
      });
  }

  onAllergyHistory(allergy: PatientAllergy): void {
    const p = this.patient();
    if (!p) return;
    this.dialog.open<AllergyHistoryDialogComponent, AllergyHistoryDialogData>(
      AllergyHistoryDialogComponent,
      {
        data: { patientId: p.id, allergy },
        width: '720px',
        maxWidth: '95vw',
      },
    );
  }

  private openAllergyDialog(allergy?: PatientAllergy): void {
    const p = this.patient();
    if (!p) return;
    this.dialog
      .open<AllergyFormDialogComponent, AllergyFormDialogData, PatientAllergy>(
        AllergyFormDialogComponent,
        {
          data: { patientId: p.id, allergy },
          width: '760px',
          maxWidth: '95vw',
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) return;
        this.snackBar.open('Allergy record saved', 'Dismiss', { duration: 3000 });
        this.loadAllergyPassport();
        this.loadPatientProjection();
      });
  }

  private loadPatientProjection(): void {
    const p = this.patient();
    if (!p) return;
    this.patientApi.get(p.id).subscribe((updated) => this.patient.set(updated));
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
    this.consultApi()
      .list({ patientId: p.id })
      .subscribe({
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

  private consultApi(): ConsultationApi {
    return this.consultationApi;
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

  doctorName(doctorId: string) {
    return this.nameLookup.getDoctorName(doctorId);
  }
}
