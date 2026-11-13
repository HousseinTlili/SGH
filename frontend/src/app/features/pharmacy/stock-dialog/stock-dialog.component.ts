import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Drug } from '../../../core/models/pharmacy';

export interface StockDialogData {
  drug: Drug;
}

export interface StockDialogResult {
  delta: number;
  reason: string;
}

@Component({
  selector: 'app-stock-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Adjust Stock: {{ data.drug.name }} ({{ data.drug.strength }})</h2>
    <mat-dialog-content>
      <p class="current-stock">
        Current stock: <strong>{{ data.drug.stock }} {{ data.drug.unit }}</strong>
      </p>

      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Adjustment (Delta)</mat-label>
          <input matInput type="number" formControlName="delta" placeholder="e.g. 50 or -10" />
          <mat-hint>Positive to add stock, negative to deduct</mat-hint>
          @if (form.controls.delta.hasError('required')) {
            <mat-error>Delta is required</mat-error>
          }
          @if (form.controls.delta.hasError('zero')) {
            <mat-error>Delta cannot be zero</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Reason</mat-label>
          <input
            matInput
            formControlName="reason"
            placeholder="e.g. Shipment received or Damaged packaging"
          />
          @if (form.controls.reason.hasError('required')) {
            <mat-error>Reason is required (1-200 characters)</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid"
        (click)="submit()"
      >
        Confirm Adjustment
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .current-stock {
      margin-top: 0;
      margin-bottom: 1.5rem;
      color: var(--sgh-text);
    }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 320px;
    }
  `,
})
export class StockDialogComponent {
  protected readonly data = inject<StockDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<StockDialogComponent, StockDialogResult>>(MatDialogRef);

  protected readonly form = new FormGroup({
    delta: new FormControl<number | null>(null, [
      Validators.required,
      (control) => (control.value === 0 ? { zero: true } : null),
    ]),
    reason: new FormControl<string>('', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(200),
    ]),
  });

  protected submit(): void {
    if (this.form.invalid) return;
    const delta = this.form.controls.delta.value!;
    const reason = this.form.controls.reason.value!.trim();
    this.dialogRef.close({ delta, reason });
  }
}
