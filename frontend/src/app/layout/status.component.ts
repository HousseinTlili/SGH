import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type ServiceState, ServiceStatusService } from '../core/status/service-status.service';
import { SERVICES, serviceLabel } from '../core/status/services';
import { PageHeaderComponent } from '../shared/components/page-header/page-header.component';
import type { Tone } from '../shared/components/status-badge/status-tone';

const TONE: Record<ServiceState, Tone> = { UP: 'success', DOWN: 'danger', UNKNOWN: 'neutral' };
const ICON: Record<ServiceState, string> = {
  UP: 'check_circle',
  DOWN: 'cancel',
  UNKNOWN: 'help',
};

@Component({
  selector: 'app-status',
  imports: [MatIconModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Service status"
      subtitle="If a service is down, only its own screens are affected."
    />
    <ul class="cards">
      <li class="sgh-card card">
        <h2>Gateway</h2>
        <span class="sgh-badge" [attr.data-tone]="tone(status.gateway())">
          <mat-icon aria-hidden="true">{{ icon(status.gateway()) }}</mat-icon>
          {{ status.gateway() }}
        </span>
        <small class="sgh-muted">{{ checked() }}</small>
      </li>
      @for (service of services; track service) {
        <li class="sgh-card card">
          <h2>{{ label(service) }}</h2>
          <span class="sgh-badge" [attr.data-tone]="tone(status.state()[service])">
            <mat-icon aria-hidden="true">{{ icon(status.state()[service]) }}</mat-icon>
            {{ status.state()[service] }}
          </span>
          <small class="sgh-muted">{{ checked() }}</small>
        </li>
      }
    </ul>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--sgh-space-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sgh-space-3);
      padding: var(--sgh-space-4) var(--sgh-space-5);
    }
  `,
})
export class StatusComponent {
  protected readonly status = inject(ServiceStatusService);
  protected readonly services = SERVICES;
  protected readonly label = serviceLabel;
  protected readonly tone = (state: ServiceState) => TONE[state];
  protected readonly icon = (state: ServiceState) => ICON[state];
  private readonly datePipe = new DatePipe('en-US');

  protected checked(): string {
    const at = this.status.lastChecked();
    return at ? `Last check ${this.datePipe.transform(at, 'mediumTime')}` : 'Not checked yet';
  }
}
