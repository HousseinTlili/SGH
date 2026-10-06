import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { landingPathFor } from '../core/auth/roles';
import { ThemeService } from '../core/theme/theme.service';

interface DepartmentCard {
  readonly title: string;
  readonly code: string;
  readonly icon: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly tag: string;
}

interface PersonaQuickAccess {
  readonly username: string;
  readonly name: string;
  readonly role: string;
  readonly specialty: string;
  readonly icon: string;
  readonly highlight: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly mock = inject(MockAuthBackend);
  protected readonly mockAuth = inject(MOCK_AUTH_ENABLED);

  // Simulated live telemetry values for visual appeal
  protected readonly heartRate = signal(74);
  protected readonly bloodPressure = signal('118/76');
  protected readonly spo2 = signal(99);
  protected readonly temp = signal('36.8');

  protected readonly departments: readonly DepartmentCard[] = [
    {
      title: 'Consultations & SOAP Notes',
      code: 'CLINICAL-01',
      icon: 'medical_services',
      description:
        'Complete physician clinical workspace with standardized SOAP documentation, vitals history, and ICD-10 diagnostic coding.',
      features: ['SOAP Notes', 'Vitals Telemetry', 'ICD-10 Codification'],
      tag: 'Clinical Care',
    },
    {
      title: 'Diagnostic Laboratory',
      code: 'LAB-02',
      icon: 'biotech',
      description:
        'Automated diagnostic requisition engine with barcode tracking, emergency turnaround alerts, and instant verification.',
      features: ['Direct Electronic Orders', 'Priority Stat Alerts', 'Instant Result Sync'],
      tag: 'Diagnostics',
    },
    {
      title: 'Closed-Loop Pharmacy',
      code: 'PHARM-03',
      icon: 'medication',
      description:
        'Zero-error digital prescription fulfillment, live dosage verification, and automated dispensary stock tracking.',
      features: ['E-Prescriptions', 'Dosage Validation', 'Dispensing Audit'],
      tag: 'Pharmacy',
    },
    {
      title: 'Smart Reception & Invoicing',
      code: 'RECEPT-04',
      icon: 'event_available',
      description:
        'Rapid multi-specialty appointment booking, zero-queue check-in flow, and itemized transparent billing.',
      features: ['Smart Scheduling', 'Automated Invoicing', 'Check-in Desk'],
      tag: 'Front Desk',
    },
    {
      title: 'Triage & Vital Signs Station',
      code: 'TRIAGE-05',
      icon: 'monitor_heart',
      description:
        'Continuous vital sign capture with automated Mean Arterial Pressure (MAP) computation and clinical range validation.',
      features: ['Live MAP Calculation', 'Clinical Thresholds', 'Nurse Station'],
      tag: 'Nursing',
    },
    {
      title: 'Patient Health Portal',
      code: 'PORTAL-06',
      icon: 'person_pin',
      description:
        'Direct, secure patient access to personal health records, verified lab reports, and medication instructions.',
      features: ['Digital Health Records', 'Lab History Access', 'Prescription Tracking'],
      tag: 'Patient Access',
    },
  ];

  protected readonly quickPersonas: readonly PersonaQuickAccess[] = [
    {
      username: 'patient1',
      name: 'Youssef Ben Salah',
      role: 'Patient',
      specialty: 'Patient Portal',
      icon: 'person',
      highlight: 'View lab results, active prescriptions & upcoming visits',
    },
    {
      username: 'doctor1',
      name: 'Dr. Amel Trabelsi',
      role: 'Doctor',
      specialty: 'Cardiology Specialist',
      icon: 'stethoscope',
      highlight: 'SOAP consultations, diagnostic lab orders & digital prescriptions',
    },
    {
      username: 'nurse1',
      name: 'Sonia Gharbi',
      role: 'Nurse',
      specialty: 'Triage & Vitals Lead',
      icon: 'healing',
      highlight: 'Record patient vital signs, monitor blood pressure & clinical alerts',
    },
    {
      username: 'lab1',
      name: 'Walid Mansouri',
      role: 'Lab Tech',
      specialty: 'Diagnostic Laboratory',
      icon: 'biotech',
      highlight: 'Analyze specimens, enter test results & verify critical values',
    },
    {
      username: 'pharmacist1',
      name: 'Ines Chaabane',
      role: 'Pharmacist',
      specialty: 'Hospital Pharmacy',
      icon: 'medication',
      highlight: 'Dispense prescribed medications & audit dosage instructions',
    },
    {
      username: 'reception1',
      name: 'Rim Bouazizi',
      role: 'Receptionist',
      specialty: 'Patient Admissions',
      icon: 'badge',
      highlight: 'Register patients, schedule appointments & issue invoices',
    },
  ];

  quickSignIn(username: string): void {
    if (this.mockAuth) {
      this.auth.completeSignIn(this.mock.signIn(username));
      void this.router.navigateByUrl('/');
    } else {
      void this.router.navigateByUrl('/login');
    }
  }

  goToPortal(): void {
    if (this.auth.isAuthenticated()) {
      const path = landingPathFor(this.auth.roles());
      void this.router.navigateByUrl(path);
    } else {
      void this.router.navigateByUrl('/login');
    }
  }
}
