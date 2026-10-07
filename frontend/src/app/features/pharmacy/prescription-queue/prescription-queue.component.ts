import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { PatientSummary } from '../../../core/models/patient';
import type { PharmacyPrescription } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import {
  type DataTableColumn,
  DataTableComponent,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PatientPickerComponent } from '../../../shared/components/patient-picker/patient-picker.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import {
  QUEUE_FILTERS,
  type QueueStatusFilter,
  dispensingProgress,
  statusParam,
} from '../pharmacy-rules';

export const QUEUE_REFRESH_MS = 10_000;

/**
 * Prescriptions known to the pharmacy and their dispensing status. Read only here: the pharmacist's
 * dispensing panel lives on the detail page and arrives with the Pharmacy phase.
 */
@Component({
  selector: 'app-prescription-queue',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    DataTableComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    PatientPickerComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #statusCell let-row>
      <app-status-badge [status]="row.status" />
    </ng-template>

    <div *appServiceGate="'pharmacy'">
      <app-page-header [title]="title()" subtitle="Dispensing status of issued prescriptions">
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </app-page-header>

      <div class="filters">
        <mat-form-field appearance="outline" class="status-field">
          <mat-label>Status</mat-label>
          <mat-select [formControl]="statusControl">
            @for (option of filterOptions; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <app-patient-picker label="Filter by patient" (selected)="onPatientSelected($event)" />
      </div>

      @if (error(); as err) {
        <app-error-state [error]="err" (retry)="load()" />
      } @else {
        <app-data-table
          [columns]="columns()"
          [rows]="rows()"
          [total]="total()"
          [page]="page()"
          [size]="size()"
          [loading]="loading()"
          emptyTitle="No prescriptions"
          emptyMessage="Nothing matches this filter."
          (pageChange)="onPageChange($event)"
          (rowClick)="onRowClick($event)"
        />
      }
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sgh-space-4);
      align-items: flex-start;
      margin-bottom: var(--sgh-space-4);
    }
    .status-field {
      min-width: 280px;
    }
  `,
})
export class PrescriptionQueueComponent {
  private readonly api = inject(PharmacyApi);
  private readonly names = inject(NameLookupService);
  private readonly router = inject(Router);
  private readonly status = inject(ServiceStatusService);
  private readonly auth = inject(AuthService);
  private readonly dateTime = new LocalDatetimePipe();

  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: PharmacyPrescription }>>('statusCell');

  protected readonly filterOptions = QUEUE_FILTERS;
  protected readonly statusControl = new FormControl<QueueStatusFilter>('OPEN', {
    nonNullable: true,
  });

  protected readonly rows = signal<PharmacyPrescription[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private readonly patientId = signal<string | undefined>(undefined);
  private readonly patientNames = signal<Record<string, string>>({});
  private readonly doctorNames = signal<Record<string, string>>({});

  protected readonly title = computed(() =>
    this.auth.hasRole('PHARMACIST') ? 'Prescriptions' : 'Prescriptions status',
  );

  protected readonly columns = computed<DataTableColumn<PharmacyPrescription>[]>(() => [
    { key: 'createdAt', header: 'Created', cell: (r) => this.dateTime.transform(r.createdAt) },
    { key: 'patientId', header: 'Patient', cell: (r) => this.patientNames()[r.patientId] ?? '…' },
    { key: 'doctorId', header: 'Doctor', cell: (r) => this.doctorNames()[r.doctorId] ?? '…' },
    { key: 'items', header: 'Items', cell: (r) => dispensingProgress(r.items) },
    { key: 'status', header: 'Status', cell: this.statusCell() },
  ]);

  private readonly pharmacyUp = computed(() => this.status.isUp('pharmacy'));

  constructor() {
    // load once, not while Pharmacy is down, and again when it comes back
    effect(() => {
      if (this.pharmacyUp()) {
        untracked(() => this.load());
      }
    });

    this.statusControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.page.set(0);
      this.load();
    });

    // keep the queue fresh without a click (Screens B: auto refresh every 10 seconds)
    interval(QUEUE_REFRESH_MS)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        if (this.pharmacyUp()) {
          this.load(true);
        }
      });
  }

  /** @param silent keep the current rows on screen instead of showing the loading bar */
  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
    }
    this.api
      .listPrescriptions({
        status: statusParam(this.statusControl.value),
        patientId: this.patientId(),
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.content);
          this.total.set(res.totalElements);
          this.error.set(null);
          this.loading.set(false);
          this.resolveNames(res.content);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          // a failed background refresh must not wipe a list that is already on screen
          if (!silent || this.rows().length === 0) {
            this.error.set(toApiError(err));
          }
        },
      });
  }

  protected onPatientSelected(patient: PatientSummary | null): void {
    this.patientId.set(patient?.id);
    this.page.set(0);
    this.load();
  }

  protected onPageChange(event: PageChange): void {
    this.page.set(event.page);
    this.size.set(event.size);
    this.load();
  }

  protected onRowClick(row: PharmacyPrescription): void {
    void this.router.navigate(['/pharmacy/prescriptions', row.id]);
  }

  private resolveNames(rows: PharmacyPrescription[]): void {
    for (const id of new Set(rows.map((r) => r.patientId))) {
      if (!(id in this.patientNames())) {
        this.names
          .getPatientName(id)
          .subscribe((name) => this.patientNames.update((m) => ({ ...m, [id]: name })));
      }
    }
    for (const id of new Set(rows.map((r) => r.doctorId))) {
      if (!(id in this.doctorNames())) {
        this.names
          .getDoctorName(id)
          .subscribe((name) => this.doctorNames.update((m) => ({ ...m, [id]: name })));
      }
    }
  }
}
