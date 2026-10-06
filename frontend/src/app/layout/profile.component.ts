import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StaffApi } from '../core/api/staff.api';
import { AuthService } from '../core/auth/auth.service';
import type { Me } from '../core/models/staff';
import { LoadingStateComponent } from '../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../shared/components/page-header/page-header.component';

type ProfileState = 'loading' | 'ready' | 'unavailable';

@Component({
  selector: 'app-profile',
  imports: [MatButtonModule, MatIconModule, LoadingStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(StaffApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly state = signal<ProfileState>('loading');
  protected readonly me = signal<Me | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.api
      .me()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (me) => {
          this.me.set(me);
          this.state.set('ready');
        },
        error: () => this.state.set('unavailable'),
      });
  }
}
