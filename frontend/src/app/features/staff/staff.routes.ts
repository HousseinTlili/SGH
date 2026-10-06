import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const STAFF_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    children: [
      {
        path: '',
        component: FeaturePlaceholderComponent,
        data: { title: 'Staff', service: 'staff' },
      },
      {
        path: 'new',
        component: FeaturePlaceholderComponent,
        data: { title: 'New staff member', service: 'staff' },
      },
      {
        path: ':id/edit',
        component: FeaturePlaceholderComponent,
        data: { title: 'Edit staff member', service: 'staff' },
      },
    ],
  },
];
