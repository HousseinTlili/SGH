import type { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/auth.guard';
import { AllergyPassportPageComponent } from './allergy-passport-page/allergy-passport-page.component';
import { PatientDetailComponent } from './patient-detail/patient-detail.component';
import { PatientFormComponent } from './patient-form/patient-form.component';
import { PatientListComponent } from './patient-list/patient-list.component';
import { PatientStatisticsComponent } from './patient-statistics/patient-statistics.component';

export const PATIENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('RECEPTIONIST', 'DOCTOR', 'NURSE', 'ADMIN')],
    children: [
      {
        path: '',
        component: PatientListComponent,
        data: { title: 'Patients', service: 'patient' },
      },
      {
        path: 'statistics',
        component: PatientStatisticsComponent,
        data: { title: 'Patient statistics', service: 'patient' },
      },
      {
        path: 'passport/:token',
        component: AllergyPassportPageComponent,
        data: { title: 'Allergy passport', service: 'patient' },
      },
      {
        path: 'new',
        component: PatientFormComponent,
        canActivate: [roleGuard('RECEPTIONIST')],
        data: { title: 'New patient', service: 'patient' },
      },
      {
        path: ':id/edit',
        component: PatientFormComponent,
        canActivate: [roleGuard('RECEPTIONIST')],
        data: { title: 'Edit patient', service: 'patient' },
      },
      {
        path: ':id',
        component: PatientDetailComponent,
        data: { title: 'Patient', service: 'patient' },
      },
    ],
  },
];
