import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { StaffFormComponent } from './staff-form/staff-form.component';
import { StaffListComponent } from './staff-list/staff-list.component';

export const STAFF_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    children: [
      {
        path: '',
        component: StaffListComponent,
        data: { title: 'Staff', service: 'staff' },
      },
      {
        path: 'new',
        component: StaffFormComponent,
        data: { title: 'New staff member', service: 'staff' },
      },
      {
        path: ':id/edit',
        component: StaffFormComponent,
        data: { title: 'Edit staff member', service: 'staff' },
      },
    ],
  },
];
