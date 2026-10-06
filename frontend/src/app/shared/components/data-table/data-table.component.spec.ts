import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataTableComponent, type DataTableColumn, type PageChange } from './data-table.component';

interface Row {
  id: string;
  name: string;
  age: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Youssef', age: 41 },
  { id: '2', name: 'Amira', age: 34 },
];

@Component({
  imports: [DataTableComponent],
  template: `
    <ng-template #bold let-row
      ><b class="cell-bold">{{ row.name }}</b></ng-template
    >
    <app-data-table
      [columns]="columns()"
      [rows]="rows"
      [total]="total"
      [page]="0"
      [size]="10"
      [loading]="loading"
      (rowClick)="clicked = $event"
      (pageChange)="paged = $event"
    />
  `,
})
class Host {
  readonly bold = viewChild.required<TemplateRef<{ $implicit: Row }>>('bold');
  rows: Row[] = ROWS;
  total = 25;
  loading = false;
  clicked: Row | null = null;
  paged: PageChange | null = null;

  columns(): DataTableColumn<Row>[] {
    return [
      { key: 'name', header: 'Name', cell: this.bold() },
      { key: 'age', header: 'Age' },
      { key: 'label', header: 'Label', cell: (row) => `${row.name} (${row.age})` },
    ];
  }
}

async function render(setup: (host: Host) => void = () => undefined) {
  const fixture = TestBed.createComponent(Host);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

describe('DataTableComponent', () => {
  it('renders the headers and one row per item', async () => {
    const { el } = await render();
    expect(Array.from(el.querySelectorAll('th')).map((h) => h.textContent?.trim())).toEqual([
      'Name',
      'Age',
      'Label',
    ]);
    expect(el.querySelectorAll('tr.mat-mdc-row')).toHaveLength(2);
  });

  it('a column can be plain text from the key, a function, or a template', async () => {
    const { el } = await render();
    const first = el.querySelectorAll('tr.mat-mdc-row')[0];
    expect(first.querySelector('.cell-bold')?.textContent).toBe('Youssef');
    expect(first.textContent).toContain('41');
    expect(first.textContent).toContain('Youssef (41)');
  });

  it('emits rowClick with the row when a row is clicked or Enter is pressed', async () => {
    const { el, host, fixture } = await render();
    (el.querySelectorAll('tr.mat-mdc-row')[1] as HTMLElement).click();
    expect(host.clicked).toEqual(ROWS[1]);
    host.clicked = null;
    el.querySelectorAll('tr.mat-mdc-row')[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
    fixture.detectChanges();
    expect(host.clicked).toEqual(ROWS[0]);
  });

  it('shows the empty state instead of the table when there are no rows', async () => {
    const { el } = await render((h) => {
      h.rows = [];
      h.total = 0;
    });
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('No results');
  });

  it('shows a progress bar while loading', async () => {
    const { el } = await render((h) => (h.loading = true));
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('has a paginator only when there is something to page, and emits pageChange', async () => {
    const { el, host, fixture } = await render();
    expect(el.querySelector('mat-paginator')).not.toBeNull();
    (el.querySelector('.mat-mdc-paginator-navigation-next') as HTMLElement).click();
    fixture.detectChanges();
    expect(host.paged).toEqual({ page: 1, size: 10 });

    const empty = await render((h) => {
      h.rows = [];
      h.total = 0;
    });
    expect(empty.el.querySelector('mat-paginator')).toBeNull();
  });
});
