import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';

export const PORTAL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('PATIENT')],
    children: [
      {
        path: 'appointments',
        loadComponent: () =>
          import('./my-appointments/my-appointments.component').then(
            (m) => m.MyAppointmentsComponent,
          ),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./my-invoices/my-invoices.component').then((m) => m.MyInvoicesComponent),
      },
      {
        path: 'consultations',
        loadComponent: () =>
          import('./my-consultations/my-consultations.component').then(
            (m) => m.MyConsultationsComponent,
          ),
      },
    ],
  },
];
