import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Plain text for the cell, or a template that receives the row as `let-row`. */
  cell?: ((row: T) => string) | TemplateRef<{ $implicit: T }>;
}

export interface PageChange {
  page: number;
  size: number;
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50];

@Component({
  selector: 'app-data-table',
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    NgTemplateOutlet,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T> {
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly total = input(0);
  /** Zero-based page index, as in the API. */
  readonly page = input(0);
  readonly size = input(20);
  readonly loading = input(false);
  readonly emptyTitle = input('No results');
  readonly emptyMessage = input<string>();

  readonly pageChange = output<PageChange>();
  readonly rowClick = output<T>();

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly keys = computed(() => this.columns().map((c) => c.key));

  protected template(column: DataTableColumn<T>): TemplateRef<{ $implicit: T }> | null {
    return column.cell instanceof TemplateRef ? column.cell : null;
  }

  protected text(column: DataTableColumn<T>, row: T): string {
    if (typeof column.cell === 'function') {
      return column.cell(row);
    }
    const value = (row as Record<string, unknown>)[column.key];
    return value === null || value === undefined ? '' : String(value);
  }

  protected onPage(event: PageEvent): void {
    this.pageChange.emit({ page: event.pageIndex, size: event.pageSize });
  }
}
