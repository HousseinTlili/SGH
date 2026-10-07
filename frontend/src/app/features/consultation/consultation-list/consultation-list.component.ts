import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { StaffApi } from '../../../core/api/staff.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Consultation } from '../../../core/models/consultation';
import type { PatientSummary } from '../../../core/models/patient';
import type { StaffPublic } from '../../../core/models/staff';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';

@Component({
  selector: 'app-consultation-list',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    PageHeaderComponent,
    StatusBadgeComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ServiceGateDirective,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Consultations"
      subtitle="Clinical consultation records and SOAP workspace"
    />

    <div *appServiceGate="'consultation'">
      <!-- Filter Toolbar -->
      <div class="filters-bar" [formGroup]="filterForm">
        <mat-form-field appearance="outline" class="status-field">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            <mat-option value="">All statuses</mat-option>
            <mat-option value="DRAFT">Draft</mat-option>
            <mat-option value="SIGNED">Signed</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="patient-field">
          <mat-label>Patient</mat-label>
          <input
            matInput
            type="text"
            placeholder="Search patient..."
            formControlName="patientSearch"
            [matAutocomplete]="patientAuto"
          />
          @if (filterForm.controls.patientSearch.value) {
            <button
              matSuffix
              mat-icon-button
              type="button"
              aria-label="Clear patient filter"
              (click)="clearPatient()"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
          <mat-autocomplete
            #patientAuto="matAutocomplete"
            (optionSelected)="onPatientSelected($event.option.value)"
          >
            @for (p of patientOptions(); track p.id) {
              <mat-option [value]="p"> {{ p.fullName }} ({{ p.birthDate }}) </mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <mat-form-field appearance="outline" class="doctor-field">
          <mat-label>Doctor</mat-label>
          <mat-select formControlName="doctorId">
            @if (!isDoctor()) {
              <mat-option value="">All doctors</mat-option>
            }
            @for (doc of doctors(); track doc.id) {
              <mat-option [value]="doc.id"> Dr. {{ doc.fullName }} </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <button
          mat-icon-button
          type="button"
          class="refresh-btn"
          (click)="loadConsultations()"
          aria-label="Refresh"
        >
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      <!-- Content -->
      @if (loading()) {
        <app-loading-state message="Loading consultations..." />
      } @else if (error()) {
        <app-error-state message="Failed to load consultations" (retry)="loadConsultations()" />
      } @else if (consultations().length === 0) {
        <app-empty-state
          icon="clinical_notes"
          title="No consultations found"
          message="No consultation records match the selected filters."
        />
      } @else {
        <div class="sgh-table-container">
          <table class="sgh-table" aria-label="Consultations table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Assessment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (c of consultations(); track c.id) {
                <tr class="clickable-row" (click)="openConsultation(c)">
                  <td>{{ c.createdAt | localDatetime }}</td>
                  <td>{{ patientDisplay(c) }}</td>
                  <td>{{ (doctorName(c.doctorId) | async) || '—' }}</td>
                  <td>{{ truncateAssessment(c.assessment) }}</td>
                  <td>
                    <app-status-badge [status]="c.status" />
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <mat-paginator
            [length]="totalElements()"
            [pageSize]="size()"
            [pageIndex]="page()"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPageChange($event)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px 20px;
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      box-shadow: var(--sgh-shadow-sm);
    }
    .status-field {
      width: 170px;
    }
    .patient-field {
      flex: 1;
      min-width: 240px;
    }
    .doctor-field {
      width: 230px;
    }
    .refresh-btn {
      color: var(--sgh-text-muted);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius-sm);
      transition: all 0.2s ease;
      &:hover {
        color: var(--sgh-brand);
        background: var(--sgh-surface-1);
        border-color: var(--sgh-border);
      }
    }
    .sgh-table-container {
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      box-shadow: var(--sgh-shadow-sm);
      overflow: hidden;
    }
    .clickable-row {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .clickable-row:hover {
      background-color: var(--sgh-surface-1);
    }
  `,
})
export class ConsultationListComponent implements OnInit {
  private readonly consultationApi = inject(ConsultationApi);
  private readonly patientApi = inject(PatientApi);
  private readonly staffApi = inject(StaffApi);
  private readonly auth = inject(AuthService);
  private readonly nameLookup = inject(NameLookupService);
  private readonly router = inject(Router);

  protected readonly consultations = signal<Consultation[]>([]);
  protected readonly doctors = signal<StaffPublic[]>([]);
  protected readonly patientOptions = signal<PatientSummary[]>([]);
  protected readonly selectedPatientId = signal<string | null>(null);

  protected readonly totalElements = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected readonly isDoctor = computed(() => this.auth.hasRole('DOCTOR'));
  protected readonly currentStaffId = computed(() => this.auth.user()?.staffId ?? '');

  protected readonly filterForm = new FormGroup({
    status: new FormControl<string>('', { nonNullable: true }),
    patientSearch: new FormControl<string>('', { nonNullable: true }),
    doctorId: new FormControl<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadDoctors();

    if (this.isDoctor() && this.currentStaffId()) {
      this.filterForm.controls.doctorId.setValue(this.currentStaffId());
    }

    this.filterForm.controls.status.valueChanges.subscribe(() => {
      this.page.set(0);
      this.loadConsultations();
    });

    this.filterForm.controls.doctorId.valueChanges.subscribe(() => {
      this.page.set(0);
      this.loadConsultations();
    });

    this.filterForm.controls.patientSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length < 2) {
            this.patientOptions.set([]);
            return [];
          }
          return this.patientApi.list(query.trim(), 0, 10);
        }),
      )
      .subscribe({
        next: (res) => {
          if (res && 'content' in res) {
            this.patientOptions.set(
              res.content.map((p) => ({
                id: p.id,
                fullName: `${p.firstName} ${p.lastName}`,
                birthDate: p.birthDate,
              })),
            );
          }
        },
      });

    this.loadConsultations();
  }

  loadDoctors(): void {
    this.staffApi.directory('DOCTOR').subscribe({
      next: (docs) => this.doctors.set(docs),
    });
  }

  loadConsultations(): void {
    this.loading.set(true);
    this.error.set(false);

    const raw = this.filterForm.getRawValue();
    const doctorId =
      this.isDoctor() && this.currentStaffId() ? this.currentStaffId() : raw.doctorId || undefined;

    this.consultationApi
      .list({
        status: raw.status || undefined,
        patientId: this.selectedPatientId() ?? undefined,
        doctorId,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.consultations.set(page.content);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  onPatientSelected(patient: PatientSummary): void {
    this.selectedPatientId.set(patient.id);
    this.filterForm.controls.patientSearch.setValue(patient.fullName, {
      emitEvent: false,
    });
    this.page.set(0);
    this.loadConsultations();
  }

  clearPatient(): void {
    this.selectedPatientId.set(null);
    this.filterForm.controls.patientSearch.setValue('', { emitEvent: false });
    this.patientOptions.set([]);
    this.page.set(0);
    this.loadConsultations();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.size.set(event.pageSize);
    this.loadConsultations();
  }

  openConsultation(c: Consultation): void {
    this.router.navigate(['/consultations', c.id]);
  }

  patientDisplay(c: Consultation): string {
    if (c.patientSnapshot?.fullName) {
      return c.patientSnapshot.fullName;
    }
    return 'Patient unavailable';
  }

  doctorName(doctorId: string): Observable<string> {
    return this.nameLookup.getDoctorName(doctorId);
  }

  truncateAssessment(assessment: string | null | undefined): string {
    if (!assessment) return '—';
    return assessment.length > 60 ? `${assessment.slice(0, 60)}…` : assessment;
  }
}
