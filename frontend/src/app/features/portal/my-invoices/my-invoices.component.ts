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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { ApiError } from '../../../core/models/common';
import type { Invoice } from '../../../core/models/reception';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
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

export interface PatientInvoiceRow extends Invoice {
  linesFormatted: string;
}

@Component({
  selector: 'app-my-invoices',
  imports: [
    MatButtonModule,
    MatIconModule,
    DataTableComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #statusCell let-row>
      <app-status-badge [status]="row.status" />
    </ng-template>

    <ng-template #dateCell let-row>
      {{ row.createdAt | localDatetime }}
    </ng-template>

    <ng-template #totalCell let-row>
      <strong>{{ row.total }} TND</strong>
    </ng-template>

    <ng-template #actionsCell let-row>
      @if (row.status === 'PENDING') {
        <button mat-flat-button color="primary" type="button" (click)="pay(row)">
          <mat-icon>payment</mat-icon>
          Pay Online
        </button>
      }
    </ng-template>

    <div *appServiceGate="'reception'">
      <app-page-header title="My Invoices" subtitle="Billing statements and payment records">
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </app-page-header>

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
          emptyTitle="No invoices found"
          emptyMessage="You have no recorded invoices."
          (pageChange)="onPageChange($event)"
        />
      }
    </div>
  `,
})
export class MyInvoicesComponent {
  private readonly api = inject(ReceptionApi);
  private readonly auth = inject(AuthService);
  private readonly status = inject(ServiceStatusService);
  private readonly confirm = inject(ConfirmService);

  private readonly statusCell = viewChild<TemplateRef<{ $implicit: PatientInvoiceRow }>>('statusCell');
  private readonly dateCell = viewChild<TemplateRef<{ $implicit: PatientInvoiceRow }>>('dateCell');
  private readonly totalCell = viewChild<TemplateRef<{ $implicit: PatientInvoiceRow }>>('totalCell');
  private readonly actionsCell = viewChild<TemplateRef<{ $implicit: PatientInvoiceRow }>>('actionsCell');

  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly patientId = computed(() => this.auth.user()?.patientId ?? '');

  protected readonly rows = computed<PatientInvoiceRow[]>(() =>
    this.invoices().map((inv) => ({
      ...inv,
      linesFormatted: inv.lines.map((l) => `${l.description} (${l.quantity}x ${l.unitPrice} TND)`).join(', '),
    })),
  );

  protected readonly columns = computed<DataTableColumn<PatientInvoiceRow>[]>(() => {
    const sTpl = this.statusCell();
    const dTpl = this.dateCell();
    const tTpl = this.totalCell();
    const aTpl = this.actionsCell();

    return [
      { key: 'createdAt', header: 'Issued Date', cell: dTpl ?? ((r) => r.createdAt) },
      { key: 'lines', header: 'Services & Care', cell: (r) => r.linesFormatted },
      { key: 'total', header: 'Total Amount', cell: tTpl ?? ((r) => `${r.total} TND`) },
      { key: 'status', header: 'Status', cell: sTpl ?? ((r) => r.status) },
      { key: 'actions', header: 'Payment', cell: aTpl },
    ];
  });

  private readonly receptionUp = computed(() => this.status.isUp('reception'));

  constructor() {
    effect(() => {
      if (this.receptionUp()) {
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    const pid = this.patientId();
    if (!pid) return;

    this.loading.set(true);
    this.error.set(null);

    this.api
      .listInvoices({
        patientId: pid,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.invoices.set(page.content);
          this.total.set(page.totalElements);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(toApiError(err));
        },
      });
  }

  protected onPageChange(change: PageChange): void {
    this.page.set(change.page);
    this.size.set(change.size);
    this.load();
  }

  protected pay(inv: PatientInvoiceRow): void {
    this.confirm
      .confirm({
        title: 'Pay Invoice',
        message: `Pay invoice for ${inv.total} TND via Card?`,
        confirmLabel: 'Pay Now',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.payInvoice(inv.id, 'CARD').subscribe({
          next: () => this.load(),
          error: (err: unknown) => this.error.set(toApiError(err)),
        });
      });
  }
}
