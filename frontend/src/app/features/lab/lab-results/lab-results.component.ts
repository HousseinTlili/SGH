import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  effect,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { LabApi } from '../../../core/api/lab.api';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { LabResultRow } from '../../../core/models/lab';
import type { PatientSummary } from '../../../core/models/patient';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import {
  type DataTableColumn,
  DataTableComponent,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FlagBadgeComponent } from '../../../shared/components/flag-badge/flag-badge.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PatientPickerComponent } from '../../../shared/components/patient-picker/patient-picker.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { formatResultValue } from '../lab-rules';

/** Validated results, newest first, optionally for one patient. Read only. */
@Component({
  selector: 'app-lab-results',
  imports: [
    DataTableComponent,
    ErrorStateComponent,
    FlagBadgeComponent,
    PageHeaderComponent,
    PatientPickerComponent,
    ServiceGateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #flagCell let-row>
      <app-flag-badge [flag]="row.flag" />
    </ng-template>

    <div *appServiceGate="'lab'">
      <app-page-header title="Lab results" subtitle="Validated laboratory results, newest first" />

      <div class="filters">
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
          emptyTitle="No validated results"
          emptyMessage="Results appear here once the laboratory has validated them."
          (pageChange)="onPageChange($event)"
          (rowClick)="onRowClick($event)"
        />
      }
    </div>
  `,
  styles: `
    .filters {
      max-width: 440px;
      margin-bottom: var(--sgh-space-4);
    }
  `,
})
export class LabResultsComponent {
  private readonly api = inject(LabApi);
  private readonly names = inject(NameLookupService);
  private readonly router = inject(Router);
  private readonly status = inject(ServiceStatusService);
  private readonly dateTime = new LocalDatetimePipe();

  private readonly flagCell =
    viewChild.required<TemplateRef<{ $implicit: LabResultRow }>>('flagCell');

  protected readonly rows = signal<LabResultRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private readonly patientId = signal<string | undefined>(undefined);
  private readonly patientNames = signal<Record<string, string>>({});

  protected readonly columns = computed<DataTableColumn<LabResultRow>[]>(() => [
    {
      key: 'validatedAt',
      header: 'Validated',
      cell: (r) => this.dateTime.transform(r.validatedAt),
    },
    {
      key: 'patientId',
      header: 'Patient',
      cell: (r) => this.patientNames()[r.patientId] ?? '…',
    },
    { key: 'testCode', header: 'Test' },
    { key: 'value', header: 'Value', cell: (r) => formatResultValue(r.value, r.unit) },
    { key: 'referenceRange', header: 'Reference range' },
    { key: 'flag', header: 'Flag', cell: this.flagCell() },
  ]);

  private readonly labUp = computed(() => this.status.isUp('lab'));

  constructor() {
    // load once, not while Lab is down, and again when it comes back
    effect(() => {
      if (this.labUp()) {
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listResults(this.patientId(), this.page(), this.size()).subscribe({
      next: (res) => {
        this.rows.set(res.content);
        this.total.set(res.totalElements);
        this.loading.set(false);
        this.resolvePatientNames(res.content);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err));
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

  protected onRowClick(row: LabResultRow): void {
    void this.router.navigate(['/lab/requests', row.labRequestId]);
  }

  private resolvePatientNames(rows: LabResultRow[]): void {
    for (const id of new Set(rows.map((r) => r.patientId))) {
      if (!(id in this.patientNames())) {
        this.names
          .getPatientName(id)
          .subscribe((name) => this.patientNames.update((m) => ({ ...m, [id]: name })));
      }
    }
  }
}
