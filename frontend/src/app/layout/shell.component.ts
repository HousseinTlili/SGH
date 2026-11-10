import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { NotificationApi } from '../core/api/notification.api';
import { AuthService } from '../core/auth/auth.service';
import { ServiceStatusService } from '../core/status/service-status.service';
import { ThemeService } from '../core/theme/theme.service';
import { ServiceStatusBarComponent } from '../shared/components/service-status-bar/service-status-bar.component';
import { menuFor } from './menu';

const NARROW = '(max-width: 959px)';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
    ServiceStatusBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly status = inject(ServiceStatusService);
  protected readonly theme = inject(ThemeService);
  protected readonly notificationsApi = inject(NotificationApi);
  protected readonly unreadCount = signal(0);

  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe(NARROW)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly navOpen = signal(false);
  protected readonly items = computed(() => menuFor(this.auth.roles()));
  protected readonly displayName = computed(() => {
    const user = this.auth.user();
    return user?.fullName ?? user?.username ?? '';
  });
  protected readonly primaryRole = computed(() => {
    const roles = this.auth.roles();
    return roles[0] || 'STAFF';
  });
  protected readonly userInitials = computed(() => {
    const name = this.displayName();
    if (!name) return 'SGH';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  });
  protected readonly avatarUrl = computed(() => {
    const username = this.auth.user()?.username;
    if (username && typeof localStorage !== 'undefined') {
      return localStorage.getItem(`sgh.avatar.${username}`);
    }
    return null;
  });

  ngOnInit(): void {
    this.status.start();
    this.refreshUnread();
  }

  protected refreshUnread(): void {
    this.notificationsApi.unreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.unread),
      error: () => this.unreadCount.set(0),
    });
  }

  ngOnDestroy(): void {
    this.status.stop();
  }

  protected closeNavIfNarrow(): void {
    if (this.narrow()) {
      this.navOpen.set(false);
    }
  }
}
