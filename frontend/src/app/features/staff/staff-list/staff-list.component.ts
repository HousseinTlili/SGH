import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { debounceTime } from 'rxjs';
import { StaffApi } from '../../../core/api/staff.api';
import type { Staff } from '../../../core/models/staff';
import {
  DataTableComponent,
  type DataTableColumn,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';

export const STAFF_ROLES = [
  'DOCTOR',
  'NURSE',
  'LAB_TECHNICIAN',
  'PHARMACIST',
  'RECEPTIONIST',
  'ADMIN',
];

@Component({
  selector: 'app-staff-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    DataTableComponent,
    PageHeaderComponent,
    ServiceGateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-list.component.html',
  styleUrl: './staff-list.component.scss',
})
export class StaffListComponent implements OnInit {
  private readonly staffApi = inject(StaffApi);
  private readonly router = inject(Router);

  readonly staffList = signal<Staff[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly loading = signal(false);

  protected readonly roles = STAFF_ROLES;

  readonly filterForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    role: new FormControl('', { nonNullable: true }),
    department: new FormControl('', { nonNullable: true }),
    activeOnly: new FormControl(false, { nonNullable: true }),
  });

  protected readonly columns: DataTableColumn<Staff>[] = [
    { key: 'name', header: 'Name', cell: (row) => `${row.firstName} ${row.lastName}` },
    { key: 'role', header: 'Role' },
    { key: 'specialty', header: 'Specialty', cell: (row) => row.specialty ?? '—' },
    { key: 'department', header: 'Department' },
    { key: 'email', header: 'Email' },
    {
      key: 'active',
      header: 'Status',
      cell: (row) => (row.active ? 'Active' : 'Inactive'),
    },
  ];

  ngOnInit(): void {
    this.loadStaff();

    this.filterForm.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.page.set(0);
      this.loadStaff();
    });
  }

  loadStaff(): void {
    this.loading.set(true);
    const raw = this.filterForm.getRawValue();

    this.staffApi
      .list({
        search: raw.search.trim() || undefined,
        role: raw.role || undefined,
        department: raw.department.trim() || undefined,
        active: raw.activeOnly ? true : undefined,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (res) => {
          this.staffList.set(res.content);
          this.total.set(res.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onPageChange(event: PageChange): void {
    this.page.set(event.page);
    this.size.set(event.size);
    this.loadStaff();
  }

  onRowClick(staff: Staff): void {
    this.router.navigate(['/staff', staff.id, 'edit']);
  }

  onCreate(): void {
    this.router.navigate(['/staff/new']);
  }
}
