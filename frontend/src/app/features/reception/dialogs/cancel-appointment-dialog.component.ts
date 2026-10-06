import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface CancelAppointmentDialogData {
  appointmentId: string;
}

@Component({
  selector: 'app-cancel-appointment-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Cancel appointment</h2>
    <mat-dialog-content>
      <p>Are you sure you want to cancel this appointment?</p>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>Reason (optional)</mat-label>
        <textarea
          matInput
          rows="3"
          [formControl]="reasonControl"
          maxlength="255"
          placeholder="e.g. Patient requested cancellation"
        ></textarea>
        <mat-hint align="end">{{ reasonControl.value.length }}/255</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close(null)">Back</button>
      <button mat-flat-button color="warn" type="button" (click)="onConfirm()">
        Cancel appointment
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .w-full {
      width: 100%;
      margin-top: var(--sgh-space-3);
    }
  `,
})
export class CancelAppointmentDialogComponent {
  protected readonly data = inject<CancelAppointmentDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<CancelAppointmentDialogComponent, string | null>>(MatDialogRef);

  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(255)],
  });

  onConfirm(): void {
    const reason = this.reasonControl.value.trim() || undefined;
    this.dialogRef.close(reason ?? '');
  }
}
