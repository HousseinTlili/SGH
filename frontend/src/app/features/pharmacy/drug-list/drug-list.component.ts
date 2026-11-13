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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import type { ApiError } from '../../../core/models/common';
import type { Drug, DrugInput } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import {
  type DataTableColumn,
  DataTableComponent,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { DrugDialogComponent } from '../drug-dialog/drug-dialog.component';
import {
  StockDialogComponent,
  type StockDialogResult,
} from '../stock-dialog/stock-dialog.component';

@Component({
  selector: 'app-drug-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    DataTableComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #stockCell let-row>
      <span [class.stock-warning]="row.stock <= row.reorderThreshold">
        {{ row.stock }} {{ row.unit }}
        @if (row.stock <= row.reorderThreshold) {
          <mat-icon class="warn-icon" aria-label="Low stock">warning</mat-icon>
        }
      </span>
    </ng-template>

    <ng-template #actionsCell let-row>
      @if (isPharmacist()) {
        <div class="action-buttons">
          <button mat-icon-button type="button" title="Adjust stock" (click)="adjustStock(row)">
            <mat-icon>swap_vert</mat-icon>
          </button>
          <button mat-icon-button type="button" title="Edit drug" (click)="editDrug(row)">
            <mat-icon>edit</mat-icon>
          </button>
        </div>
      }
    </ng-template>

    <div *appServiceGate="'pharmacy'">
      <app-page-header title="Drugs & Inventory" subtitle="Medications catalogue and stock control">
        @if (isPharmacist()) {
          <button mat-flat-button color="primary" type="button" (click)="addDrug()">
            <mat-icon>add</mat-icon>
            Add Drug
          </button>
        }
      </app-page-header>

      <div class="filters">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search by drug name</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="searchControl" placeholder="e.g. Paracetamol" />
        </mat-form-field>
      </div>

      @if (error(); as err) {
        <app-error-state [error]="err" (retry)="load()" />
      } @else {
        <app-data-table
          [columns]="columns()"
          [rows]="drugs()"
          [total]="total()"
          [page]="page()"
          [size]="size()"
          [loading]="loading()"
          emptyTitle="No drugs found"
          emptyMessage="No medications match your search criteria."
          (pageChange)="onPageChange($event)"
        />
      }
    </div>
  `,
  styles: `
    .filters {
      margin-bottom: 1.5rem;
    }
    .search-field {
      max-width: 360px;
      width: 100%;
    }
    .stock-warning {
      color: var(--sgh-tone-danger-fg);
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .warn-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
      color: var(--sgh-tone-danger-solid);
    }
    .action-buttons {
      display: flex;
      gap: 0.25rem;
    }
  `,
})
export class DrugListComponent {
  private readonly api = inject(PharmacyApi);
  private readonly auth = inject(AuthService);
  private readonly status = inject(ServiceStatusService);
  private readonly dialog = inject(MatDialog);

  private readonly stockCell = viewChild<TemplateRef<{ $implicit: Drug }>>('stockCell');
  private readonly actionsCell = viewChild<TemplateRef<{ $implicit: Drug }>>('actionsCell');

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  protected readonly drugs = signal<Drug[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly isPharmacist = computed(() => this.auth.hasRole('PHARMACIST'));

  protected readonly columns = computed<DataTableColumn<Drug>[]>(() => {
    const sTpl = this.stockCell();
    const aTpl = this.actionsCell();

    return [
      { key: 'name', header: 'Name', cell: (r) => r.name },
      { key: 'form', header: 'Form', cell: (r) => r.form },
      { key: 'strength', header: 'Strength', cell: (r) => r.strength },
      { key: 'stock', header: 'In Stock', cell: sTpl ?? ((r) => `${r.stock} ${r.unit}`) },
      {
        key: 'reorderThreshold',
        header: 'Reorder At',
        cell: (r) => `${r.reorderThreshold} ${r.unit}`,
      },
      { key: 'actions', header: 'Actions', cell: aTpl },
    ];
  });

  private readonly pharmacyUp = computed(() => this.status.isUp('pharmacy'));

  constructor() {
    effect(() => {
      if (this.pharmacyUp()) {
        untracked(() => this.load());
      }
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const search = this.searchControl.value.trim() || undefined;

    this.api
      .listDrugs({
        search,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.drugs.set(page.content);
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

  protected addDrug(): void {
    const ref = this.dialog.open<DrugDialogComponent, { drug?: Drug }, DrugInput>(
      DrugDialogComponent,
      {
        data: {},
        width: '460px',
      },
    );
    ref.afterClosed().subscribe((input) => {
      if (!input) return;
      this.api.createDrug(input).subscribe({
        next: () => this.load(),
        error: (err: unknown) => this.error.set(toApiError(err)),
      });
    });
  }

  protected editDrug(drug: Drug): void {
    const ref = this.dialog.open<DrugDialogComponent, { drug: Drug }, DrugInput>(
      DrugDialogComponent,
      {
        data: { drug },
        width: '460px',
      },
    );
    ref.afterClosed().subscribe((input) => {
      if (!input) return;
      this.api.updateDrug(drug.id, input).subscribe({
        next: () => this.load(),
        error: (err: unknown) => this.error.set(toApiError(err)),
      });
    });
  }

  protected adjustStock(drug: Drug): void {
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
