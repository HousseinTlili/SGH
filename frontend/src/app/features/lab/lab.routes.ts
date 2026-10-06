import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const LAB_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('LAB_TECHNICIAN', 'DOCTOR', 'ADMIN')],
    children: [
      {
        path: 'requests',
        component: FeaturePlaceholderComponent,
        data: { title: 'Lab requests', service: 'lab' },
      },
      {
        path: 'requests/:id',
        component: FeaturePlaceholderComponent,
        data: { title: 'Lab request', service: 'lab' },
      },
      {
        path: 'results',
        component: FeaturePlaceholderComponent,
        data: { title: 'Lab results', service: 'lab' },
      },
    ],
  },
];
