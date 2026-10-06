import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const PORTAL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('PATIENT')],
    children: [
      {
        path: 'appointments',
        component: FeaturePlaceholderComponent,
        data: { title: 'My appointments', service: 'reception' },
      },
      {
        path: 'invoices',
        component: FeaturePlaceholderComponent,
        data: { title: 'My invoices', service: 'reception' },
      },
      {
        path: 'consultations',
        component: FeaturePlaceholderComponent,
        data: { title: 'My consultations', service: 'consultation' },
      },
    ],
  },
];
