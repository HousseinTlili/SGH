import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { statusLabel, statusTone } from './status-tone';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="sgh-badge" [attr.data-tone]="tone()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  protected readonly tone = computed(() => statusTone(this.status()));
  protected readonly label = computed(() => statusLabel(this.status()));
}
