import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { FeaturePlaceholderComponent } from '../../shared/components/feature-placeholder/feature-placeholder.component';
export const PATIENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('RECEPTIONIST', 'DOCTOR', 'NURSE', 'ADMIN')],
    children: [
      {
        path: '',
        component: FeaturePlaceholderComponent,
        data: { title: 'Patients', service: 'patient' },
      },
      {
        path: 'new',
        component: FeaturePlaceholderComponent,
        data: { title: 'New patient', service: 'patient' },
      },
      {
        path: ':id/edit',
        component: FeaturePlaceholderComponent,
        data: { title: 'Edit patient', service: 'patient' },
      },
      {
        path: ':id',
        component: FeaturePlaceholderComponent,
        data: { title: 'Patient', service: 'patient' },
      },
    ],
  },
];
