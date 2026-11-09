import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationApi } from '../../../core/api/notification.api';
import type {
  NotificationFilters,
  NotificationItem,
  NotificationSeverity,
  NotificationStats,
} from '../../../core/models/notification';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

export type FilterTab = 'ALL' | 'UNREAD' | 'CRITICAL' | 'WARNING' | 'INFO';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.scss',
})
export class NotificationListComponent implements OnInit {
  private readonly api = inject(NotificationApi);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly activeTab = signal<FilterTab>('ALL');
  readonly notifications = signal<NotificationItem[]>([]);
  readonly stats = signal<NotificationStats | null>(null);
  readonly loading = signal(false);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly expandedPayloadId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStats();
    this.loadNotifications();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(0);
        this.loadNotifications();
      });
  }

  setTab(tab: FilterTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.page.set(0);
    this.loadNotifications();
  }

  loadStats(): void {
    this.api.stats().subscribe({
      next: (data) => this.stats.set(data),
      error: () => {},
    });
  }

  loadNotifications(): void {
    this.loading.set(true);
    const tab = this.activeTab();
    const query = this.searchControl.value.trim();

    const filters: NotificationFilters = {
      q: query || undefined,
      order: 'desc',
    };

    if (tab === 'UNREAD') {
      filters.read = false;
    } else if (tab === 'CRITICAL' || tab === 'WARNING' || tab === 'INFO') {
      filters.severity = tab as NotificationSeverity;
    }

    this.api.list(filters, this.page(), this.size()).subscribe({
      next: (res) => {
        this.notifications.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  toggleRead(item: NotificationItem): void {
    const action$ = item.read
      ? this.api.markAsUnread(item.id)
      : this.api.markAsRead(item.id);

    action$.subscribe({
      next: (updated) => {
        this.notifications.update((list) =>
          list.map((n) => (n.id === updated.id ? updated : n))
        );
        this.loadStats();
      },
    });
  }

  markAllAsRead(): void {
    this.loading.set(true);
    this.api.markAllAsRead().subscribe({
      next: () => {
        this.loadNotifications();
        this.loadStats();
      },
      error: () => this.loading.set(false),
    });
  }

  deleteNotification(item: NotificationItem, event: Event): void {
    event.stopPropagation();
    this.api.delete(item.id).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((n) => n.id !== item.id));
        this.totalElements.update((cnt) => Math.max(0, cnt - 1));
        this.loadStats();
      },
    });
  }

  deleteRead(): void {
    this.loading.set(true);
    this.api.deleteRead().subscribe({
      next: () => {
        this.loadNotifications();
        this.loadStats();
      },
      error: () => this.loading.set(false),
    });
  }

  togglePayload(id: string): void {
    this.expandedPayloadId.update((curr) => (curr === id ? null : id));
  }

  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((p) => p - 1);
      this.loadNotifications();
    }
  }

  nextPage(): void {
    if (this.page() + 1 < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadNotifications();
    }
  }

  formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getSeverityIcon(severity: NotificationSeverity): string {
    switch (severity) {
      case 'CRITICAL':
        return 'warning';
      case 'WARNING':
        return 'error_outline';
      case 'INFO':
      default:
        return 'info_outline';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'appointment.created':
        return 'New Booking';
      case 'appointment.cancelled':
        return 'Cancellation';
      case 'system.alert':
        return 'System Alert';
      default:
        return type;
    }
  }
}
