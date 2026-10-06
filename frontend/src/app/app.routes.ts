import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { authenticatedGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';
import { landingPathFor } from './core/auth/roles';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./layout/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => landingPathFor(inject(AuthService).roles()),
      },
      {
        path: 'patients',
        loadChildren: () =>
          import('./features/patients/patients.routes').then((m) => m.PATIENT_ROUTES),
      },
      {
        path: 'appointments',
        loadChildren: () =>
          import('./features/reception/reception.routes').then((m) => m.APPOINTMENT_ROUTES),
      },
      {
        path: 'invoices',
        loadChildren: () =>
          import('./features/reception/reception.routes').then((m) => m.INVOICE_ROUTES),
      },
      {
        path: 'consultations',
        loadChildren: () =>
          import('./features/consultation/consultation.routes').then((m) => m.CONSULTATION_ROUTES),
      },
      {
        path: 'vitals',
        loadChildren: () =>
          import('./features/consultation/consultation.routes').then((m) => m.VITALS_ROUTES),
      },
      {
        path: 'lab',
        loadChildren: () => import('./features/lab/lab.routes').then((m) => m.LAB_ROUTES),
      },
      {
        path: 'pharmacy',
        loadChildren: () =>
          import('./features/pharmacy/pharmacy.routes').then((m) => m.PHARMACY_ROUTES),
      },
      {
        path: 'staff',
        loadChildren: () => import('./features/staff/staff.routes').then((m) => m.STAFF_ROUTES),
      },
      {
        path: 'my',
        loadChildren: () => import('./features/portal/portal.routes').then((m) => m.PORTAL_ROUTES),
      },
      {
        path: 'profile',
        loadComponent: () => import('./layout/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'status',
        loadComponent: () => import('./layout/status.component').then((m) => m.StatusComponent),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./layout/forbidden.component').then((m) => m.ForbiddenComponent),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./layout/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
