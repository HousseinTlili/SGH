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
import { LabApi } from '../../../core/api/lab.api';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { LabRequest } from '../../../core/models/lab';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FlagBadgeComponent } from '../../../shared/components/flag-badge/flag-badge.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { criticalResults, formatResultValue, labSteps } from '../lab-rules';

const STEP_ICONS = {
  done: 'check_circle',
  current: 'radio_button_checked',
  todo: 'radio_button_unchecked',
} as const;

/**
 * One lab request with its status stepper and results. Read only for now: starting, entering and
 * validating results (LAB_TECHNICIAN) arrive with the Lab phase.
 */
@Component({
  selector: 'app-lab-request-detail',
  imports: [
    MatButtonModule,
    MatIconModule,
    EmptyStateComponent,
    ErrorStateComponent,
    FlagBadgeComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-request-detail.component.html',
  styleUrl: './lab-request-detail.component.scss',
})
export class LabRequestDetailComponent {
  private readonly api = inject(LabApi);
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);
  private readonly location = inject(Location);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly request = signal<LabRequest | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly patientName = signal('');
  protected readonly doctorName = signal('');

  protected readonly steps = computed(() => {
    const current = this.request()?.status;
    return current ? labSteps(current) : [];
  });
  protected readonly critical = computed(() => criticalResults(this.request()?.results ?? []));
  protected readonly stepIcon = (state: keyof typeof STEP_ICONS) => STEP_ICONS[state];
  protected readonly formatValue = formatResultValue;

  private readonly labUp = computed(() => this.status.isUp('lab'));

  constructor() {
    effect(() => {
      if (this.labUp()) {
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getRequest(this.id).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
        this.names.getPatientName(request.patientId).subscribe((n) => this.patientName.set(n));
        this.names.getDoctorName(request.doctorId).subscribe((n) => this.doctorName.set(n));
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err));
      },
    });
  }

  protected back(): void {
    this.location.back();
  }
}
