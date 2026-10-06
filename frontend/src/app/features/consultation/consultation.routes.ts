import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const CONSULTATION_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('DOCTOR', 'NURSE', 'ADMIN')],
    children: [
      {
        path: '',
        component: FeaturePlaceholderComponent,
        data: { title: 'Consultations', service: 'consultation' },
      },
      {
        path: ':id',
        component: FeaturePlaceholderComponent,
        data: { title: 'Consultation', service: 'consultation' },
      },
    ],
  },
];

export const VITALS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('NURSE', 'DOCTOR')],
    children: [
      {
        path: '',
        component: FeaturePlaceholderComponent,
        data: { title: 'Vital signs', service: 'consultation' },
      },
    ],
  },
];
