import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { NotificationApi } from '../../../core/api/notification.api';
import type { NotificationSeverity } from '../../../core/models/notification';

@Component({
  selector: 'app-create-notification-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="title-icon">add_alert</mat-icon>
      <span>Broadcast Clinical Notification</span>
    </h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="alert-form" id="create-notification-form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Alert Title</mat-label>
          <input matInput formControlName="title" placeholder="e.g. ICU Bed Alert or Maintenance Notice" />
          <mat-error *ngIf="form.controls.title.hasError('required')">Title is required</mat-error>
        </mat-form-field>

        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Event Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="system.alert">System Alert (system.alert)</mat-option>
              <mat-option value="appointment.created">Appointment Created (appointment.created)</mat-option>
              <mat-option value="appointment.cancelled">Appointment Cancelled (appointment.cancelled)</mat-option>
              <mat-option value="clinical.alert">Clinical Urgent Triage (clinical.alert)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Severity Level</mat-label>
            <mat-select formControlName="severity">
              <mat-option value="INFO">
                <span class="dot-info">●</span> INFO (Routine)
              </mat-option>
              <mat-option value="WARNING">
                <span class="dot-warning">●</span> WARNING (Action Required)
              </mat-option>
              <mat-option value="CRITICAL">
                <span class="dot-critical">●</span> CRITICAL (Urgent Triage)
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Message Content</mat-label>
          <textarea
            matInput
            rows="3"
            formControlName="message"
            placeholder="Detailed description of the clinical event or alert..."
          ></textarea>
          <mat-error *ngIf="form.controls.message.hasError('required')">Message is required</mat-error>
        </mat-form-field>

        <div *ngIf="errorMessage()" class="error-banner">
          <mat-icon>error</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close [disabled]="loading()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        form="create-notification-form"
        type="submit"
        [disabled]="form.invalid || loading()"
        class="submit-btn"
      >
        <mat-icon *ngIf="!loading()">send</mat-icon>
        <span>{{ loading() ? 'Broadcasting...' : 'Broadcast Notification' }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.125rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        .title-icon {
          color: #0284c7;
        }
      }

      .dialog-content {
        min-width: 480px;
        max-width: 600px;
      }

      .alert-form {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-top: 0.5rem;
      }

      .w-full {
        width: 100%;
      }

      .row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .dot-info {
        color: #0284c7;
        font-weight: bold;
      }
      .dot-warning {
        color: #d97706;
        font-weight: bold;
      }
      .dot-critical {
        color: #dc2626;
        font-weight: bold;
      }

      .error-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 0.5rem;
        color: #b91c1c;
        font-size: 0.8125rem;
        margin-bottom: 0.5rem;
      }

      .dialog-actions {
        padding: 0.75rem 1.25rem 1rem;
        .submit-btn {
          border-radius: 9999px;
          font-weight: 600;
        }
      }
    `,
  ],
})
export class CreateNotificationDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateNotificationDialogComponent>);
  private readonly api = inject(NotificationApi);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    type: new FormControl('system.alert', { nonNullable: true, validators: [Validators.required] }),
    severity: new FormControl<NotificationSeverity>('INFO', { nonNullable: true, validators: [Validators.required] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const val = this.form.getRawValue();
    this.api
      .create({
        title: val.title,
        type: val.type,
        severity: val.severity,
        message: val.message,
      })
      .subscribe({
        next: (created) => {
          this.loading.set(false);
          this.dialogRef.close(created);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const msg = err instanceof Error ? err.message : 'Failed to create notification. Please verify service connection.';
          this.errorMessage.set(msg);
        },
      });
  }
}
