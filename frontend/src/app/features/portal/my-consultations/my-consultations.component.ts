import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConsultationApi } from '../../../core/api/consultation.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { Consultation } from '../../../core/models/consultation';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import {
  type DataTableColumn,
  DataTableComponent,
  type PageChange,
} from '../../../shared/components/data-table/data-table.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LocalDatetimePipe } from '../../../shared/pipes/local-datetime.pipe';

export interface PatientConsultationRow extends Consultation {
  doctorName: string;
}

@Component({
  selector: 'app-my-consultations',
  imports: [
    MatButtonModule,
    MatIconModule,
    DataTableComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    ServiceGateDirective,
    StatusBadgeComponent,
    LocalDatetimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #statusCell let-row>
      <app-status-badge [status]="row.status" />
    </ng-template>

    <ng-template #dateCell let-row>
      {{ row.createdAt | localDatetime }}
    </ng-template>

    <ng-template #soapCell let-row>
      <div class="soap-summary">
        @if (row.assessment) {
          <div><strong>Assessment:</strong> {{ row.assessment }}</div>
        }
        @if (row.plan) {
          <div><strong>Plan:</strong> {{ row.plan }}</div>
        }
        @if (!row.assessment && !row.plan) {
          <span class="muted">No summary recorded</span>
        }
      </div>
    </ng-template>

    <div *appServiceGate="'consultation'">
      <app-page-header
        title="My Consultations"
        subtitle="Medical consultation history, clinical assessments and doctor recommendations"
      >
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </app-page-header>

      @if (error(); as err) {
        <app-error-state [error]="err" (retry)="load()" />
      } @else {
        <app-data-table
          [columns]="columns()"
          [rows]="rows()"
          [total]="total()"
          [page]="page()"
          [size]="size()"
          [loading]="loading()"
          emptyTitle="No consultations found"
          emptyMessage="You have no recorded clinical consultations."
          (pageChange)="onPageChange($event)"
        />
      }
    </div>
  `,
  styles: `
    .soap-summary {
      font-size: var(--sgh-text-sm);
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .muted {
      color: var(--sgh-text-muted);
    }
  `,
})
export class MyConsultationsComponent {
  private readonly api = inject(ConsultationApi);
  private readonly auth = inject(AuthService);
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);

  private readonly statusCell =
    viewChild<TemplateRef<{ $implicit: PatientConsultationRow }>>('statusCell');
  private readonly dateCell =
    viewChild<TemplateRef<{ $implicit: PatientConsultationRow }>>('dateCell');
  private readonly soapCell =
    viewChild<TemplateRef<{ $implicit: PatientConsultationRow }>>('soapCell');

  protected readonly consultations = signal<Consultation[]>([]);
  protected readonly doctorNames = signal<Record<string, string>>({});
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly patientId = computed(() => this.auth.user()?.patientId ?? '');

  protected readonly rows = computed<PatientConsultationRow[]>(() => {
    const dNames = this.doctorNames();
    return this.consultations().map((c) => ({
      ...c,
      doctorName: dNames[c.doctorId] ?? c.doctorId.slice(0, 8),
    }));
  });

  protected readonly columns = computed<DataTableColumn<PatientConsultationRow>[]>(() => {
    const sTpl = this.statusCell();
    const dTpl = this.dateCell();
    const soapTpl = this.soapCell();

    return [
      { key: 'date', header: 'Consultation Date', cell: dTpl ?? ((r) => r.createdAt) },
      { key: 'doctor', header: 'Attending Doctor', cell: (r) => r.doctorName },
      { key: 'summary', header: 'Assessment & Plan', cell: soapTpl },
      { key: 'status', header: 'Status', cell: sTpl ?? ((r) => r.status) },
    ];
  });

  private readonly consultationUp = computed(() => this.status.isUp('consultation'));

  constructor() {
    effect(() => {
      if (this.consultationUp()) {
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    const pid = this.patientId();
    if (!pid) return;

    this.loading.set(true);
    this.error.set(null);

    this.api
      .list({
        patientId: pid,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.consultations.set(page.content);
          this.total.set(page.totalElements);
          this.loading.set(false);

          for (const item of page.content) {
            if (!this.doctorNames()[item.doctorId]) {
              this.names.getDoctorName(item.doctorId).subscribe((name) => {
                this.doctorNames.update((m) => ({ ...m, [item.doctorId]: name }));
              });
            }
          }
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(toApiError(err));
        },
      });
  }

  protected onPageChange(change: PageChange): void {
    this.page.set(change.page);
    this.size.set(change.size);
    this.load();
  }
}
