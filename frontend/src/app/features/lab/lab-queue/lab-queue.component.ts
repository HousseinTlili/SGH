import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { LabApi } from '../../../core/api/lab.api';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { LabRequest } from '../../../core/models/lab';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import {
  type DataTableColumn,
  DataTableComponent,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';

export interface LabQueueRow extends LabRequest {
  patientName: string;
  doctorName: string;
  testsFormatted: string;
}

export const LAB_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Requested', value: 'REQUESTED' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Results entered', value: 'RESULT_ENTERED' },
  { label: 'Validated', value: 'VALIDATED' },
];

export const LAB_PRIORITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'All priorities', value: '' },
  { label: 'Urgent', value: 'URGENT' },
  { label: 'Routine', value: 'ROUTINE' },
];

@Component({
  selector: 'app-lab-queue',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    DataTableComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #priorityCell let-row>
      <app-status-badge [status]="row.priority" />
    </ng-template>

    <ng-template #statusCell let-row>
      <app-status-badge [status]="row.status" />
    </ng-template>

    <ng-template #dateCell let-row>
      {{ row.requestedAt | localDatetime }}
    </ng-template>

    <div *appServiceGate="'lab'">
      <app-page-header title="Lab Queue" subtitle="Work queue of laboratory analysis requests (URGENT first)">
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </app-page-header>

      <div class="filters">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Status</mat-label>
          <mat-select [formControl]="statusControl">
            @for (opt of statusOptions; track opt.value) {
              <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Priority</mat-label>
          <mat-select [formControl]="priorityControl">
            @for (opt of priorityOptions; track opt.value) {
              <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
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
          emptyTitle="No lab requests"
          emptyMessage="No laboratory requests found matching the current filters."
          (pageChange)="onPageChange($event)"
          (rowClick)="onRowClick($event)"
        />
      }
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .filter-field {
      min-width: 180px;
    }
  `,
})
export class LabQueueComponent {
  private readonly api = inject(LabApi);
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);
  private readonly router = inject(Router);

  private readonly priorityCell = viewChild<TemplateRef<{ $implicit: LabQueueRow }>>('priorityCell');
  private readonly statusCell = viewChild<TemplateRef<{ $implicit: LabQueueRow }>>('statusCell');
  private readonly dateCell = viewChild<TemplateRef<{ $implicit: LabQueueRow }>>('dateCell');

  protected readonly statusControl = new FormControl<string>('', { nonNullable: true });
  protected readonly priorityControl = new FormControl<string>('', { nonNullable: true });

  protected readonly statusOptions = LAB_STATUS_OPTIONS;
  protected readonly priorityOptions = LAB_PRIORITY_OPTIONS;

  protected readonly items = signal<LabRequest[]>([]);
  protected readonly patientNames = signal<Record<string, string>>({});
  protected readonly doctorNames = signal<Record<string, string>>({});
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly rows = computed<LabQueueRow[]>(() => {
    const pNames = this.patientNames();
    const dNames = this.doctorNames();
    return this.items().map((item) => ({
      ...item,
      patientName: pNames[item.patientId] ?? item.patientId.slice(0, 8),
      doctorName: dNames[item.doctorId] ?? item.doctorId.slice(0, 8),
      testsFormatted: item.tests.map((t) => t.code).join(', '),
    }));
  });

  protected readonly columns = computed<DataTableColumn<LabQueueRow>[]>(() => {
    const pTpl = this.priorityCell();
    const sTpl = this.statusCell();
    const dTpl = this.dateCell();

    return [
      {
        key: 'priority',
        header: 'Priority',
        cell: pTpl ?? ((r) => r.priority),
      },
      {
        key: 'status',
        header: 'Status',
        cell: sTpl ?? ((r) => r.status),
      },
      {
        key: 'patient',
        header: 'Patient',
        cell: (r) => r.patientName,
      },
      {
        key: 'doctor',
        header: 'Requested by',
        cell: (r) => r.doctorName,
      },
      {
        key: 'tests',
        header: 'Tests',
        cell: (r) => r.testsFormatted,
      },
      {
        key: 'requestedAt',
        header: 'Requested At',
        cell: dTpl ?? ((r) => r.requestedAt),
      },
    ];
  });

  private readonly labUp = computed(() => this.status.isUp('lab'));

  constructor() {
    effect(() => {
      if (this.labUp()) {
        untracked(() => this.load());
      }
    });

    this.statusControl.valueChanges.subscribe(() => {
      this.page.set(0);
      this.load();
    });

    this.priorityControl.valueChanges.subscribe(() => {
      this.page.set(0);
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const statusVal = this.statusControl.value || undefined;
    const priorityVal = this.priorityControl.value || undefined;

    this.api
      .listRequests({
        status: statusVal,
        priority: priorityVal,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.items.set(page.content);
          this.total.set(page.totalElements);
          this.loading.set(false);
          this.resolveNames(page.content);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(toApiError(err));
        },
      });
  }

  private resolveNames(requests: LabRequest[]): void {
    for (const req of requests) {
      if (!this.patientNames()[req.patientId]) {
        this.names.getPatientName(req.patientId).subscribe((n) => {
          this.patientNames.update((m) => ({ ...m, [req.patientId]: n }));
        });
      }
      if (!this.doctorNames()[req.doctorId]) {
        this.names.getDoctorName(req.doctorId).subscribe((n) => {
          this.doctorNames.update((m) => ({ ...m, [req.doctorId]: n }));
        });
      }
    }
  }

  protected onPageChange(change: PageChange): void {
    this.page.set(change.page);
    this.size.set(change.size);
    this.load();
  }

  protected onRowClick(row: LabQueueRow): void {
    this.router.navigate(['/lab/requests', row.id]);
  }
}
