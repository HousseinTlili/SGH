import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  type MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { PatientApi } from '../../../core/api/patient.api';
import type { PatientSummary } from '../../../core/models/patient';

const MIN_CHARS = 2;

/**
 * Search box with autocomplete that picks one patient. Emits the patient on selection and null
 * when the choice is cleared or the text is edited again. Used as a filter on list screens.
 */
@Component({
  selector: 'app-patient-picker',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline" class="picker">
      <mat-label>{{ label() }}</mat-label>
      <mat-icon matPrefix aria-hidden="true">search</mat-icon>
      <input
        matInput
        type="text"
        autocomplete="off"
        placeholder="Type at least 2 letters of the name"
        [formControl]="control"
        [matAutocomplete]="auto"
      />
      @if (chosen()) {
        <button
          matSuffix
          mat-icon-button
          type="button"
          aria-label="Clear patient filter"
          (click)="clear()"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
      @if (unavailable()) {
        <mat-hint>Patient search is unavailable right now</mat-hint>
      }
      <mat-autocomplete
        #auto="matAutocomplete"
        [displayWith]="display"
        (optionSelected)="onSelected($event)"
      >
        @for (p of options(); track p.id) {
          <mat-option [value]="p">{{ p.fullName }} ({{ p.birthDate }})</mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: `
    .picker {
      width: 100%;
      min-width: 260px;
    }
  `,
})
export class PatientPickerComponent {
  private readonly api = inject(PatientApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input('Patient');
  readonly selected = output<PatientSummary | null>();

  readonly control = new FormControl<string | PatientSummary>('', { nonNullable: true });
  protected readonly options = signal<PatientSummary[]>([]);
  protected readonly chosen = signal<PatientSummary | null>(null);
  protected readonly unavailable = signal(false);

  constructor() {
    this.control.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value !== 'string') {
            return of<PatientSummary[]>([]); // an option was just picked
          }
          // editing the text of a chosen patient drops the choice
          if (this.chosen() && value !== this.chosen()?.fullName) {
            this.chosen.set(null);
            this.selected.emit(null);
          }
          const query = value.trim();
          if (query.length < MIN_CHARS) {
            return of<PatientSummary[]>([]);
          }
          return this.api.list(query, 0, 10).pipe(
            map((page) =>
              page.content.map((p) => ({
                id: p.id,
                fullName: `${p.firstName} ${p.lastName}`,
                birthDate: p.birthDate,
              })),
            ),
            catchError(() => {
              this.unavailable.set(true);
              return of<PatientSummary[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((options) => {
        if (options.length > 0) {
          this.unavailable.set(false);
        }
        this.options.set(options);
      });
  }

  protected display = (value: string | PatientSummary | null): string =>
    typeof value === 'string' ? value : (value?.fullName ?? '');

  protected onSelected(event: MatAutocompleteSelectedEvent): void {
    const patient = event.option.value as PatientSummary;
    this.chosen.set(patient);
    this.options.set([]);
    this.selected.emit(patient);
  }

  clear(): void {
    this.control.setValue('', { emitEvent: false });
    this.options.set([]);
    this.chosen.set(null);
    this.selected.emit(null);
  }
}
