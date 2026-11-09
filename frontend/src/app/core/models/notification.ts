export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
  read: boolean;
  severity: NotificationSeverity;
  created_at: string;
}

export interface NotificationPage {
  content: NotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  last7Days: { date: string; count: number }[];
}

export interface NotificationFilters {
  read?: boolean;
  type?: string;
  severity?: NotificationSeverity;
  q?: string;
  order?: 'asc' | 'desc';
}
