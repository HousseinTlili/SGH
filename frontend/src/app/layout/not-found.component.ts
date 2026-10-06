import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-not-found',
  imports: [EmptyStateComponent, MatButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-empty-state
      icon="search_off"
      title="Page not found"
      message="This address does not exist."
    >
      <a mat-flat-button routerLink="/">Back to my start page</a>
    </app-empty-state>
  `,
})
export class NotFoundComponent {}
