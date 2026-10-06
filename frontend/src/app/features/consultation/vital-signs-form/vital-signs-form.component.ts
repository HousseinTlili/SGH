import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConsultationApi } from '../../../core/api/consultation.api';
import type { VitalSigns } from '../../../core/models/consultation';
import { VITALS_RANGES, vitalsFormValidator } from '../consultation-rules';

@Component({
  selector: 'app-vital-signs-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="vitals-form">
      <div class="vitals-grid">
        <mat-form-field appearance="outline">
          <mat-label>Temperature ({{ ranges.temperature.unit }})</mat-label>
          <input
            matInput
            type="number"
            step="0.1"
            formControlName="temperature"
            [placeholder]="'30.0 - 45.0'"
          />
          <span matTextSuffix>{{ ranges.temperature.unit }}</span>
          @if (form.controls.temperature.hasError('range')) {
            <mat-error>{{ form.controls.temperature.getError('range') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Heart rate ({{ ranges.heartRate.unit }})</mat-label>
          <input
            matInput
            type="number"
            step="1"
            formControlName="heartRate"
            [placeholder]="'20 - 250'"
          />
          <span matTextSuffix>{{ ranges.heartRate.unit }}</span>
          @if (form.controls.heartRate.hasError('range')) {
            <mat-error>{{ form.controls.heartRate.getError('range') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Systolic BP ({{ ranges.systolic.unit }})</mat-label>
          <input
            matInput
            type="number"
            step="1"
            formControlName="systolic"
            [placeholder]="'50 - 260'"
          />
          <span matTextSuffix>{{ ranges.systolic.unit }}</span>
          @if (form.controls.systolic.hasError('range')) {
            <mat-error>{{ form.controls.systolic.getError('range') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Diastolic BP ({{ ranges.diastolic.unit }})</mat-label>
          <input
            matInput
            type="number"
            step="1"
            formControlName="diastolic"
            [placeholder]="'30 - 160'"
          />
          <span matTextSuffix>{{ ranges.diastolic.unit }}</span>
          @if (form.controls.diastolic.hasError('range')) {
            <mat-error>{{ form.controls.diastolic.getError('range') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>SpO2 ({{ ranges.spo2.unit }})</mat-label>
          <input
            matInput
            type="number"
            step="1"
            formControlName="spo2"
            [placeholder]="'50 - 100'"
          />
          <span matTextSuffix>{{ ranges.spo2.unit }}</span>
          @if (form.controls.spo2.hasError('range')) {
            <mat-error>{{ form.controls.spo2.getError('range') }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Weight ({{ ranges.weight.unit }})</mat-label>
          <input
            matInput
            type="number"
            step="0.1"
            formControlName="weight"
            [placeholder]="'0.5 - 400.0'"
          />
          <span matTextSuffix>{{ ranges.weight.unit }}</span>
          @if (form.controls.weight.hasError('range')) {
            <mat-error>{{ form.controls.weight.getError('range') }}</mat-error>
          }
        </mat-form-field>
      </div>

      @if (formError()) {
        <div class="sgh-form-error" role="alert">
          <mat-icon>error</mat-icon>
          <span>{{ formError() }}</span>
        </div>
      }

      <div class="vitals-actions">
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="form.invalid || submitting() || !patientId()"
        >
          <mat-icon>add</mat-icon>
          Record vital signs
        </button>
      </div>
    </form>
  `,
  styles: `
    .vitals-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .vitals-actions {
      display: flex;
      justify-content: flex-end;
    }
    .sgh-form-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--sgh-tone-danger-solid);
      border-radius: var(--sgh-radius-sm, 4px);
      background: var(--sgh-tone-danger-bg);
      color: var(--sgh-tone-danger-fg);
    }
  `,
})
export class VitalSignsFormComponent {
  private readonly consultationApi = inject(ConsultationApi);
  private readonly snackBar = inject(MatSnackBar);

  readonly patientId = input<string | null>(null);
  readonly consultationId = input<string | null>(null);

  readonly saved = output<VitalSigns>();

  protected readonly ranges = VITALS_RANGES;
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = new FormGroup(
    {
      temperature: new FormControl<number | null>(null),
      heartRate: new FormControl<number | null>(null),
      systolic: new FormControl<number | null>(null),
      diastolic: new FormControl<number | null>(null),
      spo2: new FormControl<number | null>(null),
      weight: new FormControl<number | null>(null),
    },
    { validators: vitalsFormValidator() },
  );

  onSubmit(): void {
    const pid = this.patientId();
    if (!pid) {
      this.formError.set('A patient must be selected');
      return;
    }

    if (this.form.invalid) {
      if (this.form.hasError('atLeastOneRequired')) {
        this.formError.set('At least one vital measurement is required');
      } else {
        this.formError.set('Please check the highlighted vital signs ranges');
      }
      return;
    }

    this.formError.set(null);
    this.submitting.set(true);

    const val = this.form.value;
    const input = {
      patientId: pid,
      consultationId: this.consultationId() || null,
      temperature: val.temperature != null ? Number(val.temperature) : null,
      heartRate: val.heartRate != null ? Math.round(Number(val.heartRate)) : null,
      systolic: val.systolic != null ? Math.round(Number(val.systolic)) : null,
      diastolic: val.diastolic != null ? Math.round(Number(val.diastolic)) : null,
      spo2: val.spo2 != null ? Number(val.spo2) : null,
      weight: val.weight != null ? Number(val.weight) : null,
    };

    this.consultationApi.recordVitals(input).subscribe({
      next: (vital) => {
        this.submitting.set(false);
        this.snackBar.open('Vital signs recorded', 'Dismiss', { duration: 3000 });
        this.form.reset();
        this.saved.emit(vital);
      },
      error: (err: { message?: string }) => {
        this.submitting.set(false);
        this.formError.set(err.message || 'Failed to record vital signs');
      },
    });
  }
}
