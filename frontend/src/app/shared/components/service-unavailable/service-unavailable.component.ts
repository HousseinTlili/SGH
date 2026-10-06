import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { ServiceName } from '../../../core/models/common';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { serviceLabel } from '../../../core/status/services';

@Component({
  selector: 'app-service-unavailable',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel" role="status">
      <mat-icon aria-hidden="true">cloud_off</mat-icon>
      <h2>{{ label() }} service is unavailable.</h2>
      <p class="sgh-muted">Everything else keeps working.</p>
      <button mat-stroked-button type="button" (click)="onRetry()">
        <mat-icon>refresh</mat-icon>
        Retry
      </button>
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sgh-space-2);
      padding: var(--sgh-space-7) var(--sgh-space-4);
      text-align: center;
      background: var(--sgh-tone-warning-bg);
      border: 1px solid var(--sgh-tone-warning-solid);
      border-radius: var(--sgh-radius);
      color: var(--sgh-tone-warning-fg);
    }
    .panel > mat-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
    }
    .panel .sgh-muted {
      color: var(--sgh-tone-warning-fg);
    }
    button {
      margin-top: var(--sgh-space-2);
    }
  `,
})
export class ServiceUnavailableComponent {
  private readonly status = inject(ServiceStatusService);

  readonly service = input.required<ServiceName>();
  readonly retry = output<void>();
  protected readonly label = computed(() => serviceLabel(this.service()));

  protected onRetry(): void {
    this.status.refresh();
    this.retry.emit();
  }
}
