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
import { ReceptionApi } from '../../../core/api/reception.api';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NameLookupService } from '../../../core/lookup/name-lookup.service';
import type { ApiError } from '../../../core/models/common';
import type { Appointment } from '../../../core/models/reception';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
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

export interface PatientAppointmentRow extends Appointment {
  doctorName: string;
}

@Component({
  selector: 'app-my-appointments',
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
      {{ row.startAt | localDatetime }}
    </ng-template>

    <ng-template #actionsCell let-row>
      @if (row.status === 'SCHEDULED') {
        <button mat-button color="warn" type="button" (click)="cancel(row)">
          <mat-icon>cancel</mat-icon>
          Cancel
        </button>
      }
    </ng-template>

    <div *appServiceGate="'reception'">
      <app-page-header title="My Appointments" subtitle="View and manage your upcoming and past medical visits">
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
          emptyTitle="No appointments found"
          emptyMessage="You have no recorded appointments."
          (pageChange)="onPageChange($event)"
        />
      }
    </div>
  `,
})
export class MyAppointmentsComponent {
  private readonly api = inject(ReceptionApi);
  private readonly auth = inject(AuthService);
  private readonly names = inject(NameLookupService);
  private readonly status = inject(ServiceStatusService);
  private readonly confirm = inject(ConfirmService);

  private readonly statusCell = viewChild<TemplateRef<{ $implicit: PatientAppointmentRow }>>('statusCell');
  private readonly dateCell = viewChild<TemplateRef<{ $implicit: PatientAppointmentRow }>>('dateCell');
  private readonly actionsCell = viewChild<TemplateRef<{ $implicit: PatientAppointmentRow }>>('actionsCell');

  protected readonly appointments = signal<Appointment[]>([]);
  protected readonly doctorNames = signal<Record<string, string>>({});
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly patientId = computed(() => this.auth.user()?.patientId ?? '');

  protected readonly rows = computed<PatientAppointmentRow[]>(() => {
    const dNames = this.doctorNames();
    return this.appointments().map((app) => ({
      ...app,
      doctorName: dNames[app.doctorId] ?? app.doctorId.slice(0, 8),
    }));
  });

  protected readonly columns = computed<DataTableColumn<PatientAppointmentRow>[]>(() => {
    const sTpl = this.statusCell();
    const dTpl = this.dateCell();
    const aTpl = this.actionsCell();

    return [
      { key: 'date', header: 'Appointment Time', cell: dTpl ?? ((r) => r.startAt) },
      { key: 'doctor', header: 'Doctor', cell: (r) => r.doctorName },
      { key: 'status', header: 'Status', cell: sTpl ?? ((r) => r.status) },
      { key: 'actions', header: 'Actions', cell: aTpl },
    ];
  });

  private readonly receptionUp = computed(() => this.status.isUp('reception'));

  constructor() {
    effect(() => {
      if (this.receptionUp()) {
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
      .listAppointments({
        patientId: pid,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.appointments.set(page.content);
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

  protected cancel(app: PatientAppointmentRow): void {
    this.confirm
      .confirm({
        title: 'Cancel Appointment',
        message: `Are you sure you want to cancel your appointment with ${app.doctorName}?`,
        confirmLabel: 'Cancel Appointment',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.cancelAppointment(app.id, 'Cancelled by patient').subscribe({
          next: () => this.load(),
          error: (err: unknown) => this.error.set(toApiError(err)),
        });
      });
  }
}
