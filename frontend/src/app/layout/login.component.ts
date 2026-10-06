import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MOCK_AUTH_ENABLED, MockAuthBackend } from '../core/auth/mock-auth.backend';
import { MOCK_USERS } from '../core/auth/mock-users';
import { ThemeService } from '../core/theme/theme.service';

/**
 * Mock mode: pick one of the eight seeded users and see exactly that role's menu and landing page.
 * Real mode: Keycloak sign-in is not wired yet, so this page only explains how to run the mock.
 */
@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatIconModule],
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

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/');
    }
  }

  signIn(username: string): void {
    this.auth.completeSignIn(this.mock.signIn(username));
    void this.router.navigateByUrl('/');
  }
}
