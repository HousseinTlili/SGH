import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { landingPathFor } from '../core/auth/roles';
import { ThemeService } from '../core/theme/theme.service';

interface DepartmentItem {
  readonly title: string;
  readonly code: string;
  readonly icon: string;
  readonly summary: string;
  readonly features: readonly string[];
}

interface PersonaQuickLaunch {
  readonly username: string;
  readonly fullName: string;
  readonly roleLabel: string;
  readonly title: string;
  readonly icon: string;
  readonly description: string;
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

  // Live telemetry metrics preview
  protected readonly heartRate = signal(72);
  protected readonly bloodPressure = signal('118/76');
  protected readonly oxygen = signal(99);
  protected readonly temp = signal('36.8');

  protected readonly departments: readonly DepartmentItem[] = [
    {
      title: 'Consultations & SOAP Notes',
      code: 'CLINICAL',
      icon: 'stethoscope',
      summary:
        'Continuous clinical records, structured SOAP notes, and ICD-10 codification for specialist care.',
      features: ['Structured SOAP Workspace', 'Real-time Vitals History', 'ICD-10 Codification'],
    },
    {
      title: 'Diagnostic Laboratory',
      code: 'PATHOLOGY',
      icon: 'biotech',
      summary:
        'Rapid electronic test requisitions with automated barcode tracking and emergency turnaround flags.',
      features: ['Automated Orders', 'Critical Results Flagging', 'Instant Telemetry Sync'],
    },
    {
      title: 'Hospital Pharmacy',
      code: 'DISPENSARY',
      icon: 'medication',
      summary:
        'Closed-loop digital medication management with electronic dispensing and safety validation.',
      features: ['Direct E-Prescriptions', 'Dosage Validation', 'Live Stock Tracking'],
    },
    {
      title: 'Patient Reception & Admissions',
      code: 'ADMISSIONS',
      icon: 'event_available',
      summary:
        'Frictionless appointment booking, multi-specialty scheduling, and transparent billing.',
      features: ['Online Appointments', 'Automated Invoicing', 'Zero-wait Check-in'],
    },
    {
      title: 'Emergency & Triage Vitals',
      code: 'TRIAGE',
      icon: 'healing',
      summary:
        'High-velocity triage station with automatic Mean Arterial Pressure (MAP) and vital threshold alerts.',
      features: ['Continuous Vitals Capture', 'MAP Calculation', 'Rapid Triage Routing'],
    },
    {
      title: 'Patient Digital Portal',
      code: 'PORTAL',
      icon: 'person_pin',
      summary:
        'Secure 24/7 home access to laboratory reports, active medication regimens, and health summaries.',
      features: ['Lab Report Archive', 'Prescription Tracking', 'Visit Summaries'],
    },
  ];

  protected readonly quickPersonas: readonly PersonaQuickLaunch[] = [
    {
      username: 'patient1',
      fullName: 'Youssef Ben Salah',
      roleLabel: 'Patient',
      title: 'Personal Health Portal',
      icon: 'person',
      description: 'Access verified lab results, medications & upcoming appointments.',
    },
    {
      username: 'doctor1',
      fullName: 'Dr. Amel Trabelsi',
      roleLabel: 'Cardiologist',
      title: 'Clinical Consultation Desk',
      icon: 'stethoscope',
      description: 'Review patient history, author SOAP notes & order diagnostic labs.',
    },
    {
      username: 'nurse1',
      fullName: 'Sonia Gharbi',
      roleLabel: 'Head Nurse',
      title: 'Triage & Vital Signs',
      icon: 'healing',
      description: 'Record patient vitals, verify blood pressure & monitor acute alarms.',
    },
    {
      username: 'lab1',
      fullName: 'Walid Mansouri',
      roleLabel: 'Lab Technologist',
      title: 'Clinical Pathology',
      icon: 'biotech',
      description: 'Process urgent test requisitions & publish validated results.',
    },
    {
      username: 'pharmacist1',
      fullName: 'Ines Chaabane',
      roleLabel: 'Lead Pharmacist',
      title: 'Hospital Dispensary',
      icon: 'medication',
      description: 'Fulfill digital prescriptions & check dosage instructions.',
    },
    {
      username: 'reception1',
      fullName: 'Rim Bouazizi',
      roleLabel: 'Admissions Officer',
      title: 'Front Desk & Billing',
      icon: 'badge',
      description: 'Register incoming patients, book visits & process patient invoices.',
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
