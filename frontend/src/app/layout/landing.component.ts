import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly mockAuth = inject(MOCK_AUTH_ENABLED);

  // Active chart preview
  protected readonly activePatientIndex = signal(0);
  protected readonly activeWorkflowTab = signal<
    'consultation' | 'lab' | 'pharmacy' | 'reception' | 'billing'
  >('consultation');

  // Scroll animations & telemetry signals
  readonly scrollPercent = signal(0);
  readonly activeSection = signal('OVERVIEW // CLINICAL CARE');
  readonly showScrollHud = signal(false);

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

  constructor() {
    afterNextRender(() => {
      this.initScrollAnimations();
    });
  }

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
      hr: 72,
      hrStatus: 'NORMAL',
      spo2: 98,
      temp: '37.1',
      tempStatus: 'NORMAL',
      labOrder: 'ORDER #f9f9f9f9',
      analyzer: 'Roche Cobas 6000',
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
          name: 'White Blood Cells',
          value: '8.4',
          unit: '× 10^9/L',
          range: '4.0 - 11.0',
          flag: 'NORMAL',
        },
      ],
      rxItems: [
        {
          name: 'Paracetamol 500mg',
          dosage: '1 tab orally',
          frequency: 'Every 8h as needed',
          duration: '5 days',
        },
        {
          name: 'Metformin 850mg',
          dosage: '1 tab orally with meals',
          frequency: 'Twice daily',
          duration: '30 days',
        },
      ],
    },
    {
      id: 'p2',
      name: 'Amel Ben Salah',
      initials: 'AB',
      mrn: 'MRN-2026-0312',
      ageGender: '35F',
      dob: '22/11/1990 (35y)',
      bloodType: 'A+',
      allergies: 'Penicillin (Severe anaphylaxis)',
      room: 'Cardiology Clinic • Room 102',
      vitalsTime: 'Recorded 5 mins ago by Nurse Leila',
      bp: '138/88',
      bpStatus: 'ELEVATED',
      hr: 88,
      hrStatus: 'NORMAL',
      spo2: 99,
      temp: '36.8',
      tempStatus: 'NORMAL',
      labOrder: 'ORDER #a1b2c3d4',
      analyzer: 'Sysmex XN-1000',
      labTests: [
        {
          code: 'CHOL',
          name: 'Total Cholesterol',
          value: '224.0',
          unit: 'mg/dL',
          range: '< 200.0',
          flag: 'HIGH',
        },
        {
          code: 'K+',
          name: 'Potassium Serum',
          value: '4.2',
          unit: 'mmol/L',
          range: '3.5 - 5.0',
          flag: 'NORMAL',
        },
        {
          code: 'CRP',
          name: 'C-Reactive Protein',
          value: '1.2',
          unit: 'mg/L',
          range: '< 5.0',
          flag: 'NORMAL',
        },
      ],
      rxItems: [
        {
          name: 'Atorvastatin 20mg',
          dosage: '1 tab orally at bedtime',
          frequency: 'Once daily',
          duration: '90 days',
        },
        {
          name: 'Amlodipine 5mg',
          dosage: '1 tab orally in the morning',
          frequency: 'Once daily',
          duration: '30 days',
        },
      ],
    },
    {
      id: 'p3',
      name: 'Mohamed Cherif',
      initials: 'MC',
      mrn: 'MRN-2026-1104',
      ageGender: '58M',
      dob: '03/09/1967 (58y)',
      bloodType: 'B+',
      allergies: 'No Known Drug Allergies (NKDA)',
      room: 'Pulmonology • Room 208',
      vitalsTime: 'Recorded 22 mins ago by Nurse Sonia',
      bp: '125/82',
      bpStatus: 'NORMAL',
      hr: 76,
      hrStatus: 'NORMAL',
      spo2: 95,
      temp: '38.4',
      tempStatus: 'FEBRILE',
      labOrder: 'ORDER #e8f9a0b1',
      analyzer: 'bioMérieux Vitek 2',
      labTests: [
        {
          code: 'WBC',
          name: 'White Blood Cells',
          value: '14.8',
          unit: '× 10^9/L',
          range: '4.0 - 11.0',
          flag: 'HIGH',
        },
        {
          code: 'CRP',
          name: 'C-Reactive Protein',
          value: '48.0',
          unit: 'mg/L',
          range: '< 5.0',
          flag: 'HIGH',
        },
        {
          code: 'SpO2',
          name: 'Blood Gas pO2',
          value: '72.0',
          unit: 'mmHg',
          range: '75.0 - 100.0',
          flag: 'LOW',
        },
      ],
      rxItems: [
        {
          name: 'Azithromycin 500mg',
          dosage: '1 tab orally',
          frequency: 'Once daily',
          duration: '3 days',
        },
        {
          name: 'Salbutamol Inhaler 100mcg',
          dosage: '2 puffs via spacer',
          frequency: 'Every 6h as needed',
          duration: '10 days',
        },
      ],
    },
  ];

  protected readonly activePatient = computed(() => {
    return this.patientCharts[this.activePatientIndex()] ?? this.patientCharts[0];
  });

  protected readonly quickPersonas: readonly PersonaQuickLaunch[] = [
    {
      username: 'doctor1',
      fullName: 'Dr. Amel Trabelsi',
      roleLabel: 'Cardiologist',
      title: 'Physician Workstation',
      icon: 'stethoscope',
      description: 'Sign clinical SOAP notes, prescribe medications, and order diagnostic labs.',
    },
    {
      username: 'nurse1',
      fullName: 'Sonia Mabrouk',
      roleLabel: 'Triage Nurse',
      title: 'Triage Desk',
      icon: 'monitor_heart',
      description: 'Record vitals (BP, HR, SpO2, Temp), triage queues, and prepare patients.',
    },
    {
      username: 'pharmacist1',
      fullName: 'Dr. Tarek Jaziri',
      roleLabel: 'Chief Pharmacist',
      title: 'Hospital Dispensary',
      icon: 'medication',
      description: 'Review e-prescriptions, execute atomic dispensations, and monitor drug stock.',
    },
    {
      username: 'tech1',
      fullName: 'Ines Ben Amor',
      roleLabel: 'Senior Lab Technician',
      title: 'Diagnostic Pathology',
      icon: 'biotech',
      description: 'Validate analyzer test samples, compute biological flags, and report findings.',
    },
    {
      username: 'biller1',
      fullName: 'Moncef Gharbi',
      roleLabel: 'Hospital Cashier',
      title: 'Billing Counter',
      icon: 'receipt_long',
      description: 'Generate itemized statements, settle cash payments, and confirm invoices.',
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

  scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private initScrollAnimations(): void {
    if (typeof window === 'undefined') return;

    const hostEl = this.elementRef.nativeElement as HTMLElement;
    const revealElements = hostEl.querySelectorAll<HTMLElement>('.scroll-reveal');

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-inview');
            }
          }
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
      );

      revealElements.forEach((el) => observer.observe(el));
      this.destroyRef.onDestroy(() => observer.disconnect());
    } else {
      revealElements.forEach((el) => el.classList.add('is-inview'));
    }

    const trackedSections = [
      { id: 'hero-title', label: 'OVERVIEW // CLINICAL CARE' },
      { id: 'workflows', label: 'DEPARTMENTS // 5 CARE TEAMS' },
      { id: 'portal', label: 'PATIENTS // DIGITAL HEALTH' },
      { id: 'gateways', label: 'GATEWAYS // 7 ROLE WORKSPACES' },
      { id: 'telemetry', label: 'TELEMETRY // 6/6 SERVICES' },
    ];

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct =
        docHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100))) : 0;
      this.scrollPercent.set(pct);
      this.showScrollHud.set(scrollTop > 160);

      for (const sec of trackedSections) {
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 280) {
            this.activeSection.set(sec.label);
          }
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
  }
}
