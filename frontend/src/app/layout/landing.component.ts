import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { landingPathFor } from '../core/auth/roles';
import { ServiceStatusService } from '../core/status/service-status.service';
import { ThemeService } from '../core/theme/theme.service';

export interface PatientChart {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly mrn: string;
  readonly ageGender: string;
  readonly dob: string;
  readonly bloodType: string;
  readonly allergies: string;
  readonly room: string;
  readonly vitalsTime: string;
  readonly bp: string;
  readonly bpStatus: string;
  readonly hr: number;
  readonly hrStatus: string;
  readonly spo2: number;
  readonly temp: string;
  readonly tempStatus: string;
  readonly labOrder: string;
  readonly analyzer: string;
  readonly labTests: readonly {
    code: string;
    name: string;
    value: string;
    unit: string;
    range: string;
    flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';
  }[];
  readonly rxItems: readonly {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }[];
}

export interface PersonaQuickLaunch {
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
  protected readonly status = inject(ServiceStatusService);
  private readonly router = inject(Router);
  private readonly mock = inject(MockAuthBackend);
  protected readonly mockAuth = inject(MOCK_AUTH_ENABLED);

  // Active chart preview
  protected readonly activePatientIndex = signal(0);
  protected readonly activeWorkflowTab = signal<
    'consultation' | 'lab' | 'pharmacy' | 'reception' | 'billing'
  >('consultation');

  protected readonly allServicesUp = computed(() => {
    return (
      this.status.isUp('patient') &&
      this.status.isUp('reception') &&
      this.status.isUp('consultation') &&
      this.status.isUp('lab') &&
      this.status.isUp('pharmacy') &&
      this.status.isUp('staff')
    );
  });

  protected readonly patientCharts: readonly PatientChart[] = [
    {
      id: 'p1',
      name: 'Youssef Mansouri',
      initials: 'YM',
      mrn: 'MRN-2026-0849',
      ageGender: '42M',
      dob: '14/05/1984 (42y)',
      bloodType: 'O+',
      allergies: 'Sulfonamides (Moderate)',
      room: 'Internal Medicine • Room 304B',
      vitalsTime: 'Recorded 14 mins ago by Nurse Sonia',
      bp: '120/80',
      bpStatus: 'NORMAL',
      hr: 76,
      hrStatus: 'NORMAL',
      spo2: 98.4,
      temp: '37.8',
      tempStatus: 'LOW-GRADE',
      labOrder: '#LAB-8921',
      analyzer: 'Cobas c503',
      labTests: [
        {
          code: 'GLU',
          name: 'Fasting Blood Glucose',
          value: '115.0',
          unit: 'mg/dL',
          range: '70.0 - 100.0',
          flag: 'HIGH',
        },
        {
          code: 'HGB',
          name: 'Hemoglobin',
          value: '14.2',
          unit: 'g/dL',
          range: '12.0 - 17.0',
          flag: 'NORMAL',
        },
        {
          code: 'WBC',
          name: 'White Blood Cell Count',
          value: '8.4',
          unit: '10^9/L',
          range: '4.0 - 11.0',
          flag: 'NORMAL',
        },
      ],
      rxItems: [
        {
          name: 'Amoxicillin 500 mg',
          dosage: '1 capsule',
          frequency: '3 per day',
          duration: '7 days',
        },
        {
          name: 'Paracetamol 500 mg',
          dosage: '1 tablet',
          frequency: 'As needed for fever',
          duration: '3 days',
        },
      ],
    },
    {
      id: 'p2',
      name: 'Amel Ben Salah',
      initials: 'AB',
      mrn: 'MRN-2026-0412',
      ageGender: '58F',
      dob: '22/09/1968 (58y)',
      bloodType: 'A+',
      allergies: 'Penicillin (Severe)',
      room: 'Cardiology Clinic • Consultation 2B',
      vitalsTime: 'Recorded 8 mins ago by Triage Nurse',
      bp: '138/88',
      bpStatus: 'ELEVATED',
      hr: 82,
      hrStatus: 'NORMAL',
      spo2: 97.2,
      temp: '36.8',
      tempStatus: 'NORMAL',
      labOrder: '#LAB-8930',
      analyzer: 'Architect ci4100',
      labTests: [
        {
          code: 'CHOL',
          name: 'Total Cholesterol',
          value: '228.0',
          unit: 'mg/dL',
          range: '125.0 - 200.0',
          flag: 'HIGH',
        },
        {
          code: 'TRIG',
          name: 'Triglycerides',
          value: '145.0',
          unit: 'mg/dL',
          range: '50.0 - 150.0',
          flag: 'NORMAL',
        },
        {
          code: 'K+',
          name: 'Serum Potassium',
          value: '4.2',
          unit: 'mmol/L',
          range: '3.5 - 5.1',
          flag: 'NORMAL',
        },
      ],
      rxItems: [
        {
          name: 'Atorvastatin 20 mg',
          dosage: '1 tablet',
          frequency: 'Once daily at bedtime',
          duration: '30 days',
        },
      ],
    },
    {
      id: 'p3',
      name: 'Karim Trabelsi',
      initials: 'KT',
      mrn: 'MRN-2026-1102',
      ageGender: '29M',
      dob: '03/11/1997 (29y)',
      bloodType: 'B+',
      allergies: 'None recorded (NKDA)',
      room: 'Outpatient Triage • Bay 01',
      vitalsTime: 'Recorded 22 mins ago by Nurse Sonia',
      bp: '118/74',
      bpStatus: 'NORMAL',
      hr: 68,
      hrStatus: 'NORMAL',
      spo2: 99.1,
      temp: '36.6',
      tempStatus: 'NORMAL',
      labOrder: '#LAB-8942',
      analyzer: 'Sysmex XN-1000',
      labTests: [
        {
          code: 'PLT',
          name: 'Platelet Count',
          value: '245.0',
          unit: '10^9/L',
          range: '150.0 - 450.0',
          flag: 'NORMAL',
        },
        {
          code: 'CRP',
          name: 'C-Reactive Protein',
          value: '2.1',
          unit: 'mg/L',
          range: '0.0 - 5.0',
          flag: 'NORMAL',
        },
      ],
      rxItems: [
        {
          name: 'Cetirizine 10 mg',
          dosage: '1 tablet',
          frequency: 'Once daily',
          duration: '7 days',
        },
      ],
    },
  ];

  protected readonly activePatient = computed(() => this.patientCharts[this.activePatientIndex()]);

  protected readonly quickPersonas: readonly PersonaQuickLaunch[] = [
    {
      username: 'doctor1',
      fullName: 'Dr. Amel Trabelsi',
      roleLabel: 'Attending Physician',
      title: 'Clinical Consultation',
      icon: 'stethoscope',
      description: 'Author SOAP notes, review vital histories, and order diagnostic labs.',
    },
    {
      username: 'nurse1',
      fullName: 'Sonia Gharbi',
      roleLabel: 'Clinical Nurse',
      title: 'Triage & Vital Signs',
      icon: 'healing',
      description: 'Record patient vital signs (BP, HR, SpO2, Temp) and clinical triage.',
    },
    {
      username: 'lab1',
      fullName: 'Walid Mansouri',
      roleLabel: 'Pathology Specialist',
      title: 'Diagnostic Laboratory',
      icon: 'biotech',
      description: 'Analyze urgent requisitions, compute reference flags, and validate tests.',
    },
    {
      username: 'pharmacist1',
      fullName: 'Ines Chaabane',
      roleLabel: 'Hospital Pharmacist',
      title: 'Dispensary & Inventory',
      icon: 'medication',
      description: 'Dispense electronic prescriptions and manage medication stock thresholds.',
    },
    {
      username: 'reception1',
      fullName: 'Rim Bouazizi',
      roleLabel: 'Admissions Officer',
      title: 'Reception & Billing',
      icon: 'badge',
      description: 'Admit patients, coordinate doctor schedules, and process itemized invoices.',
    },
    {
      username: 'patient1',
      fullName: 'Youssef Ben Salah',
      roleLabel: 'Outpatient',
      title: 'Patient Self-Service',
      icon: 'person',
      description: 'View scheduled appointments, medical SOAP records, and billing statements.',
    },
  ];

  selectPatient(index: number): void {
    this.activePatientIndex.set(index);
  }

  selectWorkflow(tab: 'consultation' | 'lab' | 'pharmacy' | 'reception' | 'billing'): void {
    this.activeWorkflowTab.set(tab);
  }

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
