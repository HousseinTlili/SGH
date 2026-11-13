import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { PatientApi } from '../../../core/api/patient.api';
import type { AllergyHistory, PatientAllergy } from '../../../core/models/patient';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';

export interface AllergyHistoryDialogData {
  patientId: string;
  allergy: PatientAllergy;
}

@Component({
  selector: 'app-allergy-history-dialog',
  imports: [JsonPipe, MatButtonModule, MatDialogModule, LocalDatetimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './allergy-history-dialog.component.html',
  styleUrl: './allergy-history-dialog.component.scss',
})
export class AllergyHistoryDialogComponent implements OnInit {
  private readonly api = inject(PatientApi);
  protected readonly data = inject<AllergyHistoryDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly entries = signal<AllergyHistory[]>([]);

  ngOnInit(): void {
    this.api.allergyHistory(this.data.patientId, this.data.allergy.id).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
