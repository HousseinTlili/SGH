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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { PharmacyApi } from '../../../core/api/pharmacy.api';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { Dispensing, PharmacyPrescription } from '../../../core/models/pharmacy';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { describeDispensingLine, dispensingProgress } from '../pharmacy-rules';

/**
 * One prescription: items, who prescribed it, and the dispensing history. Read only for doctors and
 * admins. The pharmacist's dispensing panel arrives with the Pharmacy phase.
 */
@Component({
  selector: 'app-prescription-detail',
  imports: [
    MatButtonModule,
    MatIconModule,
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
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);
  private readonly location = inject(Location);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly prescription = signal<PharmacyPrescription | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly patientName = signal('');
  protected readonly doctorName = signal('');

  protected readonly dispensings = signal<Dispensing[]>([]);
  protected readonly historyFailed = signal(false);
  private readonly pharmacistNames = signal<Record<string, string>>({});

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
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getPrescription(this.id).subscribe({
      next: (prescription) => {
        this.prescription.set(prescription);
        this.loading.set(false);
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
