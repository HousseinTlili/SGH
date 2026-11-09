import { Router } from 'express';
import { z } from 'zod';
import * as repo from './repo';
import { HttpError, Detail } from './errors';

export const router = Router();

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details: Detail[] = result.error.issues.map((i) => ({
      field: i.path.join('.') || '(body)',
      problem: i.message,
    }));
    throw new HttpError(422, 'Validation failed', details);
  }
  return result.data;
}

const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;

const idSchema = z.object({ id: z.string().uuid() });

const querySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
  read: z.enum(['true', 'false']).optional(),
  type: z.string().min(1).max(100).optional(),
  severity: z.enum(SEVERITIES).optional(),
  q: z.string().max(100).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const createSchema = z.object({
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  severity: z.enum(SEVERITIES).default('INFO'),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const bulkSchema = z.object({
  action: z.enum(['read', 'unread', 'delete']),
  ids: z.array(z.string().uuid()).min(1).max(100),
});

router.get('/', async (req, res) => {
  const q = parse(querySchema, req.query);
  const filters: repo.Filters = {
    read: q.read === undefined ? undefined : q.read === 'true',
    type: q.type,
    severity: q.severity,
    q: q.q?.trim() || undefined,
    order: q.order,
  };
  res.json(await repo.list(q.page, q.size, filters));
});

router.get('/stats', async (_req, res) => {
  res.json(await repo.stats());
});

router.get('/unread-count', async (_req, res) => {
  res.json({ unread: await repo.unreadCount() });
});

router.patch('/read-all', async (_req, res) => {
  res.json({ updated: await repo.markAllRead() });
});

router.post('/bulk', async (req, res) => {
  const body = parse(bulkSchema, req.body);
  res.json({ affected: await repo.bulk(body.action, body.ids) });
});

router.delete('/read', async (_req, res) => {
  res.json({ deleted: await repo.removeRead() });
});

router.get('/:id', async (req, res) => {
  const { id } = parse(idSchema, req.params);
  const n = await repo.findById(id);
  if (!n) throw new HttpError(404, 'Notification not found');
  res.json(n);
});

router.post('/', async (req, res) => {
  const body = parse(createSchema, req.body);
  res.status(201).json(await repo.create(body));
});

router.patch('/:id/read', async (req, res) => {
  const { id } = parse(idSchema, req.params);
  const n = await repo.setRead(id, true);
  if (!n) throw new HttpError(404, 'Notification not found');
  res.json(n);
});

router.patch('/:id/unread', async (req, res) => {
  const { id } = parse(idSchema, req.params);
  const n = await repo.setRead(id, false);
  if (!n) throw new HttpError(404, 'Notification not found');
  res.json(n);
});

router.delete('/:id', async (req, res) => {
  const { id } = parse(idSchema, req.params);
  const ok = await repo.remove(id);
  if (!ok) throw new HttpError(404, 'Notification not found');
  res.status(204).end();
});
