import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { lastCorrelationId } from '../../../core/http/correlation';
import type { ApiError } from '../../../core/models/common';

@Component({
  selector: 'app-error-state',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" role="alert">
      <mat-icon aria-hidden="true">error_outline</mat-icon>
      <h2>Something went wrong</h2>
      <p>{{ text() }}</p>
      @if (reference()) {
        <small class="sgh-muted">Reference: {{ reference() }}</small>
      }
      <button mat-stroked-button type="button" (click)="retry.emit()">
        <mat-icon>refresh</mat-icon>
        Try again
      </button>
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
      color: var(--sgh-tone-danger-solid);
    }
    .state > mat-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
    }
    button {
      margin-top: var(--sgh-space-2);
    }
  `,
})
export class ErrorStateComponent {
  readonly error = input<ApiError | null>(null);
  readonly message = input<string>();
  readonly retry = output<void>();

  protected readonly text = computed(
    () => this.message() ?? this.error()?.message ?? 'The request could not be completed.',
  );
  protected readonly reference = computed(
    () => this.error()?.correlationId ?? lastCorrelationId() ?? '',
  );
}
