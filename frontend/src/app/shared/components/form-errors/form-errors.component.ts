import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { AbstractControl } from '@angular/forms';
import { fieldErrorMessage } from '../../util/form-errors';

/** Shows the form-level (non-field) server error, for example a 409 duplicate. */
@Component({
  selector: 'app-form-errors',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <div class="error" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <span>{{ text }}</span>
      </div>
    }
  `,
  styles: `
    .error {
      display: flex;
      align-items: center;
      gap: var(--sgh-space-2);
      padding: var(--sgh-space-3) var(--sgh-space-4);
      border: 1px solid var(--sgh-tone-danger-solid);
      border-radius: var(--sgh-radius-sm);
      background: var(--sgh-tone-danger-bg);
      color: var(--sgh-tone-danger-fg);
    }
  `,
})
export class FormErrorsComponent {
  readonly control = input.required<AbstractControl>();

  protected message(): string | null {
    return fieldErrorMessage(this.control());
  }
}
