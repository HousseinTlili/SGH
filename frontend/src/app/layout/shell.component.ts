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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
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

  ngOnInit(): void {
    this.status.start();
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
