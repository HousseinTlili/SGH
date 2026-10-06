import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <h2>{{ title() }}</h2>
      @if (message()) {
        <p class="sgh-muted">{{ message() }}</p>
      }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sgh-space-2);
      padding: var(--sgh-space-7) var(--sgh-space-4);
      text-align: center;
    }
    mat-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--sgh-text-muted);
    }
    .actions {
      margin-top: var(--sgh-space-2);
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input('Nothing here yet');
  readonly message = input<string>();
  readonly icon = input('inbox');
}
