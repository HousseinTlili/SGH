import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

export interface PayInvoiceDialogData {
  invoiceId: string;
  total: number;
}

@Component({
  selector: 'app-pay-invoice-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatRadioModule,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Mark invoice as paid</h2>
    <mat-dialog-content>
      <p class="amount">
        Total amount: <strong>{{ data.total | money }}</strong>
      </p>

      <div class="simulation-note">
        <em>Payment is simulated, no card data is entered.</em>
      </div>

      <div class="method-section">
        <span id="payment-method-label" class="method-label">Payment Method</span>
        <mat-radio-group
          aria-labelledby="payment-method-label"
          [formControl]="methodControl"
          class="radio-group"
        >
          <mat-radio-button value="CASH">Cash</mat-radio-button>
          <mat-radio-button value="CARD">Bank Card</mat-radio-button>
        </mat-radio-group>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close(null)">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="dialogRef.close(methodControl.value)"
      >
        Confirm payment
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .amount {
      font-size: var(--sgh-font-size-lg);
      margin-bottom: var(--sgh-space-3);
    }
    .simulation-note {
      padding: var(--sgh-space-3);
      background: var(--sgh-tone-info-bg);
      color: var(--sgh-tone-info-fg);
      border-radius: var(--sgh-radius-sm);
      margin-bottom: var(--sgh-space-4);
    }
    .method-section {
      display: flex;
      flex-direction: column;
      gap: var(--sgh-space-2);
    }
    .radio-group {
      display: flex;
      gap: var(--sgh-space-4);
    }
  `,
})
export class PayInvoiceDialogComponent {
  protected readonly data = inject<PayInvoiceDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<PayInvoiceDialogComponent, 'CASH' | 'CARD' | null>>(MatDialogRef);

  readonly methodControl = new FormControl<'CASH' | 'CARD'>('CASH', {
    nonNullable: true,
  });
}
