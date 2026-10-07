import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { PatientApi } from '../../../core/api/patient.api';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type {
  Consultation,
  LabOrder,
  LabResultLine,
  Prescription,
  VitalSigns,
} from '../../../core/models/consultation';
import type { Patient } from '../../../core/models/patient';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FlagBadgeComponent } from '../../../shared/components/flag-badge/flag-badge.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { calculateAge } from '../../patients/patient-rules';
import {
  canEditConsultationNotes,
  canOrderLab,
  canPrescribe,
  canRecordVitals,
  canSignConsultation,
} from '../consultation-rules';
import {
  LabOrderDialogComponent,
  type LabOrderDialogData,
} from '../lab-order-dialog/lab-order-dialog.component';
import {
  PrescriptionDialogComponent,
  type PrescriptionDialogData,
} from '../prescription-dialog/prescription-dialog.component';
import { VitalSignsFormComponent } from '../vital-signs-form/vital-signs-form.component';

interface FlattenedLabResult {
  testCode: string;
  value: number;
  unit: string;
  referenceRange: string;
  flag: LabResultLine['flag'];
  validatedAt: string;
}

@Component({
  selector: 'app-consultation-workspace',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    RouterLink,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    StatusBadgeComponent,
    FlagBadgeComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ServiceGateDirective,
    LocalDatetimePipe,
    VitalSignsFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *appServiceGate="'consultation'">
      @if (loading()) {
        <app-loading-state message="Loading consultation workspace..." />
      } @else if (error()) {
        <app-error-state message="Failed to load consultation" (retry)="loadConsultation()" />
      } @else if (consultation()) {
        <!-- Consultation Header -->
        <header class="workspace-header">
          <div class="header-main">
            <div class="breadcrumb">
              <a routerLink="/consultations" class="back-link">
                <mat-icon>arrow_back</mat-icon> Consultations
              </a>
            </div>

            @if (!patientSnapshot() && !patient()) {
              <div class="sgh-alert-warning" role="alert">
                <mat-icon>warning</mat-icon>
                <span>Patient details are unavailable</span>
              </div>
            }

            <div class="patient-title-row">
              <h1 class="patient-name">{{ patientDisplayName() }}</h1>
              <app-status-badge [status]="consultation()!.status" />
              @if (consultation()!.status === 'SIGNED' && consultation()!.signedAt) {
                <span class="signed-info">
                  Signed {{ consultation()!.signedAt | localDatetime }}
                </span>
              }
            </div>

            <div class="patient-meta">
              @if (patientBirthDate()) {
                <span>
                  <strong>Birth date:</strong> {{ patientBirthDate() }}
                  @if (patientAge() !== null) {
                    ({{ patientAge() }} years)
                  }
                </span>
              }
              <span>
                <strong>Doctor:</strong> {{ (doctorName(consultation()!.doctorId) | async) || '—' }}
              </span>
              <span> <strong>Date:</strong> {{ consultation()!.createdAt | localDatetime }} </span>
            </div>

            @if (patientAllergies()) {
              <div class="patient-allergies" role="alert">
                <mat-icon class="allergies-icon">warning</mat-icon>
                <strong>Allergies:</strong>
                <span>{{ patientAllergies() }}</span>
              </div>
            }
          </div>
        </header>

        <!-- Tabs Navigation -->
        <mat-tab-group animationDuration="150ms" class="workspace-tabs">
          <!-- TAB 1: Notes (SOAP) -->
          <mat-tab label="Notes (SOAP)">
            <div class="tab-pane">
              @if (soapError()) {
                <div class="sgh-form-error" role="alert">
                  <mat-icon>error</mat-icon>
                  <span>{{ soapError() }}</span>
                </div>
              }

              @if (isEditable()) {
                <form [formGroup]="soapForm" class="soap-form">
                  <div class="soap-grid">
                    <mat-form-field appearance="outline" class="soap-field">
                      <mat-label>Subjective (S)</mat-label>
                      <textarea
                        matInput
                        rows="4"
                        formControlName="subjective"
                        placeholder="Patient symptoms, history, and chief complaint..."
                        maxlength="4000"
                      ></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="soap-field">
                      <mat-label>Objective (O)</mat-label>
                      <textarea
                        matInput
                        rows="4"
                        formControlName="objective"
                        placeholder="Clinical observations, physical examination findings..."
                        maxlength="4000"
                      ></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="soap-field">
                      <mat-label>Assessment (A) *</mat-label>
                      <textarea
                        matInput
                        rows="4"
                        formControlName="assessment"
                        placeholder="Differential diagnosis, clinical impression..."
                        maxlength="4000"
                      ></textarea>
                      @if (soapForm.controls.assessment.hasError('maxlength')) {
                        <mat-error>Maximum 4000 characters</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="soap-field">
                      <mat-label>Plan (P) *</mat-label>
                      <textarea
                        matInput
                        rows="4"
                        formControlName="plan"
                        placeholder="Treatment plan, follow-up, patient instructions..."
                        maxlength="4000"
                      ></textarea>
                      @if (soapForm.controls.plan.hasError('maxlength')) {
                        <mat-error>Maximum 4000 characters</mat-error>
                      }
                    </mat-form-field>
                  </div>

                  <div class="soap-actions">
                    <button
                      mat-stroked-button
                      type="button"
                      [disabled]="savingSoap() || signingSoap()"
                      (click)="onSaveDraft()"
                    >
                      <mat-icon>save</mat-icon>
                      Save draft
                    </button>

                    <div
                      class="sign-action-wrapper"
                      [matTooltip]="signDisabledReason()"
                      [matTooltipDisabled]="canSign()"
                    >
                      <button
                        mat-flat-button
                        color="primary"
                        type="button"
                        [disabled]="!canSign() || savingSoap() || signingSoap()"
                        (click)="onSign()"
                      >
                        <mat-icon>verified</mat-icon>
                        Sign consultation
                      </button>
                    </div>
                  </div>
                </form>
              } @else {
                <!-- Read-only SOAP display -->
                <div class="soap-readonly-view">
                  @if (consultation()!.status === 'SIGNED') {
                    <div class="signed-banner">
                      <mat-icon>lock</mat-icon>
                      <span>This consultation is signed and cannot be edited.</span>
                    </div>
                  } @else {
                    <div class="info-banner">
                      <mat-icon>info</mat-icon>
                      <span>Only the attending doctor can edit draft notes.</span>
                    </div>
                  }

                  <div class="soap-readonly-grid">
                    <div class="soap-card">
                      <h3>Subjective (S)</h3>
                      <p>{{ consultation()!.subjective || '—' }}</p>
                    </div>
                    <div class="soap-card">
                      <h3>Objective (O)</h3>
                      <p>{{ consultation()!.objective || '—' }}</p>
                    </div>
                    <div class="soap-card">
                      <h3>Assessment (A)</h3>
                      <p>{{ consultation()!.assessment || '—' }}</p>
                    </div>
                    <div class="soap-card">
                      <h3>Plan (P)</h3>
                      <p>{{ consultation()!.plan || '—' }}</p>
                    </div>
                  </div>
                </div>
              }
            </div>
          </mat-tab>

          <!-- TAB 2: Vital signs -->
          <mat-tab label="Vital signs">
            <div class="tab-pane">
              @if (canRecordVitals()) {
                <div class="vitals-record-section">
                  <h3>Record new vital signs</h3>
                  <app-vital-signs-form
                    [patientId]="consultation()!.patientId"
                    [consultationId]="consultation()!.id"
                    (saved)="onVitalRecorded()"
                  />
                </div>
              }

              <div class="vitals-history-section">
                <h3>Consultation measurements</h3>
                @if (vitalsLoading()) {
                  <app-loading-state message="Loading vital signs..." />
                } @else if (vitals().length === 0) {
                  <app-empty-state
                    icon="monitor_heart"
                    title="No vital signs recorded"
                    message="No vital signs measurements have been captured for this consultation."
                  />
                } @else {
                  <div class="sgh-table-container">
                    <table class="sgh-table" aria-label="Vital signs table">
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
                        @for (v of vitals(); track v.id) {
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
                  </div>
                }
              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: Prescriptions -->
          <mat-tab label="Prescriptions">
            <div class="tab-pane">
              <div class="section-header">
                <h3>Prescriptions</h3>
                @if (canPrescribe()) {
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    (click)="openNewPrescriptionDialog()"
                  >
                    <mat-icon>medication</mat-icon>
                    New prescription
                  </button>
                }
              </div>

              @if (prescriptionsLoading()) {
                <app-loading-state message="Loading prescriptions..." />
              } @else if (prescriptions().length === 0) {
                <app-empty-state
                  icon="medication"
                  title="No prescriptions"
                  message="No prescriptions have been issued for this consultation."
                />
              } @else {
                <div class="prescriptions-stack">
                  @for (p of prescriptions(); track p.id) {
                    <div class="prescription-card">
                      <div class="prescription-card-header">
                        <div>
                          <strong>Prescribed:</strong>
                          <span>{{ p.createdAt | localDatetime }}</span>
                        </div>
                        <div>
                          @if (isDoctor()) {
                            @if (dispensingStatusMap()[p.id] === 'UNAVAILABLE') {
                              <span class="sgh-text-muted">Pharmacy status unavailable</span>
                            } @else if (dispensingStatusMap()[p.id]) {
                              <app-status-badge [status]="dispensingStatusMap()[p.id]!" />
                            } @else {
                              <span class="sgh-text-muted">Checking dispensing...</span>
                            }
                          } @else {
                            <app-status-badge [status]="p.status" />
                          }
                        </div>
                      </div>

                      <table class="sgh-table" aria-label="Prescription items">
                        <thead>
                          <tr>
                            <th>Medication</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of p.items; track $index) {
                            <tr>
                              <td>
                                <strong>{{ item.drugName }}</strong>
                              </td>
                              <td>{{ item.dosage }}</td>
                              <td>{{ item.frequency }}</td>
                              <td>{{ item.duration }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- TAB 4: Lab -->
          <mat-tab label="Lab">
            <div class="tab-pane">
              <!-- Lab Orders -->
              <div class="section-header">
                <h3>Laboratory orders</h3>
                @if (canOrderLab()) {
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    (click)="openNewLabOrderDialog()"
                  >
                    <mat-icon>science</mat-icon>
                    New lab order
                  </button>
                }
              </div>

              @if (labOrdersLoading()) {
                <app-loading-state message="Loading lab orders..." />
              } @else if (labOrders().length === 0) {
                <app-empty-state
                  icon="science"
                  title="No lab orders"
                  message="No laboratory orders have been requested for this consultation."
                />
              } @else {
                <div class="sgh-table-container">
                  <table class="sgh-table" aria-label="Lab orders table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Priority</th>
                        <th>Tests</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (order of labOrders(); track order.id) {
                        <tr>
                          <td>{{ order.createdAt | localDatetime }}</td>
                          <td>
                            <app-status-badge [status]="order.priority" />
                          </td>
                          <td>{{ formatOrderTests(order) }}</td>
                          <td>
                            <app-status-badge [status]="order.status" />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- Lab Results -->
              <div class="section-header results-header">
                <h3>Validated lab results</h3>
              </div>

              @if (labResultsLoading()) {
                <app-loading-state message="Loading lab results..." />
              } @else if (labResults().length === 0) {
                <app-empty-state
                  icon="assignment_turned_in"
                  title="No lab results yet"
                  message="Results will appear here once validated by the laboratory technician."
                />
              } @else {
                <div class="sgh-table-container">
                  <table class="sgh-table" aria-label="Validated lab results table">
                    <thead>
                      <tr>
                        <th>Validated at</th>
                        <th>Test</th>
                        <th>Value</th>
                        <th>Unit</th>
                        <th>Reference range</th>
                        <th>Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (res of labResults(); track res.testCode + res.validatedAt) {
                        <tr [class.critical-row]="res.flag === 'CRITICAL'">
                          <td>{{ res.validatedAt | localDatetime }}</td>
                          <td>
                            <strong>{{ res.testCode }}</strong>
                          </td>
                          <td>{{ res.value }}</td>
                          <td>{{ res.unit }}</td>
                          <td>{{ res.referenceRange }}</td>
                          <td>
                            <app-flag-badge [flag]="res.flag" />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: `
    .workspace-header {
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--sgh-shadow-sm);
    }
    .breadcrumb {
      margin-bottom: 12px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sgh-text-muted);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      transition: color 0.15s ease;
    }
    .back-link:hover {
      color: var(--sgh-brand);
    }
    .patient-title-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 10px;
    }
    .patient-name {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sgh-text);
    }
    .signed-info {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--sgh-tone-success-fg);
      background: var(--sgh-tone-success-bg);
      padding: 3px 10px;
      border-radius: var(--sgh-radius-pill);
      border: 1px solid var(--sgh-tone-success-solid);
    }
    .patient-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 0.88rem;
      color: var(--sgh-text-muted);
      margin-bottom: 10px;
    }
    .patient-meta strong {
      color: var(--sgh-text);
    }
    .patient-allergies {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: var(--sgh-radius-sm);
      background: var(--sgh-tone-danger-bg);
      border: 1px solid var(--sgh-tone-danger-solid);
      color: var(--sgh-tone-danger-fg);
      font-size: 0.82rem;
      margin-top: 6px;
    }
    .allergies-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .tab-pane {
      padding: 24px 0;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .soap-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) {
      .soap-grid {
        grid-template-columns: 1fr;
      }
    }
    .soap-field {
      width: 100%;
    }
    .soap-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 12px;
    }
    .sign-action-wrapper {
      display: inline-block;
    }
    .soap-readonly-view {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .signed-banner,
    .info-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: var(--sgh-radius-sm);
      font-size: 0.88rem;
      font-weight: 500;
    }
    .signed-banner {
      background: var(--sgh-tone-success-bg);
      color: var(--sgh-tone-success-fg);
      border: 1px solid var(--sgh-tone-success-solid);
    }
    .info-banner {
      background: var(--sgh-surface-1);
      color: var(--sgh-text-muted);
      border: 1px solid var(--sgh-border-subtle);
    }
    .soap-readonly-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) {
      .soap-readonly-grid {
        grid-template-columns: 1fr;
      }
    }
    .soap-card {
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      padding: 20px;
      box-shadow: var(--sgh-shadow-sm);
      transition: all 0.15s ease;
    }
    .soap-card:hover {
      border-color: var(--sgh-brand);
      box-shadow: var(--sgh-shadow-md);
    }
    .soap-card h3 {
      margin: 0 0 10px 0;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--sgh-brand);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .soap-card p {
      margin: 0;
      white-space: pre-wrap;
      color: var(--sgh-text);
      line-height: 1.6;
      font-size: 0.92rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-header h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--sgh-text);
    }
    .results-header {
      margin-top: 24px;
    }
    .prescriptions-stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .prescription-card {
      background: var(--sgh-surface);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius);
      padding: 20px;
      box-shadow: var(--sgh-shadow-sm);
    }
    .prescription-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .critical-row {
      background-color: var(--sgh-tone-danger-bg) !important;
      font-weight: 600;
    }
    .sgh-alert-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: var(--sgh-radius-sm);
      background: var(--sgh-tone-warning-bg);
      color: var(--sgh-tone-warning-fg);
      margin-bottom: 14px;
    }
    .sgh-form-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid var(--sgh-tone-danger-solid);
      border-radius: var(--sgh-radius-sm);
      background: var(--sgh-tone-danger-bg);
      color: var(--sgh-tone-danger-fg);
    }
  `,
})
export class ConsultationWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly consultationApi = inject(ConsultationApi);
  private readonly patientApi = inject(PatientApi);
  private readonly pharmacyApi = inject(PharmacyApi);
  private readonly auth = inject(AuthService);
  private readonly nameLookup = inject(NameLookupService);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly serviceStatus = inject(ServiceStatusService);

  readonly consultation = signal<Consultation | null>(null);
  readonly patient = signal<Patient | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  // SOAP State
  readonly savingSoap = signal(false);
  readonly signingSoap = signal(false);
  readonly soapError = signal<string | null>(null);

  // Vitals State
  readonly vitals = signal<VitalSigns[]>([]);
  readonly vitalsLoading = signal(false);

  // Prescriptions State
  readonly prescriptions = signal<Prescription[]>([]);
  readonly prescriptionsLoading = signal(false);
  readonly dispensingStatusMap = signal<Record<string, string | null>>({});

  // Lab Orders & Results State
  readonly labOrders = signal<LabOrder[]>([]);
  readonly labOrdersLoading = signal(false);
  readonly labResults = signal<FlattenedLabResult[]>([]);
  readonly labResultsLoading = signal(false);

  // Permissions & computed states
  protected readonly isDoctor = computed(() => this.auth.hasRole('DOCTOR'));
  protected readonly currentStaffId = computed(() => this.auth.user()?.staffId ?? '');

  protected readonly isEditable = computed(() =>
    canEditConsultationNotes(this.consultation(), this.currentStaffId(), this.isDoctor()),
  );

  protected readonly canRecordVitals = computed(() => canRecordVitals((r) => this.auth.hasRole(r)));
  protected readonly canPrescribe = computed(() => canPrescribe((r) => this.auth.hasRole(r)));
  protected readonly canOrderLab = computed(() => canOrderLab((r) => this.auth.hasRole(r)));

  protected readonly patientSnapshot = computed(() => this.consultation()?.patientSnapshot ?? null);

  protected readonly patientDisplayName = computed(() => {
    const p = this.patient();
    if (p) return `${p.firstName} ${p.lastName}`;
    const snap = this.patientSnapshot();
    if (snap?.fullName) return snap.fullName;
    return 'Patient details unavailable';
  });

  protected readonly patientBirthDate = computed(() => {
    const p = this.patient();
    if (p) return p.birthDate;
    return this.patientSnapshot()?.birthDate ?? null;
  });

  protected readonly patientAge = computed(() => calculateAge(this.patientBirthDate()));

  protected readonly patientAllergies = computed(() => {
    const p = this.patient();
    return p?.allergies || null;
  });

  // SOAP Form
  protected readonly soapForm = new FormGroup({
    subjective: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
    objective: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
    assessment: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
    plan: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
  });

  protected readonly canSign = computed(() => {
    const c = this.consultation();
    if (!this.isEditable()) return false;
    const assessment = this.soapForm.controls.assessment.value;
    const plan = this.soapForm.controls.plan.value;
    return canSignConsultation(c, this.currentStaffId(), this.isDoctor(), assessment, plan);
  });

  protected readonly signDisabledReason = computed(() => {
    if (!this.isEditable()) return 'Only the attending doctor can sign';
    const hasA = Boolean(this.soapForm.controls.assessment.value.trim());
    const hasP = Boolean(this.soapForm.controls.plan.value.trim());
    if (!hasA || !hasP) {
      return 'Assessment and Plan are required to sign the consultation';
    }
    return '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/consultations']);
      return;
    }
    this.loadConsultation();
  }

  loadConsultation(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loading.set(true);
    this.error.set(false);

    this.consultationApi.get(id).subscribe({
      next: (c) => {
        this.consultation.set(c);
        this.loading.set(false);

        // Prepopulate SOAP form
        this.soapForm.patchValue({
          subjective: c.subjective ?? '',
          objective: c.objective ?? '',
          assessment: c.assessment ?? '',
          plan: c.plan ?? '',
        });

        // Load Patient profile if patient service is UP
        this.loadPatient(c.patientId);

        // Load Tab data
        this.loadVitals(c.id);
        this.loadPrescriptions(c.id);
        this.loadLabOrders(c.id);
        this.loadLabResults(c.id);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  loadPatient(patientId: string): void {
    if (!this.serviceStatus.isUp('patient')) {
      return;
    }
    this.patientApi.get(patientId).subscribe({
      next: (p) => this.patient.set(p),
      error: () => {
        // Patient service unavailable or error; graceful fallback to snapshot
        this.patient.set(null);
      },
    });
  }

  loadVitals(consultationId: string): void {
    this.vitalsLoading.set(true);
    this.consultationApi.listVitals({ consultationId }).subscribe({
      next: (res) => {
        this.vitals.set(res.content);
        this.vitalsLoading.set(false);
      },
      error: () => this.vitalsLoading.set(false),
    });
  }

  onVitalRecorded(): void {
    const c = this.consultation();
    if (c) {
      this.loadVitals(c.id);
    }
  }

  loadPrescriptions(consultationId: string): void {
    this.prescriptionsLoading.set(true);
    this.consultationApi.getPrescriptions(consultationId).subscribe({
      next: (list) => {
        this.prescriptions.set(list);
        this.prescriptionsLoading.set(false);
        if (this.isDoctor()) {
          this.checkDispensingStatuses(list);
        }
      },
      error: () => this.prescriptionsLoading.set(false),
    });
  }

  checkDispensingStatuses(list: Prescription[]): void {
    const statusMap: Record<string, string | null> = {};
    const pharmacyUp = this.serviceStatus.isUp('pharmacy');

    for (const p of list) {
      if (!pharmacyUp) {
        statusMap[p.id] = 'UNAVAILABLE';
        this.dispensingStatusMap.set({ ...statusMap });
      } else {
        this.pharmacyApi.getPrescription(p.id).subscribe({
          next: (res) => {
            statusMap[p.id] = res.status;
            this.dispensingStatusMap.set({ ...statusMap });
          },
          error: () => {
            statusMap[p.id] = 'UNAVAILABLE';
            this.dispensingStatusMap.set({ ...statusMap });
          },
        });
      }
    }
  }

  openNewPrescriptionDialog(): void {
    const c = this.consultation();
    if (!c) return;

    this.dialog
      .open<PrescriptionDialogComponent, PrescriptionDialogData, Prescription | undefined>(
        PrescriptionDialogComponent,
        {
          data: { consultationId: c.id },
          width: '680px',
        },
      )
      .afterClosed()
      .subscribe((res) => {
        if (res) {
          this.loadPrescriptions(c.id);
        }
      });
  }

  loadLabOrders(consultationId: string): void {
    this.labOrdersLoading.set(true);
    this.consultationApi.getLabOrders(consultationId).subscribe({
      next: (orders) => {
        this.labOrders.set(orders);
        this.labOrdersLoading.set(false);
      },
      error: () => this.labOrdersLoading.set(false),
    });
  }

  openNewLabOrderDialog(): void {
    const c = this.consultation();
    if (!c) return;

    this.dialog
      .open<LabOrderDialogComponent, LabOrderDialogData, LabOrder | undefined>(
        LabOrderDialogComponent,
        {
          data: { consultationId: c.id },
          width: '500px',
        },
      )
      .afterClosed()
      .subscribe((res) => {
        if (res) {
          this.loadLabOrders(c.id);
        }
      });
  }

  loadLabResults(consultationId: string): void {
    this.labResultsLoading.set(true);
    this.consultationApi.getLabResults(consultationId).subscribe({
      next: (copies) => {
        const flattened: FlattenedLabResult[] = [];
        for (const copy of copies) {
          for (const res of copy.results) {
            flattened.push({
              testCode: res.testCode,
              value: res.value,
              unit: res.unit,
              referenceRange: res.referenceRange,
              flag: res.flag,
              validatedAt: copy.validatedAt,
            });
          }
        }
        // Newest first
        flattened.sort(
          (a, b) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime(),
        );
        this.labResults.set(flattened);
        this.labResultsLoading.set(false);
      },
      error: () => this.labResultsLoading.set(false),
    });
  }

  onSaveDraft(): void {
    const c = this.consultation();
    if (!c) return;

    this.savingSoap.set(true);
    this.soapError.set(null);

    const val = this.soapForm.getRawValue();
    this.consultationApi
      .updateNotes(c.id, {
        subjective: val.subjective,
        objective: val.objective,
        assessment: val.assessment,
        plan: val.plan,
      })
      .subscribe({
        next: (updated) => {
          this.savingSoap.set(false);
          this.consultation.set(updated);
          this.snackBar.open('Draft saved', 'Dismiss', { duration: 3000 });
        },
        error: (err: { status?: number; message?: string }) => {
          this.savingSoap.set(false);
          if (err.status === 409) {
            this.soapError.set('This consultation is already signed');
          } else {
            this.soapError.set(err.message || 'Failed to save draft');
          }
        },
      });
  }

  onSign(): void {
    const c = this.consultation();
    if (!c) return;

    this.confirm
      .confirm({
        title: 'Sign consultation',
        message: 'A signed consultation cannot be edited. Are you sure you want to sign?',
        confirmLabel: 'Sign',
        danger: false,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.signingSoap.set(true);
        this.soapError.set(null);

        // First save any unsaved notes then sign
        const val = this.soapForm.getRawValue();
        this.consultationApi
          .updateNotes(c.id, {
            subjective: val.subjective,
            objective: val.objective,
            assessment: val.assessment,
            plan: val.plan,
          })
          .subscribe({
            next: () => {
              this.consultationApi.sign(c.id).subscribe({
                next: (signed) => {
                  this.signingSoap.set(false);
                  this.consultation.set(signed);
                  this.snackBar.open('Consultation signed', 'Dismiss', { duration: 3000 });
                },
                error: (err: { status?: number; message?: string }) => {
                  this.signingSoap.set(false);
                  if (err.status === 409) {
                    this.soapError.set('This consultation is already signed');
                  } else {
                    this.soapError.set(err.message || 'Failed to sign consultation');
                  }
                },
              });
            },
            error: (err: { status?: number; message?: string }) => {
              this.signingSoap.set(false);
              if (err.status === 409) {
                this.soapError.set('This consultation is already signed');
              } else {
                this.soapError.set(err.message || 'Failed to update notes');
              }
            },
          });
      });
  }

  formatOrderTests(order: LabOrder): string {
    return order.tests.map((t) => t.name || t.code).join(', ');
  }

  doctorName(doctorId: string): Observable<string> {
    return this.nameLookup.getDoctorName(doctorId);
  }

  staffName(staffId: string): Observable<string> {
    return this.nameLookup.getDoctorName(staffId);
  }
}
