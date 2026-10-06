import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { LabFlag } from '../../../core/models/consultation';
import { flagIcon, flagLabel, flagTone } from './flag';

@Component({
  selector: 'app-flag-badge',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sgh-badge" [attr.data-tone]="tone()">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      {{ label() }}
    </span>
  `,
})
export class FlagBadgeComponent {
  readonly flag = input.required<LabFlag>();
  protected readonly tone = computed(() => flagTone(this.flag()));
  protected readonly icon = computed(() => flagIcon(this.flag()));
  protected readonly label = computed(() => flagLabel(this.flag()));
}
