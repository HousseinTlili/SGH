import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const APPOINTMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('RECEPTIONIST', 'DOCTOR', 'ADMIN')],
    children: [
      {
        path: '',
        component: FeaturePlaceholderComponent,
        data: { title: 'Appointments', service: 'reception' },
      },
      {
        path: 'new',
        component: FeaturePlaceholderComponent,
        data: { title: 'New appointment', service: 'reception' },
      },
      {
        path: ':id',
        component: FeaturePlaceholderComponent,
        data: { title: 'Appointment', service: 'reception' },
      },
    ],
  },
];

export const INVOICE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('RECEPTIONIST', 'ADMIN')],
    children: [
      {
        path: '',
        component: FeaturePlaceholderComponent,
        data: { title: 'Invoices', service: 'reception' },
      },
      {
        path: 'new',
        component: FeaturePlaceholderComponent,
        data: { title: 'New invoice', service: 'reception' },
      },
      {
        path: ':id',
        component: FeaturePlaceholderComponent,
        data: { title: 'Invoice', service: 'reception' },
      },
    ],
  },
];
