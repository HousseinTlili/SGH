import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  imports: [MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" role="status">
      <mat-spinner diameter="36" aria-hidden="true" />
      <span class="sgh-muted">{{ label() }}</span>
    </div>
  `,
  styles: `
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sgh-space-3);
      padding: var(--sgh-space-7) var(--sgh-space-4);
    }
  `,
})
export class LoadingStateComponent {
  readonly label = input('Loading...');
}
