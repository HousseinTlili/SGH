import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';

export const PHARMACY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('PHARMACIST', 'DOCTOR', 'ADMIN')],
    children: [
      {
        path: 'prescriptions',
        loadComponent: () =>
          import('./prescription-queue/prescription-queue.component').then(
            (m) => m.PrescriptionQueueComponent,
          ),
      },
      {
        path: 'prescriptions/:id',
        loadComponent: () =>
          import('./prescription-detail/prescription-detail.component').then(
            (m) => m.PrescriptionDetailComponent,
          ),
      },
      {
        path: 'drugs',
        loadComponent: () =>
          import('./drug-list/drug-list.component').then((m) => m.DrugListComponent),
      },
      {
        path: 'stock',
        loadComponent: () =>
          import('./stock-alerts/stock-alerts.component').then((m) => m.StockAlertsComponent),
      },
    ],
  },
];
