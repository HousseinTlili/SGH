import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { LabApi } from '../../../core/api/lab.api';
import type { LabOrder, LabTestRef } from '../../../core/models/consultation';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { FALLBACK_CATALOGUE_TESTS } from '../consultation-rules';

export interface LabOrderDialogData {
  consultationId: string;
}

@Component({
  selector: 'app-lab-order-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>New laboratory order</h2>
    <mat-dialog-content class="lab-order-dialog-content">
      @if (labDown()) {
        <div class="sgh-alert-warning" role="alert">
          <mat-icon>warning</mat-icon>
          <div>
            <strong>Lab service is down</strong>
            <p>The order will be processed when it is back.</p>
          </div>
        </div>
      }

      @if (errorMessage()) {
        <div class="sgh-form-error" role="alert">
          <mat-icon>error</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <form [formGroup]="form" class="lab-form">
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            <mat-option value="ROUTINE">Routine</mat-option>
            <mat-option value="URGENT">Urgent</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Laboratory tests (1 to 10)</mat-label>
          <mat-select formControlName="tests" multiple>
            @for (test of availableTests(); track test.code) {
              <mat-option [value]="test"> {{ test.code }} — {{ test.name }} </mat-option>
            }
          </mat-select>
          @if (form.controls.tests.hasError('required')) {
            <mat-error>Select at least one test</mat-error>
          }
          @if (form.controls.tests.hasError('maxSelected')) {
            <mat-error>Maximum 10 tests per order</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="loading()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid || loading()"
        (click)="onSubmit()"
      >
        <mat-icon>science</mat-icon>
        Order tests
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .lab-order-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 450px;
    }
    .lab-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sgh-alert-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--sgh-radius-md, 8px);
      background: var(--sgh-tone-warning-bg);
      color: var(--sgh-tone-warning-fg);
      border: 1px solid var(--sgh-tone-warning-solid);
    }
    .sgh-alert-warning p {
      margin: 2px 0 0;
      font-size: 0.875rem;
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
export class LabOrderDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<LabOrderDialogComponent>);
  private readonly data = inject<LabOrderDialogData>(MAT_DIALOG_DATA);
  private readonly consultationApi = inject(ConsultationApi);
  private readonly labApi = inject(LabApi);
  private readonly serviceStatus = inject(ServiceStatusService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal(false);
  protected readonly labDown = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly availableTests = signal<LabTestRef[]>([...FALLBACK_CATALOGUE_TESTS]);

  protected readonly form = new FormGroup({
    priority: new FormControl<'ROUTINE' | 'URGENT'>('ROUTINE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    tests: new FormControl<LabTestRef[]>([], {
      nonNullable: true,
      validators: [
        Validators.required,
        (ctrl) => (ctrl.value && ctrl.value.length > 10 ? { maxSelected: true } : null),
      ],
    }),
  });

  ngOnInit(): void {
    const isUp = this.serviceStatus.isUp('lab');
    if (!isUp) {
      this.labDown.set(true);
      this.availableTests.set([...FALLBACK_CATALOGUE_TESTS]);
      return;
    }

    this.labApi.getTests().subscribe({
      next: (tests) => {
        if (tests && tests.length > 0) {
          this.availableTests.set(tests.map((t) => ({ code: t.code, name: t.name })));
        } else {
          this.availableTests.set([...FALLBACK_CATALOGUE_TESTS]);
        }
      },
      error: () => {
        this.labDown.set(true);
        this.availableTests.set([...FALLBACK_CATALOGUE_TESTS]);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const val = this.form.getRawValue();
    this.consultationApi
      .createLabOrder(this.data.consultationId, {
        priority: val.priority,
        tests: val.tests,
      })
      .subscribe({
        next: (order: LabOrder) => {
          this.loading.set(false);
          this.snackBar.open('Order sent', 'Dismiss', { duration: 3000 });
          this.dialogRef.close(order);
        },
        error: (err: { message?: string }) => {
          this.loading.set(false);
          this.errorMessage.set(err.message || 'Failed to submit lab order');
        },
      });
  }
}
