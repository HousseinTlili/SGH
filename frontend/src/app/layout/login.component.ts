import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { MOCK_USERS } from '../core/auth/mock-users';
import { ThemeService } from '../core/theme/theme.service';

interface PersonaMetadata {
  readonly title: string;
  readonly department: string;
  readonly icon: string;
  readonly category: 'PATIENT' | 'DOCTOR' | 'NURSING' | 'DIAGNOSTICS' | 'ADMIN';
}

const PERSONA_META: Record<string, PersonaMetadata> = {
  doctor1: {
    title: 'Senior Cardiologist',
    department: 'Cardiology Dept',
    icon: 'stethoscope',
    category: 'DOCTOR',
  },
  doctor2: {
    title: 'General Practitioner',
    department: 'Internal Medicine',
    icon: 'medical_services',
    category: 'DOCTOR',
  },
  nurse1: {
    title: 'Head Triage Nurse',
    department: 'Emergency & Triage',
    icon: 'healing',
    category: 'NURSING',
  },
  lab1: {
    title: 'Senior Lab Technologist',
    department: 'Pathology & Lab',
    icon: 'biotech',
    category: 'DIAGNOSTICS',
  },
  pharmacist1: {
    title: 'Lead Pharmacist',
    department: 'Hospital Dispensary',
    icon: 'medication',
    category: 'DIAGNOSTICS',
  },
  reception1: {
    title: 'Admissions Officer',
    department: 'Patient Reception',
    icon: 'badge',
    category: 'ADMIN',
  },
  admin1: {
    title: 'System Administrator',
    department: 'Hospital Operations',
    icon: 'admin_panel_settings',
    category: 'ADMIN',
  },
  patient1: {
    title: 'Registered Patient',
    department: 'Patient Portal',
    icon: 'person',
    category: 'PATIENT',
  },
};

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly mock = inject(MockAuthBackend);
  protected readonly theme = inject(ThemeService);

  protected readonly mockAuth = inject(MOCK_AUTH_ENABLED);
  protected readonly users = MOCK_USERS;

  // Sign-in credentials input
  protected usernameInput = 'doctor1';
  protected passwordInput = '••••••••••••';
  protected showPassword = signal(false);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/');
    }
  }

  signIn(username: string): void {
    this.auth.completeSignIn(this.mock.signIn(username));
    void this.router.navigateByUrl('/');
  }

  onSubmitForm(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const clean = this.usernameInput.trim();
    if (!clean) {
      this.signIn('patient1');
      return;
    }
    const match = this.users.find((u) => u.username.toLowerCase() === clean.toLowerCase());
    this.signIn(match ? match.username : clean);
  }

  getMeta(username: string): PersonaMetadata {
    return (
      PERSONA_META[username] ?? {
        title: 'Hospital Staff',
        department: 'Clinical Care',
        icon: 'person',
        category: 'ADMIN',
      }
    );
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }
}
