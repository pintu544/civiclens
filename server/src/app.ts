import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  getPool,
  getDbKind,
  type DbKind,
} from './db';
import {
  CATEGORIES,
  STATUSES,
  DEPARTMENTS,
  triageReport,
  aiProviderActive,
  type Category,
  type Status,
} from './triage';
import { computePriorityScore } from './priority';
import { findDuplicate, haversineKm } from './dedup';
import {
  toReportJson,
  toHistoryJson,
  isUuid,
  type ReportRow,
  type HistoryRow,
} from './models';

export interface AppOptions {
  /** Overrides process.env.ADMIN_KEY. If neither is set, an ephemeral key is generated and logged. */
  adminKey?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createReportSchema = z.object({
  title: z.string().min(5, 'title must be at least 5 characters').max(120, 'title must be at most 120 characters'),
  description: z
    .string()
    .min(20, 'description must be at least 20 characters')
    .max(2000, 'description must be at most 2000 characters'),
  latitude: z.number().min(-90, 'latitude must be between -90 and 90').max(90, 'latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180'),
  address: z.string().max(500, 'address must be at most 500 characters').optional(),
  photoUrl: z.string().url('photoUrl must be a valid URL').max(2000).optional(),
  reporterName: z.string().max(100, 'reporterName must be at most 100 characters').optional(),
});

const upvoteSchema = z.object({
  voterKey: z.string().min(1, 'voterKey is required').max(120, 'voterKey must be at most 120 characters'),
});

const statusUpdateSchema = z.object({
  status: z.enum(STATUSES as unknown as [Status, ...Status[]], {
    errorMap: () => ({ message: `status must be one of: ${STATUSES.join(', ')}` }),
  }),
  note: z.string().max(1000, 'note must be at most 1000 characters').optional(),
});

const SORTS = ['newest', 'priority', 'upvotes'] as const;

function zodDetails(error: z.ZodError) {
  return error.issues.map((i) => ({
    field: i.path.join('.') || '(body)',
    message: i.message,
  }));
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Malformed JSON -> 400 (instead of Express' default HTML error page)
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    next(err as Error);
  });

  const pool = getPool();

  // -- Admin key ------------------------------------------------------------
  let adminKey = options.adminKey ?? process.env.ADMIN_KEY ?? '';
  if (!adminKey) {
    adminKey = crypto.randomBytes(24).toString('hex');
    console.log(
      '[civiclens] ADMIN_KEY not set — generated an ephemeral admin key for this run:\n' +
        `[civiclens] ADMIN_KEY=${adminKey}\n` +
        '[civiclens] (Set ADMIN_KEY in the environment to use a stable key.)'
    );
  }
  const adminKeyIsValid = (req: Request): boolean => {
    const provided = req.header('x-admin-key') ?? '';
    if (!provided || !adminKey) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(adminKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  // -- POST /api/reports ----------------------------------------------------
  app.post('/api/reports', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createReportSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: zodDetails(parsed.error) });
        return;
      }
      const body = parsed.data;
      const photoUrl = body.photoUrl?.trim() ? body.photoUrl : undefined;
      const reporterName = body.reporterName?.trim() ? body.reporterName.trim() : 'Anonymous';

      // 1. AI triage (Nebius primary, heuristic fallback)
      const triage = await triageReport({
        title: body.title,
        description: body.description,
        hasPhoto: Boolean(photoUrl),
      });

      // 2. Dedup check — merge into the existing report instead of duplicating
      const duplicate = await findDuplicate(pool, {
        category: triage.category,
        latitude: body.latitude,
        longitude: body.longitude,
        title: body.title,
        description: body.description,
      });
      if (duplicate) {
        // The reporter's voice is added to the existing report as an upvote.
        const now = new Date();
        const newUpvotes = Number(duplicate.upvotes) + 1;
        const priorityScore = computePriorityScore({
          severity: Number(duplicate.severity),
          upvotes: newUpvotes,
          createdAt: duplicate.created_at,
          category: duplicate.category as Category,
        });
        const { rows } = await pool.query<ReportRow>(
          'UPDATE reports SET upvotes = $1, priority_score = $2, updated_at = $3 WHERE id = $4 RETURNING *',
          [newUpvotes, priorityScore, now.toISOString(), duplicate.id]
        );
        res.status(201).json({ merged: true, report: toReportJson(rows[0]) });
        return;
      }

      // 3. Create the report
      const id = crypto.randomUUID();
      const now = new Date();
      const priorityScore = computePriorityScore({
        severity: triage.severity,
        upvotes: 0,
        createdAt: now,
        category: triage.category,
      });
      const { rows } = await pool.query<ReportRow>(
        `INSERT INTO reports
           (id, title, description, category, severity, severity_rationale, department,
            status, latitude, longitude, address, photo_url, reporter_name,
            priority_score, upvotes, is_sample, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'reported',$8,$9,$10,$11,$12,$13,0,false,$14,$14)
         RETURNING *`,
        [
          id,
          body.title,
          body.description,
          triage.category,
          triage.severity,
          triage.severityRationale,
          triage.department,
          body.latitude,
          body.longitude,
          body.address ?? null,
          photoUrl ?? null,
          reporterName,
          priorityScore,
          now.toISOString(),
        ]
      );
      await pool.query(
        'INSERT INTO status_history (id, report_id, from_status, to_status, note, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [crypto.randomUUID(), id, null, 'reported', null, now.toISOString()]
      );
      res.status(201).json({
        report: toReportJson(rows[0]),
        triage: {
          provider: triage.provider,
          category: triage.category,
          severity: triage.severity,
          severityRationale: triage.severityRationale,
          department: triage.department,
          priorityScore,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // -- GET /api/reports ------------------------------------------------------
  app.get('/api/reports', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, category, bbox, sort, limit, offset, q } = req.query;

      if (status !== undefined && !STATUSES.includes(status as Status)) {
        res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
        return;
      }
      if (category !== undefined && !CATEGORIES.includes(category as Category)) {
        res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
        return;
      }
      const sortKey = (sort as string) ?? 'newest';
      if (!SORTS.includes(sortKey as (typeof SORTS)[number])) {
        res.status(400).json({ error: `sort must be one of: ${SORTS.join(', ')}` });
        return;
      }

      let limitNum = 20;
      if (limit !== undefined) {
        limitNum = Number(limit);
        if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
          res.status(400).json({ error: 'limit must be an integer between 1 and 100' });
          return;
        }
      }
      let offsetNum = 0;
      if (offset !== undefined) {
        offsetNum = Number(offset);
        if (!Number.isInteger(offsetNum) || offsetNum < 0) {
          res.status(400).json({ error: 'offset must be a non-negative integer' });
          return;
        }
      }

      const conditions: string[] = [];
      const values: unknown[] = [];
      const add = (cond: string, val: unknown) => {
        values.push(val);
        conditions.push(`${cond} $${values.length}`);
      };

      if (status !== undefined) add('status =', status);
      if (category !== undefined) add('category =', category);

      if (bbox !== undefined) {
        const parts = String(bbox).split(',').map(Number);
        if (
          parts.length !== 4 ||
          parts.some((n) => !Number.isFinite(n)) ||
          parts[0] < -180 || parts[0] > 180 ||
          parts[2] < -180 || parts[2] > 180 ||
          parts[1] < -90 || parts[1] > 90 ||
          parts[3] < -90 || parts[3] > 90
        ) {
          res.status(400).json({ error: 'bbox must be minLng,minLat,maxLng,maxLat with valid coordinates' });
          return;
        }
        const [minLng, minLat, maxLng, maxLat] = parts;
        values.push(minLng, maxLng, minLat, maxLat);
        const n = values.length;
        conditions.push(`longitude BETWEEN $${n - 3} AND $${n - 2} AND latitude BETWEEN $${n - 1} AND $${n}`);
      }

      if (q !== undefined) {
        const term = String(q);
        if (term.length > 200) {
          res.status(400).json({ error: 'q must be at most 200 characters' });
          return;
        }
        if (term.trim()) {
          values.push(`%${term}%`);
          conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
        }
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy =
        sortKey === 'priority'
          ? 'priority_score DESC, created_at DESC'
          : sortKey === 'upvotes'
            ? 'upvotes DESC, created_at DESC'
            : 'created_at DESC';

      const totalRes = await pool.query(`SELECT count(*)::int AS total FROM reports ${where}`, values);
      const total: number = totalRes.rows[0].total;

      const { rows } = await pool.query<ReportRow>(
        `SELECT * FROM reports ${where} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limitNum, offsetNum]
      );
      res.json({
        reports: rows.map(toReportJson),
        total,
        limit: limitNum,
        offset: offsetNum,
      });
    } catch (err) {
      next(err);
    }
  });

  // -- GET /api/reports/:id --------------------------------------------------
  app.get('/api/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const { rows } = await pool.query<ReportRow>('SELECT * FROM reports WHERE id = $1', [id]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const report = rows[0];

      const historyRes = await pool.query<HistoryRow>(
        'SELECT from_status, to_status, note, created_at FROM status_history WHERE report_id = $1 ORDER BY created_at ASC',
        [id]
      );

      const sameCat = await pool.query<ReportRow>(
        'SELECT * FROM reports WHERE category = $1 AND id <> $2',
        [report.category, id]
      );
      const similar = (sameCat.rows as ReportRow[])
        .filter(
          (r) => haversineKm(Number(report.latitude), Number(report.longitude), Number(r.latitude), Number(r.longitude)) <= 1
        )
        .sort((a, b) => Number(b.priority_score) - Number(a.priority_score))
        .slice(0, 5)
        .map(toReportJson);

      res.json({
        report: toReportJson(report),
        history: historyRes.rows.map(toHistoryJson),
        similar,
      });
    } catch (err) {
      next(err);
    }
  });

  // -- POST /api/reports/:id/upvote ------------------------------------------
  app.post('/api/reports/:id/upvote', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const parsed = upvoteSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: zodDetails(parsed.error) });
        return;
      }
      const existing = await pool.query<ReportRow>('SELECT * FROM reports WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const report = existing.rows[0];

      // Idempotent: one vote per voterKey per report.
      const insertRes = await pool.query(
        'INSERT INTO upvotes (report_id, voter_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, parsed.data.voterKey]
      );
      if (insertRes.rowCount === 0) {
        // Duplicate vote — return current counts, do not double-count.
        res.json({
          upvotes: Number(report.upvotes),
          priorityScore: Number(report.priority_score),
        });
        return;
      }

      const newUpvotes = Number(report.upvotes) + 1;
      const priorityScore = computePriorityScore({
        severity: Number(report.severity),
        upvotes: newUpvotes,
        createdAt: report.created_at,
        category: report.category as Category,
      });
      const { rows } = await pool.query<ReportRow>(
        'UPDATE reports SET upvotes = $1, priority_score = $2, updated_at = $3 WHERE id = $4 RETURNING *',
        [newUpvotes, priorityScore, new Date().toISOString(), id]
      );
      res.json({
        upvotes: Number(rows[0].upvotes),
        priorityScore: Number(rows[0].priority_score),
      });
    } catch (err) {
      next(err);
    }
  });

  // -- PATCH /api/reports/:id/status ------------------------------------------
  app.patch('/api/reports/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!adminKeyIsValid(req)) {
        res.status(401).json({ error: 'Unauthorized: invalid or missing x-admin-key header' });
        return;
      }
      const { id } = req.params;
      if (!isUuid(id)) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const parsed = statusUpdateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: zodDetails(parsed.error) });
        return;
      }
      const { rows } = await pool.query<ReportRow>('SELECT * FROM reports WHERE id = $1', [id]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const report = rows[0];
      const fromStatus = report.status;
      const toStatus = parsed.data.status;

      if (fromStatus !== toStatus) {
        const now = new Date();
        const priorityScore = computePriorityScore({
          severity: Number(report.severity),
          upvotes: Number(report.upvotes),
          createdAt: report.created_at,
          category: report.category as Category,
        });
        const updated = await pool.query<ReportRow>(
          'UPDATE reports SET status = $1, priority_score = $2, updated_at = $3 WHERE id = $4 RETURNING *',
          [toStatus, priorityScore, now.toISOString(), id]
        );
        await pool.query(
          'INSERT INTO status_history (id, report_id, from_status, to_status, note, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [crypto.randomUUID(), id, fromStatus, toStatus, parsed.data.note ?? null, now.toISOString()]
        );
        res.json({ report: toReportJson(updated.rows[0]) });
      } else {
        res.json({ report: toReportJson(report) });
      }
    } catch (err) {
      next(err);
    }
  });

  // -- GET /api/stats ----------------------------------------------------------
  app.get('/api/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const totalRes = await pool.query('SELECT count(*)::int AS total FROM reports');
      const totalReports: number = totalRes.rows[0].total;

      const byStatus: Record<string, number> = {};
      for (const s of STATUSES) byStatus[s] = 0;
      const statusRes = await pool.query('SELECT status, count(*)::int AS n FROM reports GROUP BY status');
      for (const r of statusRes.rows) byStatus[r.status] = r.n;

      const byCategory: Record<string, number> = {};
      for (const c of CATEGORIES) byCategory[c] = 0;
      const catRes = await pool.query('SELECT category, count(*)::int AS n FROM reports GROUP BY category');
      for (const r of catRes.rows) byCategory[r.category] = r.n;

      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const weekRes = await pool.query('SELECT count(*)::int AS n FROM reports WHERE created_at >= $1', [weekAgo]);
      const reportsThisWeek: number = weekRes.rows[0].n;

      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const resolvedRes = await pool.query(
        "SELECT count(*)::int AS n FROM reports WHERE status = 'resolved' AND updated_at >= $1",
        [monthAgo]
      );
      const resolvedLast30Days: number = resolvedRes.rows[0].n;

      // avgDaysToResolve: from created_at to the latest 'resolved' transition per report
      const resolvedDetail = await pool.query<{ id: string; created_at: Date; resolved_at: Date }>(
        `SELECT r.id, r.created_at, h.created_at AS resolved_at
           FROM reports r
           JOIN status_history h ON h.report_id = r.id
          WHERE r.status = 'resolved' AND h.to_status = 'resolved'`
      );
      let avgDaysToResolve: number | null = null;
      if (resolvedDetail.rows.length > 0) {
        const latest = new Map<string, { created: number; resolved: number }>();
        for (const r of resolvedDetail.rows) {
          const cur = latest.get(r.id);
          const resolvedMs = new Date(r.resolved_at).getTime();
          if (!cur || resolvedMs > cur.resolved) {
            latest.set(r.id, { created: new Date(r.created_at).getTime(), resolved: resolvedMs });
          }
        }
        const days = [...latest.values()].map((v) => (v.resolved - v.created) / 86_400_000);
        const avg = days.reduce((a, b) => a + b, 0) / days.length;
        avgDaysToResolve = Math.round(avg * 10) / 10;
      }

      res.json({
        totalReports,
        byStatus,
        byCategory,
        resolvedLast30Days,
        avgDaysToResolve,
        reportsThisWeek,
      });
    } catch (err) {
      next(err);
    }
  });

  // -- GET /api/departments ------------------------------------------------------
  app.get('/api/departments', (_req: Request, res: Response) => {
    res.json({ departments: DEPARTMENTS });
  });

  // -- GET /api/health -----------------------------------------------------------
  app.get('/api/health', async (_req: Request, res: Response) => {
    const version = readVersion();
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: getDbKind() as DbKind, ai: aiProviderActive(), version });
    } catch {
      res.status(503).json({ ok: false, db: getDbKind() as DbKind, ai: aiProviderActive(), version });
    }
  });

  // -- Unknown /api route -> JSON 404 (must come before the SPA fallback) ---------
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // -- Frontend static serving / API-only notice -----------------------------------
  const clientOut = path.resolve(__dirname, '..', '..', 'client', 'out');
  if (fs.existsSync(path.join(clientOut, 'index.html'))) {
    app.use(express.static(clientOut));
    // Report detail shell: Next.js static export prerenders ONE shell at
    // /reports/view/ for the dynamic /reports/[id] route. Serve that shell for
    // any /reports/:id URL; the client reads the real id from window.location.
    const reportShell = path.join(clientOut, 'reports', 'view', 'index.html');
    app.get('/reports/:id', (req: Request, res: Response, next: NextFunction) => {
      if (req.params.id === 'view' || !fs.existsSync(reportShell)) return next();
      res.sendFile(reportShell);
    });
    // SPA fallback for non-API routes
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientOut, 'index.html'));
    });
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res.json({
        message: 'CivicLens API is running in API-only mode (client/out not built yet).',
        health: '/api/health',
        docs: 'see server/README.md',
      });
    });
  }

  // -- Global error handler (last) ---------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[civiclens] unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function readVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}
