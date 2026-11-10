import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="titles">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="sgh-muted">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--sgh-space-4);
      margin-bottom: var(--sgh-space-5);
      padding-bottom: var(--sgh-space-3);
      border-bottom: 1px solid var(--sgh-border-subtle);
    }
    .titles {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--sgh-text);
      font-family: var(--sgh-font-display, var(--sgh-font));
    }
    .sgh-muted {
      font-size: 0.85rem;
      color: var(--sgh-text-muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sgh-space-3);
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
