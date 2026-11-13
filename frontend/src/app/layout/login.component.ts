import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { MOCK_USERS } from '../core/auth/mock-users';
import { landingPathFor } from '../core/auth/roles';
import type { Role } from '../core/models/common';
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
  private readonly route = inject(ActivatedRoute);
  private readonly mock = inject(MockAuthBackend);
  protected readonly theme = inject(ThemeService);

  protected readonly mockAuth = inject(MOCK_AUTH_ENABLED);
  protected readonly users = MOCK_USERS;

  protected usernameInput = 'doctor1';
  protected passwordInput = 'Sgh@dev2026';
  protected showPassword = signal(false);
  protected roleMenuOpen = signal(false);
  protected loading = signal(false);
  protected errorMessage = signal<string | null>(null);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.roleMenuOpen()) {
      this.closeRoleMenu();
    }
  }

  toggleRoleMenu(): void {
    this.roleMenuOpen.update((open) => !open);
  }

  closeRoleMenu(): void {
    this.roleMenuOpen.set(false);
  }

  async selectRole(username: string): Promise<void> {
    this.closeRoleMenu();
    this.usernameInput = username;
    this.passwordInput = 'Sgh@dev2026';
    await this.onSubmit();
  }

  /** Keycloak redirect fallback if user explicitly requests it. */
  signInWithKeycloak(): void {
    this.auth.login();
  }

  goToWorkspace(): void {
    void this.router.navigateByUrl(this.postLoginTarget(this.auth.roles()));
  }

  signIn(username: string): void {
    this.auth.completeSignIn(this.mock.signIn(username));
    void this.router.navigateByUrl(this.postLoginTarget(this.auth.roles()));
  }

  async onSubmit(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
    }
    const cleanUsername = this.usernameInput.trim();
    if (!cleanUsername) {
      this.errorMessage.set('Please enter a username or patient ID.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      if (this.mockAuth) {
        this.signIn(cleanUsername);
      } else {
        const user = await this.auth.loginWithCredentials(
          cleanUsername,
          this.passwordInput.trim() || 'Sgh@dev2026',
        );
        void this.router.navigateByUrl(this.postLoginTarget(user.roles));
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please verify your username and password.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /** Prefer the opaque passport deep-link (or any safe in-app URL) over the role landing page. */
  private postLoginTarget(roles: readonly Role[]): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login')) {
      return raw;
    }
    return landingPathFor(roles);
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
