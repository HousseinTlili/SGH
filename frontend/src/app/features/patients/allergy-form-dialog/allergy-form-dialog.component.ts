import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PatientApi } from '../../../core/api/patient.api';
import type {
  AllergyCategory,
  AllergyClinicalStatus,
  AllergyCriticality,
  PatientAllergy,
  PatientAllergyInput,
  ReactionSeverity,
} from '../../../core/models/patient';

export interface AllergyFormDialogData {
  patientId: string;
  allergy?: PatientAllergy;
}

@Component({
  selector: 'app-allergy-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './allergy-form-dialog.component.html',
  styleUrl: './allergy-form-dialog.component.scss',
})
export class AllergyFormDialogComponent {
  private readonly api = inject(PatientApi);
  private readonly dialogRef = inject(MatDialogRef<AllergyFormDialogComponent>);
  protected readonly data = inject<AllergyFormDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    allergen: new FormControl(this.data.allergy?.allergen ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    category: new FormControl<AllergyCategory>(this.data.allergy?.category ?? 'OTHER', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    observedReaction: new FormControl(this.data.allergy?.observedReaction ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    reactionDate: new FormControl(this.data.allergy?.reactionDate ?? '', { nonNullable: true }),
    reactionSeverity: new FormControl<ReactionSeverity | ''>(
      this.data.allergy?.reactionSeverity ?? '',
      { nonNullable: true },
    ),
    clinicalStatus: new FormControl<AllergyClinicalStatus>(
      this.data.allergy?.clinicalStatus ?? 'ACTIVE',
      { nonNullable: true, validators: [Validators.required] },
    ),
    criticality: new FormControl<AllergyCriticality>(
      this.data.allergy?.criticality ?? 'UNABLE_TO_ASSESS',
      { nonNullable: true, validators: [Validators.required] },
    ),
  });

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const input: PatientAllergyInput = {
      allergen: value.allergen.trim(),
      category: value.category,
      observedReaction: value.observedReaction.trim() || undefined,
      reactionDate: value.reactionDate || undefined,
      reactionSeverity: value.reactionSeverity || undefined,
      clinicalStatus: value.clinicalStatus,
      criticality: value.criticality,
      version: this.data.allergy?.version ?? 0,
    };
    this.saving.set(true);
    this.error.set(null);
    const request = this.data.allergy
      ? this.api.updateAllergy(this.data.patientId, this.data.allergy.id, input)
      : this.api.createAllergy(this.data.patientId, input);
    request.subscribe({
      next: (allergy) => this.dialogRef.close(allergy),
      error: () => {
        this.saving.set(false);
        this.error.set('The allergy record could not be saved. Reload if another user changed it.');
      },
    });
  }
}
