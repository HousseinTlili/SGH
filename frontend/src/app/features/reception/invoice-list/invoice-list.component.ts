import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime } from 'rxjs';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Invoice } from '../../../core/models/reception';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { canCreateInvoice } from '../reception-rules';

@Component({
  selector: 'app-invoice-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.scss',
})
export class InvoiceListComponent implements OnInit {
  private readonly receptionApi = inject(ReceptionApi);
  private readonly nameLookup = inject(NameLookupService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly invoices = signal<Invoice[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly loading = signal(false);

  readonly patientNames = signal<Record<string, string>>({});

  readonly canCreate = computed(() => canCreateInvoice((role) => this.auth.hasRole(role)));

  readonly filterForm = new FormGroup({
    status: new FormControl('', { nonNullable: true }),
    patientId: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadInvoices();

    this.filterForm.valueChanges.pipe(debounceTime(250)).subscribe(() => {
      this.page.set(0);
      this.loadInvoices();
    });
  }

  loadInvoices(): void {
    this.loading.set(true);
    const raw = this.filterForm.getRawValue();

    this.receptionApi
      .listInvoices({
        patientId: raw.patientId || undefined,
        status: raw.status || undefined,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (res) => {
          this.invoices.set(res.content);
          this.total.set(res.totalElements);
          this.loading.set(false);
          this.resolvePatientNames(res.content);
        },
        error: () => this.loading.set(false),
      });
  }

  resolvePatientNames(items: Invoice[]): void {
    for (const inv of items) {
      if (!this.patientNames()[inv.patientId]) {
        this.nameLookup.getPatientName(inv.patientId).subscribe((name) => {
          this.patientNames.update((prev) => ({ ...prev, [inv.patientId]: name }));
        });
      }
    }
  }

  onRowClick(invoice: Invoice): void {
    this.router.navigate(['/invoices', invoice.id]);
  }

  onCreate(): void {
    this.router.navigate(['/invoices/new']);
  }
}
