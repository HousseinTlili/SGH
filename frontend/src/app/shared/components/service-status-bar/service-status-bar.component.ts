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
      display: flex;
      align-items: center;
      gap: var(--sgh-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid var(--sgh-tone-neutral-solid);
      color: var(--sgh-on-solid);
      cursor: default;
    }
    .dot[data-state='UP'] {
      background: var(--sgh-tone-success-solid);
      border-color: var(--sgh-tone-success-solid);
    }
    .dot[data-state='DOWN'] {
      background: var(--sgh-tone-danger-solid);
      border-color: var(--sgh-tone-danger-solid);
    }
    .dot[data-state='UNKNOWN'] {
      background: transparent;
    }
    mat-icon {
      width: 12px;
      height: 12px;
      font-size: 12px;
      color: var(--sgh-on-solid);
    }
  `,
})
export class ServiceStatusBarComponent {
  protected readonly status = inject(ServiceStatusService);
  protected readonly services = SERVICES;
  protected readonly label = serviceLabel;
}
