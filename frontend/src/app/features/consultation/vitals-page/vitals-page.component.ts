import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import type { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { VitalSigns } from '../../../core/models/consultation';
import type { PatientSummary } from '../../../core/models/patient';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { VitalSignsFormComponent } from '../vital-signs-form/vital-signs-form.component';

@Component({
  selector: 'app-vitals-page',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ServiceGateDirective,
    LocalDatetimePipe,
    VitalSignsFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Vital signs"
      subtitle="Record and review patient clinical vital signs"
    />

    <div *appServiceGate="'consultation'">
      <!-- Patient Autocomplete Selector -->
      <div class="search-section" [formGroup]="searchForm">
        <mat-form-field appearance="outline" class="patient-search-field">
          <mat-label>Select patient</mat-label>
          <input
            matInput
            type="text"
            placeholder="Type patient name to search..."
            formControlName="patientSearch"
            [matAutocomplete]="patientAuto"
          />
          @if (selectedPatient()) {
            <button
              matSuffix
              mat-icon-button
              type="button"
              aria-label="Clear patient selection"
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
      </div>

      @if (selectedPatient()) {
        <div class="patient-banner">
          <mat-icon class="patient-icon">person</mat-icon>
          <div>
            <strong>{{ selectedPatient()!.fullName }}</strong>
            <span class="birth-date"> — Birth date: {{ selectedPatient()!.birthDate }}</span>
          </div>
        </div>

        <div class="vitals-layout">
          <!-- Record Form Card -->
          <div class="vitals-card">
            <h3>Record new measurement</h3>
            <app-vital-signs-form [patientId]="selectedPatient()!.id" (saved)="onVitalRecorded()" />
          </div>

          <!-- History Table Card -->
          <div class="vitals-card">
            <div class="history-header">
              <h3>Measurement history</h3>
              <button
                mat-icon-button
                type="button"
                (click)="loadVitalsHistory()"
                aria-label="Refresh"
              >
                <mat-icon>refresh</mat-icon>
              </button>
            </div>

            @if (loadingHistory()) {
              <app-loading-state message="Loading vitals history..." />
            } @else if (historyError()) {
              <app-error-state
                message="Failed to load vitals history"
                (retry)="loadVitalsHistory()"
              />
            } @else if (vitalsList().length === 0) {
              <app-empty-state
                icon="monitor_heart"
                title="No measurements recorded"
                message="No vital signs have been recorded yet for this patient."
              />
            } @else {
              <div class="sgh-table-container">
                <table class="sgh-table" aria-label="Vital signs history">
                  <thead>
                    <tr>
                      <th>Date / time</th>
                      <th>Recorded by</th>
                      <th>Temp</th>
                      <th>Heart rate</th>
                      <th>BP (sys/dia)</th>
                      <th>SpO2</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of vitalsList(); track v.id) {
                      <tr>
                        <td>{{ v.recordedAt | localDatetime }}</td>
                        <td>{{ (staffName(v.recordedBy) | async) || '—' }}</td>
                        <td>{{ v.temperature ? v.temperature + ' °C' : '—' }}</td>
                        <td>{{ v.heartRate ? v.heartRate + ' bpm' : '—' }}</td>
                        <td>
                          {{
                            v.systolic && v.diastolic
                              ? v.systolic + '/' + v.diastolic + ' mmHg'
                              : '—'
                          }}
                        </td>
                        <td>{{ v.spo2 ? v.spo2 + ' %' : '—' }}</td>
                        <td>{{ v.weight ? v.weight + ' kg' : '—' }}</td>
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
        </div>
      } @else {
        <app-empty-state
          icon="search"
          title="Select a patient"
          message="Search and select a patient above to record or view vital signs."
        />
      }
    </div>
  `,
  styles: `
    .search-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px 20px;
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      box-shadow: var(--sgh-shadow-sm);
    }
    .patient-search-field {
      width: 100%;
      max-width: 520px;
    }
    .patient-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-radius: var(--sgh-radius);
      background: var(--sgh-brand-container);
      color: var(--sgh-on-brand-container);
      border: 1px solid var(--sgh-border-subtle);
      box-shadow: var(--sgh-shadow-sm);
      margin-bottom: 24px;
    }
    .patient-icon {
      color: var(--sgh-brand);
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .birth-date {
      opacity: 0.9;
      font-size: 0.88rem;
    }
    .vitals-layout {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .vitals-card {
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      padding: 24px;
      box-shadow: var(--sgh-shadow-sm);
    }
    .vitals-card h3 {
      margin: 0 0 16px 0;
      font-size: var(--sgh-text-lg);
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--sgh-text);
    }
    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .history-header h3 {
      margin: 0;
      font-size: var(--sgh-text-lg);
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--sgh-text);
    }
  `,
})
export class VitalsPageComponent implements OnInit {
  private readonly consultationApi = inject(ConsultationApi);
  private readonly patientApi = inject(PatientApi);
  private readonly nameLookup = inject(NameLookupService);

  protected readonly patientOptions = signal<PatientSummary[]>([]);
  protected readonly selectedPatient = signal<PatientSummary | null>(null);

  protected readonly vitalsList = signal<VitalSigns[]>([]);
  protected readonly totalElements = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loadingHistory = signal(false);
  protected readonly historyError = signal(false);

  protected readonly searchForm = new FormGroup({
    patientSearch: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.searchForm.controls.patientSearch.valueChanges
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
  }

  onPatientSelected(patient: PatientSummary): void {
    this.selectedPatient.set(patient);
    this.searchForm.controls.patientSearch.setValue(patient.fullName, {
      emitEvent: false,
    });
    this.page.set(0);
    this.loadVitalsHistory();
  }

  clearPatient(): void {
    this.selectedPatient.set(null);
    this.searchForm.controls.patientSearch.setValue('', { emitEvent: false });
    this.patientOptions.set([]);
    this.vitalsList.set([]);
    this.totalElements.set(0);
  }

  loadVitalsHistory(): void {
    const p = this.selectedPatient();
    if (!p) return;

    this.loadingHistory.set(true);
    this.historyError.set(false);

    this.consultationApi
      .listVitals({
        patientId: p.id,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (res) => {
          this.vitalsList.set(res.content);
          this.totalElements.set(res.totalElements);
          this.loadingHistory.set(false);
        },
        error: () => {
          this.loadingHistory.set(false);
          this.historyError.set(true);
        },
      });
  }

  onVitalRecorded(): void {
    this.loadVitalsHistory();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.size.set(event.pageSize);
    this.loadVitalsHistory();
  }

  staffName(staffId: string): Observable<string> {
    return this.nameLookup.getDoctorName(staffId);
  }
}
