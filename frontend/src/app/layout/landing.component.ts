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
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { landingPathFor } from '../core/auth/roles';
import { ServiceStatusService } from '../core/status/service-status.service';
import { ThemeService } from '../core/theme/theme.service';

export interface PatientLabItem {
  readonly test: string;
  readonly value: string;
  readonly ref: string;
  readonly flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';
  readonly pct: number;
  readonly barColor: string;
  readonly flagClass: string;
}

export interface PatientRxItem {
  readonly drug: string;
  readonly sig: string;
  readonly stock: string;
}

export interface HeroPatient {
  readonly id: string;
  readonly initials: string;
  readonly name: string;
  readonly mrn: string;
  readonly meta: string;
  readonly ward: string;
  readonly vitalsTime: string;
  readonly bp: string;
  readonly bpStatus: string;
  readonly bpColor: string;
  readonly hr: string;
  readonly hrStatus: string;
  readonly hrColor: string;
  readonly spo2: string;
  readonly temp: string;
  readonly tempStatus: string;
  readonly tempColor: string;
  readonly labs: readonly PatientLabItem[];
  readonly rx: readonly PatientRxItem[];
}

export interface CareEventLog {
  readonly time: string;
  readonly topic: string;
  readonly detail: string;
  readonly target: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
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

  // Active view signals
  readonly activePatientIndex = signal(0);
  readonly activeDepartmentIndex = signal(0);
  readonly activePortalTab = signal<'appointments' | 'consultations' | 'invoices'>('appointments');
  readonly invoicePaid = signal(false);

  // Scroll & telemetry signals
  readonly scrollPercent = signal(0);
  readonly activeSection = signal('OVERVIEW // CLINICAL CARE');
  readonly activeNavId = signal('hero-section');
  readonly showScrollHud = signal(false);

  // Auth Modal & Toast signals
  readonly authModalOpen = signal(false);
  readonly authModalMode = signal<'staff' | 'patient'>('staff');
  readonly modalSelectedRole = signal('Attending Physician (Consultations)');
  readonly modalIdValue = signal('dr.khelifi@sgh-hospital.org');
  readonly modalFeedback = signal<string | null>(null);

  readonly toastVisible = signal(false);
  readonly toastTitle = signal('');
  readonly toastBody = signal('');
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  // Live heart rate micro-fluctuation jitter
  readonly liveJitterHr = signal<string | null>(null);

  // Live AMQP care journey event feed
  readonly amqpLog = signal<readonly CareEventLog[]>([
    {
      time: '19:04:12',
      topic: 'New Prescription Sent',
      detail: 'Amoxicillin 500mg × 21',
      target: 'Hospital Pharmacy',
    },
    {
      time: '19:04:18',
      topic: 'Lab Alert Flagged',
      detail: 'HIGH: Glucose 115 mg/dL',
      target: 'Attending Physician',
    },
    {
      time: '19:04:25',
      topic: 'Medication Dispensed',
      detail: 'Ready for Counter Pickup',
      target: 'Patient Billing',
    },
  ]);

  readonly allServicesUp = computed(() => {
    return (
      this.status.isUp('patient') &&
      this.status.isUp('reception') &&
      this.status.isUp('consultation') &&
      this.status.isUp('lab') &&
      this.status.isUp('pharmacy') &&
      this.status.isUp('staff')
    );
  });

  readonly heroPatients: readonly HeroPatient[] = [
    {
      id: 'p1',
      initials: 'YM',
      name: 'Youssef Mansouri',
      mrn: 'MRN-2026-0849',
      meta: 'DOB: 14/05/1984 (42y) • Blood: O+ • Allergies: Sulfonamides (Moderate)',
      ward: 'Internal Medicine • Room 304B',
      vitalsTime: 'Recorded 14 mins ago by Nurse S. Haddad',
      bp: '120/80',
      bpStatus: 'NORMAL',
      bpColor: 'emerald',
      hr: '76',
      hrStatus: 'NORMAL',
      hrColor: 'emerald',
      spo2: '98.4',
      temp: '37.8',
      tempStatus: 'LOW-GRADE',
      tempColor: 'amber',
      labs: [
        {
          test: 'Fasting Blood Glucose',
          value: '115 mg/dL',
          ref: '70–99 mg/dL',
          flag: 'HIGH',
          pct: 78,
          barColor: 'bg-amber-500',
          flagClass:
            'bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        },
        {
          test: 'White Blood Cell (WBC)',
          value: '11.8 ×10³/µL',
          ref: '4.5–11.0',
          flag: 'HIGH',
          pct: 74,
          barColor: 'bg-amber-500',
          flagClass:
            'bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        },
        {
          test: 'Serum Creatinine',
          value: '0.92 mg/dL',
          ref: '0.70–1.25',
          flag: 'NORMAL',
          pct: 48,
          barColor: 'bg-emerald-500',
          flagClass:
            'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        },
        {
          test: 'Hemoglobin (Hb)',
          value: '14.2 g/dL',
          ref: '13.5–17.5',
          flag: 'NORMAL',
          pct: 55,
          barColor: 'bg-emerald-500',
          flagClass:
            'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        },
      ],
      rx: [
        {
          drug: 'Amoxicillin / Clavulanate 500mg',
          sig: '1 tab PO q8h × 7 days',
          stock: 'Dispensed (21 tabs) • Lot #AX-294',
        },
        {
          drug: 'Paracetamol 1000mg',
          sig: '1 tab PO q6h PRN fever > 38.0°C',
          stock: 'In Stock (1,420 units)',
        },
      ],
    },
    {
      id: 'p2',
      initials: 'AB',
      name: 'Amina Ben Salah',
      mrn: 'MRN-2026-1192',
      meta: 'DOB: 03/11/1968 (58y) • Blood: A- • Allergies: Penicillin (Severe Anaphylaxis)',
      ward: 'Cardiology Monitoring • Bed 112A',
      vitalsTime: 'Recorded 6 mins ago by Nurse M. Gharbi',
      bp: '148/92',
      bpStatus: 'ELEVATED',
      bpColor: 'amber',
      hr: '88',
      hrStatus: 'NORMAL',
      hrColor: 'emerald',
      spo2: '96.9',
      temp: '36.7',
      tempStatus: 'NORMAL',
      tempColor: 'emerald',
      labs: [
        {
          test: 'Serum Potassium (K+)',
          value: '5.8 mmol/L',
          ref: '3.5–5.1 mmol/L',
          flag: 'CRITICAL',
          pct: 94,
          barColor: 'bg-rose-500',
          flagClass:
            'bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        },
        {
          test: 'Troponin-I (High Sens)',
          value: '11 ng/L',
          ref: '< 14 ng/L',
          flag: 'NORMAL',
          pct: 52,
          barColor: 'bg-emerald-500',
          flagClass:
            'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        },
        {
          test: 'Blood Glucose (Random)',
          value: '104 mg/dL',
          ref: '70–140 mg/dL',
          flag: 'NORMAL',
          pct: 50,
          barColor: 'bg-emerald-500',
          flagClass:
            'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        },
        {
          test: 'Serum Sodium (Na+)',
          value: '133 mmol/L',
          ref: '135–145 mmol/L',
          flag: 'LOW',
          pct: 22,
          barColor: 'bg-sky-500',
          flagClass:
            'bg-sky-100 dark:bg-sky-950/90 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
        },
      ],
      rx: [
        {
          drug: 'Amlodipine Besylate 10mg',
          sig: '1 tab PO once daily',
          stock: 'Dispensed • Lot #CV-881',
        },
        {
          drug: 'Atorvastatin 20mg',
          sig: '1 tab PO qHS',
          stock: 'In Stock (890 units)',
        },
      ],
    },
    {
      id: 'p3',
      initials: 'KT',
      name: 'Karim Trabelsi',
      mrn: 'MRN-2026-1405',
      meta: 'DOB: 22/08/1997 (29y) • Blood: B+ • Allergies: NKDA (No Known Allergies)',
      ward: 'Outpatient Clinic • Consultation 02',
      vitalsTime: 'Recorded 21 mins ago by Nurse S. Haddad',
      bp: '118/76',
      bpStatus: 'OPTIMAL',
      bpColor: 'emerald',
      hr: '64',
      hrStatus: 'NORMAL',
      hrColor: 'emerald',
      spo2: '99.2',
      temp: '36.6',
      tempStatus: 'NORMAL',
      tempColor: 'emerald',
      labs: [
        {
          test: 'Serum Ferritin',
          value: '18 ng/mL',
          ref: '30–400 ng/mL',
          flag: 'LOW',
          pct: 18,
          barColor: 'bg-sky-500',
          flagClass:
            'bg-sky-100 dark:bg-sky-950/90 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
        },
        {
          test: 'Fasting Blood Glucose',
          value: '89 mg/dL',
          ref: '70–99 mg/dL',
          flag: 'NORMAL',
          pct: 46,
          barColor: 'bg-emerald-500',
          flagClass:
            'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        },
        {
          test: 'TSH (Ultrasensitive)',
          value: '2.14 mIU/L',
          ref: '0.40–4.50',
          flag: 'NORMAL',
          pct: 50,
          barColor: 'bg-emerald-500',
          flagClass:
            'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        },
      ],
      rx: [
        {
          drug: 'Ferrous Sulfate 325mg (65mg Elem)',
          sig: '1 tab PO daily with Ascorbic Acid',
          stock: 'Ready for Pickup • Counter #2',
        },
      ],
    },
  ];

  readonly activePatient = computed(() => {
    return this.heroPatients[this.activePatientIndex()] ?? this.heroPatients[0];
  });

  constructor() {
    afterNextRender(() => {
      this.initEcgCanvas();
      this.init3DTilt();
      this.initScrollChoreography();
      this.initVitalsJitter();
    });
  }

  switchHeroPatient(index: number): void {
    this.activePatientIndex.set(index);
    this.liveJitterHr.set(null);
  }

  selectDepartment(index: number): void {
    this.activeDepartmentIndex.set(index);
  }

  switchPatientPortalTab(tab: 'appointments' | 'consultations' | 'invoices'): void {
    this.activePortalTab.set(tab);
  }

  paySimulatedInvoice(): void {
    this.invoicePaid.set(true);
    this.showToast(
      'Invoice #INV-2026-9042 Paid',
      'Your payment of $121.50 has been confirmed and receipt #RCP-88412 is ready.',
    );
  }

  simulateRabbitMQFlow(): void {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const sampleEvents = [
      {
        topic: 'Consultation Completed',
        target: 'Laboratory Team',
        detail: 'Blood Panel Ordered',
      },
      {
        topic: 'Lab Result Validated',
        target: 'Attending Physician',
        detail: 'HIGH: Blood Glucose 115 mg/dL',
      },
      {
        topic: 'Medication Prepared',
        target: 'Pharmacy Counter #2',
        detail: 'Amoxicillin 500mg (21 tabs)',
      },
      {
        topic: 'Statement Updated',
        target: 'Patient Portal',
        detail: 'Receipt #INV-2026-9042 ($121.50)',
      },
    ];
    const picked = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];

    this.amqpLog.update((logs) => [
      {
        time: timeStr,
        topic: picked.topic,
        detail: picked.detail,
        target: picked.target,
      },
      ...logs.slice(0, 5),
    ]);

    this.showToast('Care Update Shared', `${picked.topic}: ${picked.detail} sent to ${picked.target}.`);
  }

  triggerRxVerifyToast(): void {
    this.showToast(
      'Medication Handover Confirmed',
      '21 tablets of Amoxicillin 500mg dispensed to patient and added to visit statement.',
    );
  }

  openAuthModal(mode: 'staff' | 'patient', preselectedDept?: string): void {
    this.authModalMode.set(mode);
    this.modalFeedback.set(null);
    this.authModalOpen.set(true);
    if (mode === 'staff') {
      this.modalIdValue.set('dr.khelifi@sgh-hospital.org');
    } else {
      this.modalIdValue.set('youssef.mansouri@patient.sgh.org');
    }
    if (preselectedDept) {
      this.showToast('Department Selected', `Opening sign-in for ${preselectedDept}`);
    }
  }

  closeAuthModal(): void {
    this.authModalOpen.set(false);
  }

  setAuthModalMode(mode: 'staff' | 'patient'): void {
    this.authModalMode.set(mode);
    this.modalFeedback.set(null);
    if (mode === 'staff') {
      this.modalIdValue.set('dr.khelifi@sgh-hospital.org');
    } else {
      this.modalIdValue.set('youssef.mansouri@patient.sgh.org');
    }
  }

  handleSimulatedLogin(e: Event): void {
    e.preventDefault();
    const role = this.modalSelectedRole();
    this.modalFeedback.set(`✓ Welcome! Redirecting to your ${role} workspace...`);
    setTimeout(() => {
      this.closeAuthModal();
      this.quickSignIn(this.authModalMode() === 'patient' ? 'patient1' : 'doctor1');
    }, 900);
  }

  showToast(title: string, body: string): void {
    this.toastTitle.set(title);
    this.toastBody.set(body);
    this.toastVisible.set(true);
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.toastVisible.set(false);
    }, 4200);
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

  // ---------------------------------------------------------------------------
  // Canvas ECG Oscilloscope Implementation
  // ---------------------------------------------------------------------------
  private initEcgCanvas(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.elementRef.nativeElement.querySelector('#ecg-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 220;
    canvas.height = 40;
    const points: number[] = [];

    const getECGOffset = (step: number) => {
      const cycle = step % 55;
      if (cycle === 10) return -3;
      if (cycle === 14) return 4;
      if (cycle === 16) return -15; // R-peak
      if (cycle === 18) return 9; // S-wave
      if (cycle === 26) return -5; // T-wave
      if (cycle === 28) return -4;
      return (Math.random() - 0.5) * 1.2;
    };

    let tick = 0;
    let animId: number;

    const drawECG = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const yMid = canvas.height / 2 + 2;
      points.push(yMid + getECGOffset(tick));
      if (points.length > canvas.width / 2) {
        points.shift();
      }

      ctx.beginPath();
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < points.length; i++) {
        const px = i * 2;
        const py = points[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Glowing lead dot
      if (points.length > 0) {
        const lastX = (points.length - 1) * 2;
        const lastY = points[points.length - 1];
        ctx.beginPath();
        ctx.fillStyle = '#5EEAD4';
        ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      tick++;
      animId = requestAnimationFrame(drawECG);
    };

    drawECG();
    this.destroyRef.onDestroy(() => cancelAnimationFrame(animId));
  }

  // ---------------------------------------------------------------------------
  // 3D Mouse Perspective on Hero Clinical Workstation
  // ---------------------------------------------------------------------------
  private init3DTilt(): void {
    if (typeof window === 'undefined') return;
    const card = this.elementRef.nativeElement.querySelector('#hero-workstation-card') as HTMLElement;
    if (
      !card ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const xRel = (e.clientX - rect.left) / rect.width - 0.5;
      const yRel = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `rotateY(${xRel * 6}deg) rotateX(${-yRel * 6}deg)`;
    };

    const onMouseLeave = () => {
      card.style.transform = 'rotateY(0deg) rotateX(0deg)';
    };

    card.addEventListener('mousemove', onMouseMove);
    card.addEventListener('mouseleave', onMouseLeave);
    this.destroyRef.onDestroy(() => {
      card.removeEventListener('mousemove', onMouseMove);
      card.removeEventListener('mouseleave', onMouseLeave);
    });
  }

  // ---------------------------------------------------------------------------
  // Vitals Micro-fluctuation Loop (3.2s)
  // ---------------------------------------------------------------------------
  private initVitalsJitter(): void {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      const pt = this.activePatient();
      const baseHr = parseInt(pt.hr, 10);
      const delta = Math.floor(Math.random() * 3) - 1;
      this.liveJitterHr.set(String(baseHr + delta));
    }, 3200);

    this.destroyRef.onDestroy(() => clearInterval(interval));
  }

  // ---------------------------------------------------------------------------
  // Scroll Choreography: Reveal Observer, Progress Bar & Active Section Spy
  // ---------------------------------------------------------------------------
  private initScrollChoreography(): void {
    if (typeof window === 'undefined') return;
    const hostEl = this.elementRef.nativeElement as HTMLElement;
    const revealElements = hostEl.querySelectorAll<HTMLElement>('.scroll-reveal');

    // Reveal elements immediately if already inside viewport
    const vh = window.innerHeight;
    revealElements.forEach((el) => {
      if (el.getBoundingClientRect().top < vh * 0.95) {
        el.classList.add('is-inview');
      }
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-inview');
            }
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
      );
      revealElements.forEach((el) => observer.observe(el));
      this.destroyRef.onDestroy(() => observer.disconnect());
    } else {
      revealElements.forEach((el) => el.classList.add('is-inview'));
    }

    const trackedSections = [
      { id: 'hero-section', label: 'OVERVIEW // CLINICAL CARE' },
      { id: 'clinical-workflows', label: 'DEPARTMENTS // 5 CARE TEAMS' },
      { id: 'patient-portal', label: 'PATIENTS // SELF-SERVICE PORTAL' },
      { id: 'system-status', label: 'STATUS // 24/7 AVAILABILITY' },
    ];

    const heroParallaxWrap = hostEl.querySelector('#hero-parallax-wrap') as HTMLElement;

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent =
        docHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100))) : 0;
      this.scrollPercent.set(scrollPercent);
      this.showScrollHud.set(scrollTop > 120);

      if (heroParallaxWrap && scrollTop < 900 && window.innerWidth >= 1024) {
        heroParallaxWrap.style.transform = `translateY(${scrollTop * 0.045}px)`;
      }

      for (const sec of trackedSections) {
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 240) {
            this.activeSection.set(sec.label);
            this.activeNavId.set(sec.id);
          }
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
  }
}
