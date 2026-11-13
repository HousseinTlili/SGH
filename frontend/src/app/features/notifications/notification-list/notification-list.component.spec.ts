import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideFakeAuth } from '../../../../testing/auth';
import { NotificationApi } from '../../../core/api/notification.api';
import type {
  NotificationItem,
  NotificationPage,
  NotificationStats,
} from '../../../core/models/notification';
import { NotificationListComponent } from './notification-list.component';

const mockItem: NotificationItem = {
  id: '11111111-2222-4333-8444-555555555555',
  type: 'appointment.created',
  title: 'New Appointment Booked',
  message: 'Appointment booked for patient Karim Trabelsi',
  payload: { patientName: 'Karim Trabelsi', doctor: 'Dr Alice Martin' },
  read: false,
  severity: 'INFO',
  created_at: new Date().toISOString(),
};

const mockPage: NotificationPage = {
  content: [mockItem],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

const mockStats: NotificationStats = {
  total: 10,
  unread: 4,
  byType: [
    { type: 'appointment.created', count: 8 },
    { type: 'appointment.cancelled', count: 2 },
  ],
  bySeverity: [
    { severity: 'INFO', count: 8 },
    { severity: 'WARNING', count: 2 },
  ],
  last7Days: [{ date: '2026-11-09', count: 5 }],
};

describe('NotificationListComponent', () => {
  let apiSpy: {
    list: ReturnType<typeof vi.fn>;
    stats: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
    markAsUnread: ReturnType<typeof vi.fn>;
    markAllAsRead: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteRead: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiSpy = {
      list: vi.fn().mockReturnValue(of(mockPage)),
      stats: vi.fn().mockReturnValue(of(mockStats)),
      markAsRead: vi.fn().mockReturnValue(of({ ...mockItem, read: true })),
      markAsUnread: vi.fn().mockReturnValue(of({ ...mockItem, read: false })),
      markAllAsRead: vi.fn().mockReturnValue(of({ updated: 4 })),
      delete: vi.fn().mockReturnValue(of(undefined)),
      deleteRead: vi.fn().mockReturnValue(of({ deleted: 6 })),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationListComponent],
      providers: [
        provideFakeAuth(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationApi, useValue: apiSpy },
      ],
    }).compileComponents();
  });

  it('loads notifications and stats on init', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();

    expect(apiSpy.stats).toHaveBeenCalled();
    expect(apiSpy.list).toHaveBeenCalled();
    expect(fixture.componentInstance.notifications()).toHaveLength(1);
    expect(fixture.componentInstance.stats()?.total).toBe(10);
  });

  it('toggles read status', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleRead(mockItem);
    expect(apiSpy.markAsRead).toHaveBeenCalledWith(mockItem.id);
  });

  it('toggles payload detail accordion', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.expandedPayloadId()).toBeNull();
    fixture.componentInstance.togglePayload(mockItem.id);
    expect(fixture.componentInstance.expandedPayloadId()).toBe(mockItem.id);
    fixture.componentInstance.togglePayload(mockItem.id);
    expect(fixture.componentInstance.expandedPayloadId()).toBeNull();
  });

  it('filters notifications by tab', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();

    fixture.componentInstance.setTab('UNREAD');
    expect(fixture.componentInstance.activeTab()).toBe('UNREAD');
    expect(apiSpy.list).toHaveBeenCalledWith(expect.objectContaining({ read: false }), 0, 20);
  });
});
