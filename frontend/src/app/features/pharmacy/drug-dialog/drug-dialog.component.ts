import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Drug, DrugInput } from '../../../core/models/pharmacy';

export interface DrugDialogData {
  drug?: Drug;
}

export const DRUG_FORMS = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'INJECTION',
  'OINTMENT',
  'DROPS',
  'INHALER',
  'SUSPENSION',
];

@Component({
  selector: 'app-drug-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.drug ? 'Edit Drug' : 'Add New Drug' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Drug Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Amoxicillin" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Form</mat-label>
          <mat-select formControlName="form">
            @for (f of drugForms; track f) {
              <mat-option [value]="f">{{ f }}</mat-option>
            }
          </mat-select>
          @if (form.controls.form.hasError('required')) {
            <mat-error>Form is required</mat-error>
          }
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Strength</mat-label>
            <input matInput formControlName="strength" placeholder="e.g. 500 mg" />
            @if (form.controls.strength.hasError('required')) {
              <mat-error>Strength is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Dispensing Unit</mat-label>
            <input matInput formControlName="unit" placeholder="e.g. capsule" />
            @if (form.controls.unit.hasError('required')) {
              <mat-error>Unit is required</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Current Stock</mat-label>
            <input matInput type="number" formControlName="stock" />
            @if (form.controls.stock.hasError('required')) {
              <mat-error>Stock is required</mat-error>
            }
            @if (form.controls.stock.hasError('min')) {
              <mat-error>Stock must be &gt;= 0</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Reorder Threshold</mat-label>
            <input matInput type="number" formControlName="reorderThreshold" />
            @if (form.controls.reorderThreshold.hasError('required')) {
              <mat-error>Threshold is required</mat-error>
            }
            @if (form.controls.reorderThreshold.hasError('min')) {
              <mat-error>Threshold must be &gt;= 0</mat-error>
            }
          </mat-form-field>
        </div>
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
        {{ data.drug ? 'Save Changes' : 'Add Drug' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      min-width: 360px;
      margin-top: 0.5rem;
    }
    .row {
      display: flex;
      gap: 1rem;
    }
    .flex-1 {
      flex: 1;
    }
  `,
})
export class DrugDialogComponent {
  protected readonly data = inject<DrugDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<DrugDialogComponent, DrugInput>>(MatDialogRef);

  protected readonly drugForms = DRUG_FORMS;

  protected readonly form = new FormGroup({
    name: new FormControl<string>(this.data.drug?.name ?? '', [Validators.required]),
    form: new FormControl<string>(this.data.drug?.form ?? 'TABLET', [Validators.required]),
    strength: new FormControl<string>(this.data.drug?.strength ?? '', [Validators.required]),
    unit: new FormControl<string>(this.data.drug?.unit ?? 'tablet', [Validators.required]),
    stock: new FormControl<number>(this.data.drug?.stock ?? 100, [
      Validators.required,
      Validators.min(0),
    ]),
    reorderThreshold: new FormControl<number>(this.data.drug?.reorderThreshold ?? 50, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  protected submit(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.dialogRef.close({
      name: val.name!,
      form: val.form!,
      strength: val.strength!,
      unit: val.unit!,
      stock: val.stock!,
      reorderThreshold: val.reorderThreshold!,
    });
  }
}
