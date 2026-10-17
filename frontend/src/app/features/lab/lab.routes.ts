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
        loadComponent: () =>
          import('./lab-request-detail/lab-request-detail.component').then(
            (m) => m.LabRequestDetailComponent,
          ),
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./lab-results/lab-results.component').then((m) => m.LabResultsComponent),
      },
    ],
  },
];
