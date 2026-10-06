import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const PHARMACY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('PHARMACIST', 'DOCTOR', 'ADMIN')],
    children: [
      {
        path: 'prescriptions',
        component: FeaturePlaceholderComponent,
        data: { title: 'Prescriptions', service: 'pharmacy' },
      },
      {
        path: 'prescriptions/:id',
        component: FeaturePlaceholderComponent,
        data: { title: 'Prescription', service: 'pharmacy' },
      },
      {
        path: 'drugs',
        component: FeaturePlaceholderComponent,
        data: { title: 'Drugs and stock', service: 'pharmacy' },
      },
      {
        path: 'stock',
        component: FeaturePlaceholderComponent,
        data: { title: 'Stock alerts', service: 'pharmacy' },
      },
    ],
  },
];
