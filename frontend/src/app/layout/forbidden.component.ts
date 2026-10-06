import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-forbidden',
  imports: [EmptyStateComponent, MatButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-empty-state
      icon="lock"
      title="You are not allowed to open this page"
      message="Your role does not include this screen."
    >
      <a mat-flat-button routerLink="/">Back to my start page</a>
    </app-empty-state>
  `,
})
export class ForbiddenComponent {}
