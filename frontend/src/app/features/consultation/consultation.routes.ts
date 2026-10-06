import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';

export const CONSULTATION_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('DOCTOR', 'NURSE', 'ADMIN')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./consultation-list/consultation-list.component').then(
            (m) => m.ConsultationListComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./consultation-workspace/consultation-workspace.component').then(
            (m) => m.ConsultationWorkspaceComponent,
          ),
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
        loadComponent: () =>
          import('./vitals-page/vitals-page.component').then((m) => m.VitalsPageComponent),
      },
    ],
  },
];
