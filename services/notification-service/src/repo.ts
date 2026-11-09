import { pool } from './db';

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: unknown;
  read: boolean;
  severity: string;
  created_at: string;
};

export type Filters = {
  read?: boolean;
  type?: string;
  severity?: string;
  q?: string;
  order: 'asc' | 'desc';
};

function buildWhere(f: Filters) {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (f.read !== undefined) { params.push(f.read); conds.push(`read = $${params.length}`); }
  if (f.type) { params.push(f.type); conds.push(`type = $${params.length}`); }
  if (f.severity) { params.push(f.severity); conds.push(`severity = $${params.length}`); }
  if (f.q) {
    params.push(`%${f.q}%`);
    conds.push(`(title ILIKE $${params.length} OR message ILIKE $${params.length})`);
  }
  return { sql: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params };
}

export async function list(page: number, size: number, f: Filters) {
  const w = buildWhere(f);
  const dir = f.order === 'asc' ? 'ASC' : 'DESC';
  const limitIdx = w.params.length + 1;
  const rows = await pool.query(
    `SELECT * FROM notifications ${w.sql} ORDER BY created_at ${dir} LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
    [...w.params, size, page * size]
  );
  const total = await pool.query(`SELECT COUNT(*)::int AS n FROM notifications ${w.sql}`, w.params);
  const totalElements: number = total.rows[0].n;
  return {
    content: rows.rows as Notification[],
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  };
}

export async function findById(id: string) {
  const r = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
  return (r.rows[0] as Notification | undefined) ?? null;
}

export async function create(input: { type: string; title: string; message: string; severity: string; payload?: unknown }) {
  const r = await pool.query(
    `INSERT INTO notifications (type, title, message, severity, payload) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.type, input.title, input.message, input.severity, input.payload ? JSON.stringify(input.payload) : null]
  );
  return r.rows[0] as Notification;
}

export async function setRead(id: string, read: boolean) {
  const r = await pool.query('UPDATE notifications SET read = $2 WHERE id = $1 RETURNING *', [id, read]);
  return (r.rows[0] as Notification | undefined) ?? null;
}

export async function markAllRead() {
  const r = await pool.query('UPDATE notifications SET read = TRUE WHERE read = FALSE');
  return r.rowCount ?? 0;
}

export async function remove(id: string) {
  const r = await pool.query('DELETE FROM notifications WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function removeRead() {
  const r = await pool.query('DELETE FROM notifications WHERE read = TRUE');
  return r.rowCount ?? 0;
}

export async function bulk(action: 'read' | 'unread' | 'delete', ids: string[]) {
  if (action === 'delete') {
    const r = await pool.query('DELETE FROM notifications WHERE id = ANY($1::uuid[])', [ids]);
    return r.rowCount ?? 0;
  }
  const r = await pool.query('UPDATE notifications SET read = $1 WHERE id = ANY($2::uuid[])', [action === 'read', ids]);
  return r.rowCount ?? 0;
}

export async function unreadCount() {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM notifications WHERE read = FALSE');
  return r.rows[0].n as number;
}

export async function stats() {
  const totals = await pool.query(
    'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE NOT read)::int AS unread FROM notifications'
  );
  const byType = await pool.query(
    'SELECT type, COUNT(*)::int AS count FROM notifications GROUP BY type ORDER BY count DESC'
  );
  const bySeverity = await pool.query(
    'SELECT severity, COUNT(*)::int AS count FROM notifications GROUP BY severity'
  );
  const days = await pool.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS date, COALESCE(c.n, 0)::int AS count
     FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
     LEFT JOIN (
       SELECT created_at::date AS day, COUNT(*) AS n
       FROM notifications WHERE created_at >= CURRENT_DATE - 6 GROUP BY 1
     ) c ON c.day = d::date
     ORDER BY d`
  );
  return {
    total: totals.rows[0].total as number,
    unread: totals.rows[0].unread as number,
    byType: byType.rows as { type: string; count: number }[],
    bySeverity: bySeverity.rows as { severity: string; count: number }[],
    last7Days: days.rows as { date: string; count: number }[],
  };
}
