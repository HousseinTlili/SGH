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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router';
import { LabApi } from '../../../core/api/lab.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { LabFlag, LabResultLine } from '../../../core/models/consultation';
import type { LabRequest, LabTest } from '../../../core/models/lab';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FlagBadgeComponent } from '../../../shared/components/flag-badge/flag-badge.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';
import { computeFlag, criticalResults, formatResultValue, labSteps } from '../lab-rules';

const STEP_ICONS = {
  done: 'check_circle',
  current: 'radio_button_checked',
  todo: 'radio_button_unchecked',
} as const;

export interface ResultInputRow {
  testCode: string;
  testName: string;
  value: number | null;
  unit: string;
  refRange: string;
  flag: LabFlag | null;
  testCatalogue?: LabTest;
}

@Component({
  selector: 'app-lab-request-detail',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
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
  private readonly auth = inject(AuthService);
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly request = signal<LabRequest | null>(null);
  protected readonly testsCatalogue = signal<Map<string, LabTest>>(new Map());
  protected readonly loading = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly actionError = signal<ApiError | null>(null);
  protected readonly patientName = signal('');
  protected readonly doctorName = signal('');

  protected readonly isLabTechnician = computed(() => this.auth.hasRole('LAB_TECHNICIAN'));

  protected readonly resultRows = signal<ResultInputRow[]>([]);

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
        untracked(() => {
          this.loadCatalogue();
          this.load();
        });
      }
    });
  }

  loadCatalogue(): void {
    this.api.getTests().subscribe({
      next: (tests) => {
        const map = new Map<string, LabTest>();
        for (const t of tests) {
          map.set(t.code, t);
        }
        this.testsCatalogue.set(map);
        this.syncResultRows();
      },
      error: () => {
        // Catalogue optional; fallback to request defaults
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getRequest(this.id).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
        this.syncResultRows();
        this.names.getPatientName(request.patientId).subscribe((n) => this.patientName.set(n));
        this.names.getDoctorName(request.doctorId).subscribe((n) => this.doctorName.set(n));
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err));
      },
    });
  }

  private syncResultRows(): void {
    const req = this.request();
    if (!req) return;
    const cat = this.testsCatalogue();

    const existingResults = new Map<string, LabResultLine>();
    for (const res of req.results) {
      existingResults.set(res.testCode, res);
    }

    const rows: ResultInputRow[] = req.tests.map((t) => {
      const existing = existingResults.get(t.code);
      const testDef = cat.get(t.code);
      const unit = existing?.unit ?? testDef?.unit ?? '';
      const refRange =
        existing?.referenceRange ??
        (testDef ? `${testDef.refLow}-${testDef.refHigh}` : '');
      const value = existing ? existing.value : null;
      const flag = existing ? existing.flag : null;

      return {
        testCode: t.code,
        testName: t.name,
        value,
        unit,
        refRange,
        flag,
        testCatalogue: testDef,
      };
    });

    this.resultRows.set(rows);
  }

  protected onValueChanged(row: ResultInputRow, rawVal: string): void {
    const num = rawVal === '' || isNaN(Number(rawVal)) ? null : Number(rawVal);
    row.value = num;

    if (num != null && row.testCatalogue) {
      const t = row.testCatalogue;
      row.flag = computeFlag(num, t.refLow, t.refHigh, t.criticalLow, t.criticalHigh);
    } else {
      row.flag = null;
    }
    this.resultRows.set([...this.resultRows()]);
  }

  protected startAnalysis(): void {
    const req = this.request();
    if (!req) return;

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.api.startRequest(req.id).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.actionLoading.set(false);
        this.syncResultRows();
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(toApiError(err));
      },
    });
  }

  protected saveResults(): void {
    const req = this.request();
    if (!req) return;

    const payload: { testCode: string; value: number; unit?: string }[] = [];
    for (const r of this.resultRows()) {
      if (r.value != null) {
        payload.push({
          testCode: r.testCode,
          value: r.value,
          unit: r.unit || undefined,
        });
      }
    }

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.api.enterResults(req.id, payload).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.actionLoading.set(false);
        this.syncResultRows();
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(toApiError(err));
      },
    });
  }

  protected validateAnalysis(): void {
    const req = this.request();
    if (!req) return;

    const criticalList = this.critical();
    const hasCritical = criticalList.length > 0;
    const message = hasCritical
      ? `This request contains ${criticalList.length} critical value(s): ${criticalList.map((c) => `${c.testCode} (${formatResultValue(c.value, c.unit)})`).join(', ')}. Are you sure you want to validate? Results become final and immutable.`
      : 'Are you sure you want to validate this lab request? Validated results are final and immutable.';

    this.confirm
      .confirm({
        title: 'Validate Lab Request',
        message,
        confirmLabel: 'Validate & Publish',
        danger: hasCritical,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.actionLoading.set(true);
        this.actionError.set(null);
        this.api.validateRequest(req.id).subscribe({
          next: (updated) => {
            this.request.set(updated);
            this.actionLoading.set(false);
            this.syncResultRows();
          },
          error: (err: unknown) => {
            this.actionLoading.set(false);
            this.actionError.set(toApiError(err));
          },
        });
      });
  }

  protected back(): void {
    this.location.back();
  }
}
