import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { Invoice } from '../../../core/models/reception';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PayInvoiceDialogComponent } from '../dialogs/pay-invoice-dialog.component';
import { canCancelInvoice, canPayInvoice } from '../reception-rules';

@Component({
  selector: 'app-invoice-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.scss',
})
export class InvoiceDetailComponent implements OnInit {
  private readonly receptionApi = inject(ReceptionApi);
  private readonly nameLookup = inject(NameLookupService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly snackBar = inject(MatSnackBar);

  readonly invoice = signal<Invoice | null>(null);
  readonly patientName = signal<string>('');
  readonly loading = signal(true);

  readonly canPay = computed(() => {
    const inv = this.invoice();
    return inv ? canPayInvoice(inv.status, (r) => this.auth.hasRole(r)) : false;
  });

  readonly canCancel = computed(() => {
    const inv = this.invoice();
    return inv ? canCancelInvoice(inv.status, (r) => this.auth.hasRole(r)) : false;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/invoices']);
      return;
    }
    this.loadInvoice(id);
  }

  loadInvoice(id: string): void {
    this.loading.set(true);
    this.receptionApi.getInvoice(id).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.loading.set(false);
        this.nameLookup.getPatientName(inv.patientId).subscribe((name) => {
          this.patientName.set(name);
        });
      },
      error: () => this.loading.set(false),
    });
  }

  onPay(): void {
    const inv = this.invoice();
    if (!inv) return;

    this.dialog
      .open<
        PayInvoiceDialogComponent,
        { invoiceId: string; total: number },
        'CASH' | 'CARD' | null
      >(PayInvoiceDialogComponent, {
        data: { invoiceId: inv.id, total: inv.total },
        width: '440px',
      })
      .afterClosed()
      .subscribe((method) => {
        if (method) {
          this.receptionApi.payInvoice(inv.id, method).subscribe({
            next: (updated) => {
              this.invoice.set(updated);
              this.snackBar.open('Invoice marked as paid', 'Dismiss', { duration: 3000 });
            },
          });
        }
      });
  }

  onCancelInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;

    this.confirm
      .confirm({
        title: 'Cancel invoice',
        message: 'Are you sure you want to cancel this invoice? This action cannot be undone.',
        confirmLabel: 'Cancel invoice',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.receptionApi.cancelInvoice(inv.id).subscribe({
            next: (updated) => {
              this.invoice.set(updated);
              this.snackBar.open('Invoice cancelled', 'Dismiss', { duration: 3000 });
            },
          });
        }
      });
  }
}
