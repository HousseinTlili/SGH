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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { ApiError } from '../../../core/models/common';
import type { Drug } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import {
  type DataTableColumn,
  DataTableComponent,
} from '../../../shared/components/data-table/data-table.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import {
  StockDialogComponent,
  type StockDialogResult,
} from '../stock-dialog/stock-dialog.component';

export interface StockAlertRow extends Drug {
  deficit: number;
}

@Component({
  selector: 'app-stock-alerts',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    DataTableComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #stockCell let-row>
      <span class="stock-critical">
        {{ row.stock }} {{ row.unit }}
        <mat-icon class="warn-icon" aria-label="Low stock">warning</mat-icon>
      </span>
    </ng-template>

    <ng-template #deficitCell let-row>
      <strong class="deficit">+{{ row.deficit }} {{ row.unit }}</strong>
    </ng-template>

    <ng-template #actionsCell let-row>
      @if (isPharmacist()) {
        <button mat-stroked-button color="primary" type="button" (click)="adjustStock(row)">
          <mat-icon>add_shopping_cart</mat-icon>
          Reorder / Adjust
        </button>
      }
    </ng-template>

    <div *appServiceGate="'pharmacy'">
      <app-page-header
        title="Stock Alerts"
        subtitle="Medications whose current inventory is at or below the reorder threshold (PHA-8)"
      >
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
          [total]="rows().length"
          [page]="0"
          [size]="rows().length || 10"
          [loading]="loading()"
          emptyTitle="Inventory healthy"
          emptyMessage="No medications are currently below their reorder threshold."
        />
      }
    </div>
  `,
  styles: `
    .stock-critical {
      color: var(--sgh-tone-danger-fg);
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .warn-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
      color: var(--sgh-tone-danger-solid);
    }
    .deficit {
      color: var(--sgh-tone-danger-fg);
    }
  `,
})
export class StockAlertsComponent {
  private readonly api = inject(PharmacyApi);
  private readonly auth = inject(AuthService);
  private readonly status = inject(ServiceStatusService);
  private readonly dialog = inject(MatDialog);

  private readonly stockCell = viewChild<TemplateRef<{ $implicit: StockAlertRow }>>('stockCell');
  private readonly deficitCell =
    viewChild<TemplateRef<{ $implicit: StockAlertRow }>>('deficitCell');
  private readonly actionsCell =
    viewChild<TemplateRef<{ $implicit: StockAlertRow }>>('actionsCell');

  protected readonly alerts = signal<Drug[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly isPharmacist = computed(() => this.auth.hasRole('PHARMACIST'));

  protected readonly rows = computed<StockAlertRow[]>(() =>
    this.alerts().map((drug) => ({
      ...drug,
      deficit: Math.max(0, drug.reorderThreshold - drug.stock),
    })),
  );

  protected readonly columns = computed<DataTableColumn<StockAlertRow>[]>(() => {
    const sTpl = this.stockCell();
    const dTpl = this.deficitCell();
    const aTpl = this.actionsCell();

    return [
      { key: 'name', header: 'Medication', cell: (r) => r.name },
      { key: 'form', header: 'Form', cell: (r) => r.form },
      { key: 'strength', header: 'Strength', cell: (r) => r.strength },
      { key: 'stock', header: 'Current Stock', cell: sTpl ?? ((r) => `${r.stock} ${r.unit}`) },
      { key: 'threshold', header: 'Threshold', cell: (r) => `${r.reorderThreshold} ${r.unit}` },
      { key: 'deficit', header: 'Shortage', cell: dTpl ?? ((r) => `${r.deficit} ${r.unit}`) },
      { key: 'actions', header: 'Action', cell: aTpl },
    ];
  });

  private readonly pharmacyUp = computed(() => this.status.isUp('pharmacy'));

  constructor() {
    effect(() => {
      if (this.pharmacyUp()) {
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listStockAlerts().subscribe({
      next: (list) => {
        this.alerts.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err));
      },
    });
  }

  protected adjustStock(drug: StockAlertRow): void {
    const ref = this.dialog.open<StockDialogComponent, { drug: Drug }, StockDialogResult>(
      StockDialogComponent,
      {
        data: { drug },
        width: '420px',
      },
    );
    ref.afterClosed().subscribe((res) => {
      if (!res) return;
      this.api.adjustStock(drug.id, res.delta, res.reason).subscribe({
        next: () => this.load(),
        error: (err: unknown) => this.error.set(toApiError(err)),
      });
    });
  }
}
