import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PatientApi } from '../../../core/api/patient.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Patient } from '../../../core/models/patient';
import {
  DataTableComponent,
  type DataTableColumn,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { canCreatePatient } from '../patient-rules';

@Component({
  selector: 'app-patient-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    DataTableComponent,
    PageHeaderComponent,
    ServiceGateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.scss',
})
export class PatientListComponent implements OnInit {
  private readonly api = inject(PatientApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly patients = signal<Patient[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly loading = signal(false);

  protected readonly canCreate = canCreatePatient((role) => this.auth.hasRole(role));

  protected readonly columns: DataTableColumn<Patient>[] = [
    { key: 'lastName', header: 'Last name' },
    { key: 'firstName', header: 'First name' },
    { key: 'birthDate', header: 'Birth date' },
    { key: 'gender', header: 'Gender' },
    { key: 'phone', header: 'Phone', cell: (row) => row.phone ?? '—' },
    { key: 'bloodType', header: 'Blood type', cell: (row) => row.bloodType ?? '—' },
  ];

  ngOnInit(): void {
    this.load();
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
  }

  load(): void {
    this.loading.set(true);
    const search = this.searchControl.value.trim() || undefined;
    this.api.list(search, this.page(), this.size()).subscribe({
      next: (res) => {
        this.patients.set(res.content);
        this.total.set(res.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageChange): void {
    this.page.set(event.page);
    this.size.set(event.size);
    this.load();
  }

  onRowClick(patient: Patient): void {
    this.router.navigate(['/patients', patient.id]);
  }

  onCreate(): void {
    this.router.navigate(['/patients/new']);
  }
}
