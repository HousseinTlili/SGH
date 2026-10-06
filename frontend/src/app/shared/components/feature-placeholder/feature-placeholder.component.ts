import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { ServiceName } from '../../../core/models/common';
import { serviceLabel } from '../../../core/status/services';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { ServiceGateDirective } from '../service-gate/service-gate.directive';

/**
 * Temporary screen for routes whose feature is built in a later phase. It already behaves like a
 * real page at the top level: a stopped service shows the ServiceUnavailable panel here only.
 * Each feature phase replaces its placeholders and this component is removed with the last one.
 */
@Component({
  selector: 'app-feature-placeholder',
  imports: [PageHeaderComponent, EmptyStateComponent, ServiceGateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="title" [subtitle]="subtitle" />
    <div *appServiceGate="service">
      <app-empty-state
        icon="construction"
        title="This screen is not built yet"
        message="It arrives in a later front-end phase."
      />
    </div>
  `,
})
export class FeaturePlaceholderComponent {
  private readonly data = inject(ActivatedRoute).snapshot.data as {
    title: string;
    service: ServiceName;
  };
  protected readonly title = this.data.title;
  protected readonly service = this.data.service;
  protected readonly subtitle = `Served by the ${serviceLabel(this.service)} service`;
}
