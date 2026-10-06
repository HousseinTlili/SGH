import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import type { ServiceName } from '../../../core/models/common';
import { ServiceStatusService } from '../../../core/status/service-status.service';
import { ServiceUnavailableComponent } from '../service-unavailable/service-unavailable.component';

/**
 * Structural directive for the top level of a feature page:
 *
 *   <div *appServiceGate="'lab'"> ...page content... </div>
 *
 * While the service is DOWN the content is not even created (so it sends no requests) and the
 * ServiceUnavailable panel is shown instead. It switches back by itself once the status poll
 * reports the service UP again.
 */
@Directive({ selector: '[appServiceGate]' })
export class ServiceGateDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly status = inject(ServiceStatusService);

  readonly service = input.required<ServiceName>({ alias: 'appServiceGate' });
  private readonly up = computed(() => this.status.isUp(this.service()));

  constructor() {
    effect(() => {
      const up = this.up();
      untracked(() => {
        this.container.clear();
        if (up) {
          this.container.createEmbeddedView(this.template);
        } else {
          this.container
            .createComponent(ServiceUnavailableComponent)
            .setInput('service', this.service());
        }
      });
    });
  }
}
