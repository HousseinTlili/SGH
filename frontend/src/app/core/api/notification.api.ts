import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  NotificationFilters,
  NotificationItem,
  NotificationPage,
  NotificationStats,
} from '../models/notification';
import { clampPaging, toHttpParams } from '../../shared/util/paging';

@Injectable({ providedIn: 'root' })
export class NotificationApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/notifications`;

  list(filters?: NotificationFilters, page = 0, size = 20): Observable<NotificationPage> {
    const paging = clampPaging(page, size);
    const params = toHttpParams({
      read: filters?.read === undefined ? undefined : String(filters.read),
      type: filters?.type,
      severity: filters?.severity,
      q: filters?.q,
      order: filters?.order ?? 'desc',
      page: paging.page,
      size: paging.size,
    });
    return this.http.get<NotificationPage>(this.base, { params });
  }

  get(id: string): Observable<NotificationItem> {
    return this.http.get<NotificationItem>(`${this.base}/${id}`);
  }

  unreadCount(): Observable<{ unread: number }> {
    return this.http.get<{ unread: number }>(`${this.base}/unread-count`);
  }

  stats(): Observable<NotificationStats> {
    return this.http.get<NotificationStats>(`${this.base}/stats`);
  }

  markAsRead(id: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(`${this.base}/${id}/read`, {});
  }

  markAsUnread(id: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(`${this.base}/${id}/unread`, {});
  }

  markAllAsRead(): Observable<{ updated: number }> {
    return this.http.patch<{ updated: number }>(`${this.base}/read-all`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  deleteRead(): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${this.base}/read`);
  }

  bulk(action: 'read' | 'unread' | 'delete', ids: string[]): Observable<{ affected: number }> {
    return this.http.post<{ affected: number }>(`${this.base}/bulk`, { action, ids });
  }
}
