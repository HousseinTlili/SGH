import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { DispenseLine, Dispensing, Drug, PharmacyPrescription } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { describeDispensingLine, dispensingProgress } from '../pharmacy-rules';

export interface DispenseFormRow {
  itemIndex: number;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  selected: boolean;
  drugId: string;
  quantity: number;
}

@Component({
  selector: 'app-prescription-detail',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prescription-detail.component.html',
  styleUrl: './prescription-detail.component.scss',
})
export class PrescriptionDetailComponent {
  private readonly api = inject(PharmacyApi);
  private readonly auth = inject(AuthService);
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly prescription = signal<PharmacyPrescription | null>(null);
  protected readonly availableDrugs = signal<Drug[]>([]);
  protected readonly loading = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly actionError = signal<ApiError | null>(null);
  protected readonly patientName = signal('');
  protected readonly doctorName = signal('');

  protected readonly dispensings = signal<Dispensing[]>([]);
  protected readonly historyFailed = signal(false);
  private readonly pharmacistNames = signal<Record<string, string>>({});

  protected readonly isPharmacist = computed(() => this.auth.hasRole('PHARMACIST'));

  protected readonly dispenseRows = signal<DispenseFormRow[]>([]);

  protected readonly hasUndispensedItems = computed(() => {
    const rx = this.prescription();
    return rx ? rx.items.some((i) => !i.dispensed) : false;
  });

  protected readonly progress = computed(() =>
    dispensingProgress(this.prescription()?.items ?? []),
  );
  protected readonly pharmacistName = (id: string) => this.pharmacistNames()[id] ?? '…';
  protected readonly describeLine = (line: Dispensing['lines'][number]) =>
    describeDispensingLine(line, this.prescription()?.items ?? []);

  private readonly pharmacyUp = computed(() => this.status.isUp('pharmacy'));

  constructor() {
    effect(() => {
      if (this.pharmacyUp()) {
        untracked(() => {
          this.loadDrugs();
          this.load();
        });
      }
    });
  }

  loadDrugs(): void {
    this.api.listDrugs({ size: 100 }).subscribe({
      next: (page) => {
        this.availableDrugs.set(page.content);
        this.syncDispenseRows();
      },
      error: () => this.availableDrugs.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getPrescription(this.id).subscribe({
      next: (prescription) => {
        this.prescription.set(prescription);
        this.loading.set(false);
        this.syncDispenseRows();
        this.names.getPatientName(prescription.patientId).subscribe((n) => this.patientName.set(n));
        this.names.getDoctorName(prescription.doctorId).subscribe((n) => this.doctorName.set(n));
        this.loadHistory();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err));
      },
    });
  }

  private syncDispenseRows(): void {
    const rx = this.prescription();
    if (!rx) return;

    const drugs = this.availableDrugs();
    const rows: DispenseFormRow[] = [];

    for (const item of rx.items) {
      if (!item.dispensed) {
        // Find best match in available inventory
        const matched =
          drugs.find((d) => item.drugName.toLowerCase().includes(d.name.toLowerCase())) ??
          drugs[0];

        rows.push({
          itemIndex: item.index,
          drugName: item.drugName,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          selected: true,
          drugId: matched?.id ?? '',
          quantity: 10,
        });
      }
    }
    this.dispenseRows.set(rows);
  }

  protected getDrugStock(drugId: string): number {
    return this.availableDrugs().find((d) => d.id === drugId)?.stock ?? 0;
  }

  protected getDrugUnit(drugId: string): string {
    return this.availableDrugs().find((d) => d.id === drugId)?.unit ?? '';
  }

  protected dispenseSelected(): void {
    const rx = this.prescription();
    if (!rx) return;

    const selectedRows = this.dispenseRows().filter((r) => r.selected && r.drugId && r.quantity > 0);
    if (selectedRows.length === 0) return;

    // Check stock
    for (const r of selectedRows) {
      const stock = this.getDrugStock(r.drugId);
      if (r.quantity > stock) {
        this.actionError.set({
          status: 409,
          error: 'Conflict',
          message: `Insufficient stock for ${r.drugName}: requested ${r.quantity}, available ${stock}.`,
        });
        return;
      }
    }

    const lines: DispenseLine[] = selectedRows.map((r) => ({
      itemIndex: r.itemIndex,
      drugId: r.drugId,
      quantity: r.quantity,
    }));

    this.confirm
      .confirm({
        title: 'Confirm Dispensing',
        message: `Dispense ${lines.length} medication line(s)? Stock will be atomically deducted and recorded in the audit trail.`,
        confirmLabel: 'Dispense',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.actionLoading.set(true);
        this.actionError.set(null);
        this.api.dispense(rx.id, lines).subscribe({
          next: (updated) => {
            this.prescription.set(updated);
            this.actionLoading.set(false);
            this.syncDispenseRows();
            this.loadHistory();
            this.loadDrugs(); // refresh stock numbers
          },
          error: (err: unknown) => {
            this.actionLoading.set(false);
            this.actionError.set(toApiError(err));
          },
        });
      });
  }

  /** The history is its own block: if it fails the items above stay on screen. */
  protected loadHistory(): void {
    this.historyFailed.set(false);
    this.api.getDispensings(this.id).subscribe({
      next: (list) => {
        this.dispensings.set(list);
        for (const pharmacistId of new Set(list.map((d) => d.pharmacistId))) {
          this.names.getStaffMember(pharmacistId).subscribe((staff) =>
            this.pharmacistNames.update((m) => ({
              ...m,
              [pharmacistId]:
                staff?.fullName ?? `Pharmacist unavailable (${pharmacistId.slice(0, 8)})`,
            })),
          );
        }
      },
      error: () => this.historyFailed.set(true),
    });
  }

  protected back(): void {
    this.location.back();
  }
}
