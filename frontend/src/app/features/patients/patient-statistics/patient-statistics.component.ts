import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PatientApi } from '../../../core/api/patient.api';
import type { PatientStatistics, PatientStatisticsQuery } from '../../../core/models/patient';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ServiceGateDirective } from '../../../shared/components/service-gate/service-gate.directive';

export interface SvgBar {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: number;
}

export interface SvgSlice {
  d: string;
  color: string;
  label: string;
  value: number;
}

@Component({
  selector: 'app-patient-statistics',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patient-statistics.component.html',
  styleUrl: './patient-statistics.component.scss',
})
export class PatientStatisticsComponent implements OnInit {
  private readonly api = inject(PatientApi);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<PatientStatistics | null>(null);

  readonly filterForm = new FormGroup({
    period: new FormControl<PatientStatisticsQuery['period']>('LAST_12_MONTHS', {
      nonNullable: true,
    }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    ageGroup: new FormControl<NonNullable<PatientStatisticsQuery['ageGroup']>>('ALL', {
      nonNullable: true,
    }),
    gender: new FormControl<NonNullable<PatientStatisticsQuery['gender']>>('ALL', {
      nonNullable: true,
    }),
  });

  readonly monthBars = computed(() => barsFromSeries(this.stats()?.registrationsByMonth ?? []));
  readonly ageBars = computed(() => barsFromNamed(this.stats()?.ageGroups ?? []));
  readonly genderSlices = computed(() =>
    donutSlices(this.stats()?.genders ?? [], [
      'var(--sgh-brand)',
      'var(--sgh-tone-accent-solid)',
      'var(--sgh-tone-neutral-solid)',
    ]),
  );
  readonly completenessSlices = computed(() => {
    const c = this.stats()?.completeness;
    if (!c) {
      return [] as SvgSlice[];
    }
    return donutSlices(
      [
        { name: 'Complete', count: c.complete },
        { name: 'Incomplete', count: c.incomplete },
      ],
      ['var(--sgh-tone-success-solid)', 'var(--sgh-tone-warning-solid)'],
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const value = this.filterForm.getRawValue();
    if (value.period === 'CUSTOM' && (!value.from || !value.to)) {
      this.error.set('Choose a start and end date for a custom period.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.statistics(value).subscribe({
      next: (res) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Statistics could not be loaded.');
      },
    });
  }

  onPeriodChange(): void {
    if (this.filterForm.controls.period.value !== 'CUSTOM') {
      this.filterForm.patchValue({ from: '', to: '' });
    }
    this.load();
  }
}

function barsFromSeries(items: { month: string; count: number }[]): SvgBar[] {
  return toBars(items.map((item) => ({ label: item.month.slice(5), value: item.count })));
}

function barsFromNamed(items: { name: string; count: number }[]): SvgBar[] {
  return toBars(items.map((item) => ({ label: item.name, value: item.count })));
}

function toBars(items: { label: string; value: number }[]): SvgBar[] {
  const max = Math.max(1, ...items.map((item) => item.value));
  const gap = 8;
  const width = 400;
  const height = 160;
  const barWidth = items.length === 0 ? 0 : (width - gap * (items.length + 1)) / items.length;
  return items.map((item, index) => {
    const barHeight = (item.value / max) * (height - 28);
    return {
      x: gap + index * (barWidth + gap),
      y: height - 20 - barHeight,
      width: Math.max(barWidth, 0),
      height: barHeight,
      label: item.label,
      value: item.value,
    };
  });
}

function donutSlices(items: { name: string; count: number }[], colors: string[]): SvgSlice[] {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return items.map((item, index) => ({
      d: '',
      color: colors[index % colors.length],
      label: item.name,
      value: item.count,
    }));
  }
  let angle = -Math.PI / 2;
  const cx = 80;
  const cy = 80;
  const r = 54;
  return items.map((item, index) => {
    const sweep = (item.count / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return {
      d: arcPath(cx, cy, r, start, angle),
      color: colors[index % colors.length],
      label: item.name,
      value: item.count,
    };
  });
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  if (end - start >= Math.PI * 2 - 1e-6) {
    const mid = start + Math.PI;
    return `${arcPath(cx, cy, r, start, mid)} ${arcPath(cx, cy, r, mid, start + Math.PI * 2)}`;
  }
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}
