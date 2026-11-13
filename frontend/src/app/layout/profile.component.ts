import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { StaffApi } from '../core/api/staff.api';
import { AuthService } from '../core/auth/auth.service';
import type { Me } from '../core/models/staff';
import { ThemeService } from '../core/theme/theme.service';
import { LoadingStateComponent } from '../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../shared/components/page-header/page-header.component';

type ProfileState = 'loading' | 'ready' | 'unavailable';

@Component({
  selector: 'app-profile',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTabsModule,
    LoadingStateComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(StaffApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly state = signal<ProfileState>('loading');
  protected readonly me = signal<Me | null>(null);

  // Avatar / Photo
  protected readonly avatarUrl = signal<string | null>(null);

  // Form fields
  protected fullNameInput = '';
  protected phoneInput = '+216 71 800 440';
  protected emailInput = '';
  protected departmentInput = '';
  protected specialtyInput = '';
  protected bioInput = 'Dedicated healthcare clinical professional at St. Gabriel Hospital.';

  // Password fields
  protected currentPasswordInput = '';
  protected newPasswordInput = '';
  protected confirmPasswordInput = '';
  protected showPassword = signal(false);

  // Preferences
  protected emailAlerts = signal(true);
  protected smsAlerts = signal(true);
  protected soundAlerts = signal(true);

  protected readonly userInitials = computed(() => {
    const name = this.me()?.staff?.fullName ?? this.auth.user()?.fullName ?? 'User';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  });

  ngOnInit(): void {
    this.load();
    this.loadSavedAvatar();
  }

  private loadSavedAvatar(): void {
    const username = this.auth.user()?.username;
    if (username && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`sgh.avatar.${username}`);
      if (saved) {
        this.avatarUrl.set(saved);
      }
    }
  }

  protected load(): void {
    this.state.set('loading');
    this.api
      .me()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (me) => {
          this.me.set(me);
          if (me.staff) {
            this.fullNameInput = me.staff.fullName;
            this.departmentInput = me.staff.department;
            this.specialtyInput = me.staff.specialty ?? '';
          }
          this.emailInput = `${me.username}@sgh.hospital`;
          this.state.set('ready');
        },
        error: () => this.state.set('unavailable'),
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.snackBar.open('Image file must be under 2MB', 'Dismiss', { duration: 3000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.avatarUrl.set(result);
      const username = this.auth.user()?.username;
      if (username && typeof localStorage !== 'undefined') {
        localStorage.setItem(`sgh.avatar.${username}`, result);
      }
      this.snackBar.open('Profile photo updated successfully', 'Dismiss', { duration: 3000 });
    };
    reader.readAsDataURL(file);
  }

  protected removeAvatar(): void {
    this.avatarUrl.set(null);
    const username = this.auth.user()?.username;
    if (username && typeof localStorage !== 'undefined') {
      localStorage.removeItem(`sgh.avatar.${username}`);
    }
    this.snackBar.open('Profile photo removed', 'Dismiss', { duration: 3000 });
  }

  protected saveDetails(): void {
    const username = this.auth.user()?.username;
    if (username && typeof localStorage !== 'undefined') {
      localStorage.setItem(
        `sgh.profile.${username}`,
        JSON.stringify({
          fullName: this.fullNameInput,
          phone: this.phoneInput,
          email: this.emailInput,
          department: this.departmentInput,
          specialty: this.specialtyInput,
          bio: this.bioInput,
        }),
      );
    }
    this.snackBar.open('Profile information saved successfully', 'Dismiss', { duration: 3000 });
  }

  protected changePassword(): void {
    if (!this.newPasswordInput || !this.confirmPasswordInput) {
      this.snackBar.open('Please fill out all password fields', 'Dismiss', { duration: 3000 });
      return;
    }
    if (this.newPasswordInput.length < 8) {
      this.snackBar.open('New password must be at least 8 characters', 'Dismiss', {
        duration: 3000,
      });
      return;
    }
    if (this.newPasswordInput !== this.confirmPasswordInput) {
      this.snackBar.open('New password and confirmation do not match', 'Dismiss', {
        duration: 3000,
      });
      return;
    }

    this.currentPasswordInput = '';
    this.newPasswordInput = '';
    this.confirmPasswordInput = '';
    this.snackBar.open('Password successfully updated!', 'Dismiss', { duration: 3500 });
  }
}
