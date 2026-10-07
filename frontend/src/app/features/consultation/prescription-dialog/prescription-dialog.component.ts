import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConsultationApi } from '../../../core/api/consultation.api';
import type { PrescriptionItem } from '../../../core/models/consultation';

export interface PrescriptionDialogData {
  consultationId: string;
}

interface ItemFormGroup {
  drugName: FormControl<string>;
  dosage: FormControl<string>;
  frequency: FormControl<string>;
  duration: FormControl<string>;
}

@Component({
  selector: 'app-prescription-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>New prescription</h2>
    <mat-dialog-content class="prescription-dialog-content">
      <p class="sgh-text-muted">
        Prescribe medications for this consultation. You can add up to 20 items.
      </p>

      @if (errorMessage()) {
        <div class="sgh-form-error" role="alert">
          <mat-icon>error</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <form [formGroup]="form">
        <div formArrayName="items" class="items-list">
          @for (item of itemsArray.controls; track $index) {
            <div [formGroupName]="$index" class="item-row">
              <span class="row-number">#{{ $index + 1 }}</span>

              <mat-form-field appearance="outline" class="col-drug">
                <mat-label>Medication *</mat-label>
                <input
                  matInput
                  formControlName="drugName"
                  placeholder="e.g. Amoxicillin"
                  maxlength="120"
                />
                @if (item.get('drugName')?.hasError('required')) {
                  <mat-error>Drug name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="col-dosage">
                <mat-label>Dosage *</mat-label>
                <input matInput formControlName="dosage" placeholder="e.g. 500mg" maxlength="60" />
                @if (item.get('dosage')?.hasError('required')) {
                  <mat-error>Dosage is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="col-freq">
                <mat-label>Frequency *</mat-label>
                <input
                  matInput
                  formControlName="frequency"
                  placeholder="e.g. 3 times daily"
                  maxlength="60"
                />
                @if (item.get('frequency')?.hasError('required')) {
                  <mat-error>Frequency is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="col-dur">
                <mat-label>Duration *</mat-label>
                <input
                  matInput
                  formControlName="duration"
                  placeholder="e.g. 7 days"
                  maxlength="60"
                />
                @if (item.get('duration')?.hasError('required')) {
                  <mat-error>Duration is required</mat-error>
                }
              </mat-form-field>

              <button
                mat-icon-button
                type="button"
                color="warn"
                [disabled]="itemsArray.length <= 1"
                (click)="removeItem($index)"
                aria-label="Remove item"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>

        <div class="add-row-action">
          <button mat-button type="button" [disabled]="itemsArray.length >= 20" (click)="addItem()">
            <mat-icon>add</mat-icon>
            Add medication ({{ itemsArray.length }}/20)
          </button>
        </div>
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
        <mat-icon>send</mat-icon>
        Send to pharmacy
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .prescription-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 620px;
      max-width: 840px;
      padding-top: 8px;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .item-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--sgh-surface-1);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: var(--sgh-radius-sm);
      transition: border-color 0.15s ease;
      &:focus-within {
        border-color: var(--sgh-brand);
      }
    }
    .row-number {
      font-weight: 700;
      font-size: 0.85rem;
      width: 28px;
      color: var(--sgh-brand);
    }
    .col-drug {
      flex: 2;
    }
    .col-dosage {
      flex: 1.2;
    }
    .col-freq {
      flex: 1.4;
    }
    .col-dur {
      flex: 1.2;
    }
    .add-row-action {
      margin-top: 12px;
    }
    .sgh-form-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid var(--sgh-tone-danger-solid);
      border-radius: var(--sgh-radius-sm, 4px);
      background: var(--sgh-tone-danger-bg);
      color: var(--sgh-tone-danger-fg);
      font-size: 0.88rem;
    }
  `,
})
export class PrescriptionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PrescriptionDialogComponent>);
  private readonly data = inject<PrescriptionDialogData>(MAT_DIALOG_DATA);
  private readonly consultationApi = inject(ConsultationApi);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly itemsArray = new FormArray<FormGroup<ItemFormGroup>>([
    this.createItemFormGroup(),
  ]);

  protected readonly form = new FormGroup({
    items: this.itemsArray,
  });

  private createItemFormGroup(): FormGroup<ItemFormGroup> {
    return new FormGroup<ItemFormGroup>({
      drugName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(120)],
      }),
      dosage: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(60)],
      }),
      frequency: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(60)],
      }),
      duration: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(60)],
      }),
    });
  }

  addItem(): void {
    if (this.itemsArray.length < 20) {
      this.itemsArray.push(this.createItemFormGroup());
    }
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const rawItems: PrescriptionItem[] = this.itemsArray.controls.map((ctrl) => ({
      drugName: ctrl.controls.drugName.value.trim(),
      dosage: ctrl.controls.dosage.value.trim(),
      frequency: ctrl.controls.frequency.value.trim(),
      duration: ctrl.controls.duration.value.trim(),
    }));

    this.consultationApi.createPrescription(this.data.consultationId, rawItems).subscribe({
      next: (created) => {
        this.loading.set(false);
        this.snackBar.open('Sent to the pharmacy', 'Dismiss', { duration: 3000 });
        this.dialogRef.close(created);
      },
      error: (err: { message?: string }) => {
        this.loading.set(false);
        this.errorMessage.set(err.message || 'Failed to send prescription');
      },
    });
  }
}
