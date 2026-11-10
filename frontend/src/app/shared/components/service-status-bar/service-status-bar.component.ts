import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { SERVICES, serviceLabel } from '../../../core/status/services';

@Component({
  selector: 'app-service-status-bar',
  imports: [MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bar" aria-label="Service status">
      @for (service of services; track service) {
        <li
          class="dot"
          [attr.data-state]="status.state()[service]"
          [matTooltip]="label(service) + ': ' + status.state()[service]"
          tabindex="0"
        >
          @if (status.state()[service] === 'DOWN') {
            <mat-icon aria-hidden="true">close</mat-icon>
          }
          <span class="sgh-visually-hidden"
            >{{ label(service) }}: {{ status.state()[service] }}</span
          >
        </li>
      }
    </ul>
  `,
  styles: `
    .bar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 4px 8px;
      list-style: none;
      background: var(--sgh-surface-1);
      border: 1px solid var(--sgh-border-subtle);
      border-radius: 9999px;
    }
    .dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1.5px solid var(--sgh-border);
      color: var(--sgh-on-solid);
      cursor: default;
      transition: all 0.2s ease;
    }
    .dot[data-state='UP'] {
      background: var(--sgh-tone-success-solid);
      border-color: var(--sgh-tone-success-solid);
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
    }
    .dot[data-state='DOWN'] {
      background: var(--sgh-tone-danger-solid);
      border-color: var(--sgh-tone-danger-solid);
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
    }
    .dot[data-state='UNKNOWN'] {
      background: var(--sgh-border-subtle);
      border-color: var(--sgh-border-subtle);
    }
    mat-icon {
      width: 8px;
      height: 8px;
      font-size: 8px;
      color: var(--sgh-on-solid);
    }
  `,
})
export class ServiceStatusBarComponent {
  protected readonly status = inject(ServiceStatusService);
  protected readonly services = SERVICES;
  protected readonly label = serviceLabel;
}
