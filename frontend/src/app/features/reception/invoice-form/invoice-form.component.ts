import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PatientApi } from '../../../core/api/patient.api';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { Patient } from '../../../core/models/patient';
import type { Appointment, InvoiceLine } from '../../../core/models/reception';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { FormErrorsComponent } from '../../../shared/components/form-errors/form-errors.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import {
  applyApiErrors,
  clearServerErrors,
  fieldErrorMessage,
} from '../../../shared/util/form-errors';
import {
  calculateInvoiceTotal,
  nonNegativeDecimalValidator,
  positiveIntegerValidator,
} from '../reception-rules';

export interface InvoiceLineForm {
  description: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
}

@Component({
  selector: 'app-invoice-form',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    FormErrorsComponent,
    PageHeaderComponent,
    ServiceGateDirective,
    LocalDatetimePipe,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-form.component.html',
  styleUrl: './invoice-form.component.scss',
})
export class InvoiceFormComponent implements OnInit {
  private readonly receptionApi = inject(ReceptionApi);
  private readonly patientApi = inject(PatientApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly statusService = inject(ServiceStatusService);

  readonly saving = signal(false);
  readonly patientResults = signal<Patient[]>([]);
  readonly appointments = signal<Appointment[]>([]);

  readonly patientServiceUp = computed(() => this.statusService.isUp('patient'));

  readonly linesArray = new FormArray<FormGroup<InvoiceLineForm>>([]);

  readonly form = new FormGroup({
    patientId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    patientSearch: new FormControl('', { nonNullable: true }),
    appointmentId: new FormControl<string | null>(null),
    lines: this.linesArray,
  });

  readonly liveTotal = signal(0);

  ngOnInit(): void {
    if (!this.auth.hasRole('RECEPTIONIST')) {
      this.router.navigate(['/forbidden']);
      return;
    }

    // Initialize with 1 line
    this.addLine();

    // Patient autocomplete search
    this.form.controls.patientSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        if (this.patientServiceUp() && query && query.length >= 2) {
          this.patientApi.list(query, 0, 10).subscribe({
            next: (res) => this.patientResults.set(res.content),
          });
        } else {
          this.patientResults.set([]);
        }
      });

    this.form.valueChanges.subscribe(() => {
      clearServerErrors(this.form);
      this.updateLiveTotal();
    });
  }

  createLineGroup(): FormGroup<InvoiceLineForm> {
    return new FormGroup<InvoiceLineForm>({
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(150)],
      }),
      quantity: new FormControl(1, {
        nonNullable: true,
        validators: [Validators.required, positiveIntegerValidator()],
      }),
      unitPrice: new FormControl(0, {
        nonNullable: true,
        validators: [Validators.required, nonNegativeDecimalValidator(2)],
      }),
    });
  }

  addLine(): void {
    if (this.linesArray.length < 30) {
      this.linesArray.push(this.createLineGroup());
      this.updateLiveTotal();
    }
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
      this.updateLiveTotal();
    }
  }

  updateLiveTotal(): void {
    const rawLines = this.linesArray.getRawValue();
    const total = calculateInvoiceTotal(rawLines);
    this.liveTotal.set(total);
  }

  onSelectPatient(patient: Patient): void {
    this.form.controls.patientId.setValue(patient.id);
    this.form.controls.patientSearch.setValue(`${patient.firstName} ${patient.lastName}`);
    this.patientResults.set([]);

    // Fetch this patient's appointments
    this.receptionApi.listAppointments({ patientId: patient.id }).subscribe({
      next: (res) => this.appointments.set(res.content),
    });
  }

  errorMessage(control: FormControl | null): string | null {
    return fieldErrorMessage(control);
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const patientId = this.form.controls.patientId.value.trim();
    const appointmentId = this.form.controls.appointmentId.value || undefined;
    const lines: InvoiceLine[] = this.linesArray.getRawValue().map((line) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
    }));

    this.saving.set(true);
    this.receptionApi.createInvoice({ patientId, appointmentId, lines }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.snackBar.open('Invoice created', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/invoices', created.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse && err.status === 422) {
          applyApiErrors(this.form, toApiError(err));
        }
      },
    });
  }

  onCancel(): void {
    this.router.navigate(['/invoices']);
  }
}
