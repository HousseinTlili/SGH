import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { MOCK_USERS } from '../core/auth/mock-users';
import { landingPathFor } from '../core/auth/roles';
import { ThemeService } from '../core/theme/theme.service';

interface PersonaCardMeta {
  readonly title: string;
  readonly department: string;
  readonly icon: string;
}

const PERSONA_DETAILS: Record<string, PersonaCardMeta> = {
  doctor1: {
    title: 'Senior Cardiologist',
    department: 'Cardiology',
    icon: 'stethoscope',
  },
  doctor2: {
    title: 'General Practitioner',
    department: 'Internal Medicine',
    icon: 'medical_services',
  },
  nurse1: {
    title: 'Head Triage Nurse',
    department: 'Emergency & Triage',
    icon: 'healing',
  },
  lab1: {
    title: 'Lead Lab Technologist',
    department: 'Diagnostic Pathology',
    icon: 'biotech',
  },
  pharmacist1: {
    title: 'Chief Pharmacist',
    department: 'Hospital Dispensary',
    icon: 'medication',
  },
  reception1: {
    title: 'Admissions Officer',
    department: 'Front Desk & Billing',
    icon: 'badge',
  },
  admin1: {
    title: 'System Administrator',
    department: 'Hospital Operations',
    icon: 'admin_panel_settings',
  },
  patient1: {
    title: 'Registered Patient',
    department: 'Patient Portal',
    icon: 'person',
  },
};

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly mock = inject(MockAuthBackend);
  protected readonly theme = inject(ThemeService);

  protected readonly mockAuth = inject(MOCK_AUTH_ENABLED);
  protected readonly users = MOCK_USERS;

  protected usernameInput = 'doctor1';
  protected passwordInput = '••••••••••••';
  protected showPassword = signal(false);

  goToWorkspace(): void {
    const target = landingPathFor(this.auth.roles());
    void this.router.navigateByUrl(target);
  }

  signIn(username: string): void {
    this.auth.completeSignIn(this.mock.signIn(username));
    void this.router.navigateByUrl('/');
  }

  onSubmit(event?: Event): void {
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

  getDetails(username: string): PersonaCardMeta {
    return (
      PERSONA_DETAILS[username] ?? {
        title: 'Staff Member',
        department: 'Clinical Care',
        icon: 'person',
      }
    );
  }

  toggleShowPassword(): void {
    this.showPassword.update((val) => !val);
  }
}
