import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';

// Mock DB module
vi.mock('../src/db', () => ({
  pool: {
    query: vi.fn(),
  },
  isDbReady: vi.fn(() => true),
  initDb: vi.fn(),
}));

import * as repo from '../src/repo';
import { isDbReady } from '../src/db';

describe('Notification Service API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDbReady).mockReturnValue(true);
  });

  describe('GET /health', () => {
    it('returns status UP without authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'UP' });
    });
  });

  describe('GET /api/notifications', () => {
    it('returns paginated notifications', async () => {
      const mockResult = {
        content: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            type: 'appointment.created',
            title: 'New Appointment',
            message: 'Appointment scheduled for patient Karim',
            read: false,
            severity: 'INFO',
            created_at: new Date().toISOString(),
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      };

      vi.spyOn(repo, 'list').mockResolvedValue(mockResult as any);

      const res = await request(app).get('/api/notifications?page=0&size=20');
      expect(res.status).toBe(200);
      expect(res.body.content).toHaveLength(1);
      expect(res.body.totalElements).toBe(1);
    });

    it('rejects invalid severity query param', async () => {
      const res = await request(app).get('/api/notifications?severity=INVALID');
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('returns unread count', async () => {
      vi.spyOn(repo, 'unreadCount').mockResolvedValue(5);

      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ unread: 5 });
    });
  });

  describe('POST /api/notifications', () => {
    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .send({ title: 'Missing type and message' });

      expect(res.status).toBe(422);
      expect(res.body.details).toBeDefined();
    });

    it('creates notification with valid body', async () => {
      const createdItem = {
        id: '22222222-2222-2222-2222-222222222222',
        type: 'system.alert',
        title: 'System Alert',
        message: 'Maintenance at 22:00',
        severity: 'WARNING',
        read: false,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(repo, 'create').mockResolvedValue(createdItem as any);

      const res = await request(app)
        .post('/api/notifications')
        .send({
          type: 'system.alert',
          title: 'System Alert',
          message: 'Maintenance at 22:00',
          severity: 'WARNING',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(createdItem.id);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('returns 404 when notification does not exist', async () => {
      vi.spyOn(repo, 'setRead').mockResolvedValue(null);
      const testId = randomUUID();

      const res = await request(app).patch(`/api/notifications/${testId}/read`);
      expect(res.status).toBe(404);
    });

    it('returns updated notification when found', async () => {
      const testId = randomUUID();
      const item = {
        id: testId,
        type: 'system.alert',
        title: 'Alert',
        message: 'Info',
        severity: 'INFO',
        read: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(repo, 'setRead').mockResolvedValue(item as any);

      const res = await request(app).patch(`/api/notifications/${testId}/read`);
      expect(res.status).toBe(200);
      expect(res.body.read).toBe(true);
    });
  });

  describe('503 Service Unavailable when DB is down', () => {
    it('returns 503 if DB is not ready', async () => {
      vi.mocked(isDbReady).mockReturnValue(false);

      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(503);
      expect(res.body.message).toBe('Database unavailable');
    });
  });
});
