import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { AppointmentFormComponent } from './appointment-form/appointment-form.component';
import { AppointmentListComponent } from './appointment-list/appointment-list.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { InvoiceListComponent } from './invoice-list/invoice-list.component';

export const APPOINTMENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('RECEPTIONIST', 'DOCTOR', 'ADMIN')],
    children: [
      {
        path: '',
        component: AppointmentListComponent,
        data: { title: 'Appointments', service: 'reception' },
      },
      {
        path: 'new',
        component: AppointmentFormComponent,
        canActivate: [roleGuard('RECEPTIONIST')],
        data: { title: 'New appointment', service: 'reception' },
      },
      {
        path: ':id',
        component: AppointmentFormComponent,
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
        component: InvoiceListComponent,
        data: { title: 'Invoices', service: 'reception' },
      },
      {
        path: 'new',
        component: InvoiceFormComponent,
        canActivate: [roleGuard('RECEPTIONIST')],
        data: { title: 'New invoice', service: 'reception' },
      },
      {
        path: ':id',
        component: InvoiceDetailComponent,
        data: { title: 'Invoice', service: 'reception' },
      },
    ],
  },
];
