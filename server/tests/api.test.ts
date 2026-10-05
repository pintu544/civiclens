import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { createInMemoryPool, setPool, getPool, closePool, resetPool } from '../src/db';
import { runSeed, SEED_REPORTS } from '../src/seed';

const ADMIN_KEY = 'test-admin-key';
let app: Express;

const OLD_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.LLM_API_KEY;
  setPool(createInMemoryPool());
  app = createApp({ adminKey: ADMIN_KEY });
});

afterEach(async () => {
  process.env = { ...OLD_ENV };
  await closePool();
  resetPool();
});

const VALID_REPORT = {
  title: 'Large pothole on Guadalupe St near 24th',
  description:
    'A deep pothole roughly two feet wide has opened up in the right lane. Cars are swerving to avoid it.',
  latitude: 30.2845,
  longitude: -97.7412,
  address: '2400 Guadalupe St, Austin, TX 78705',
  reporterName: 'Maya R.',
};

async function createReport(body: Record<string, unknown> = VALID_REPORT) {
  return request(app).post('/api/reports').send(body);
}

describe('POST /api/reports', () => {
  it('creates a report with heuristic triage (201)', async () => {
    const res = await createReport();
    expect(res.status).toBe(201);
    expect(res.body.merged).toBeUndefined();
    const { report, triage } = res.body;
    expect(report.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(report.title).toBe(VALID_REPORT.title);
    expect(report.status).toBe('reported');
    expect(report.isSample).toBe(false);
    expect(report.reporterName).toBe('Maya R.');
    expect(report.upvotes).toBe(0);
    expect(triage.provider).toBe('heuristic');
    expect(triage.category).toBe('roads');
    expect(triage.department).toBe('Public Works Department');
    expect(triage.severity).toBeGreaterThanOrEqual(1);
    expect(triage.priorityScore).toBe(report.priorityScore);
  });

  it('defaults reporterName to Anonymous', async () => {
    const { title, description, latitude, longitude } = VALID_REPORT;
    const res = await createReport({ title, description, latitude, longitude });
    expect(res.status).toBe(201);
    expect(res.body.report.reporterName).toBe('Anonymous');
  });

  it('rejects invalid bodies with 400', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['short title', { ...VALID_REPORT, title: 'abc' }],
      ['long title', { ...VALID_REPORT, title: 'x'.repeat(121) }],
      ['short description', { ...VALID_REPORT, description: 'too short' }],
      ['bad latitude', { ...VALID_REPORT, latitude: 100 }],
      ['bad longitude', { ...VALID_REPORT, longitude: -200 }],
      ['empty body', {}],
      ['bad photoUrl', { ...VALID_REPORT, photoUrl: 'not-a-url' }],
    ];
    for (const [name, body] of cases) {
      const res = await createReport(body);
      expect(res.status, name).toBe(400);
      expect(res.body.error).toBeDefined();
    }
  });

  it('merges a duplicate report (201 merged:true) and adds the voice as an upvote', async () => {
    const first = await createReport();
    expect(first.status).toBe(201);
    const firstId = first.body.report.id;

    const res = await createReport({
      title: 'Big pothole on Guadalupe near 24th St',
      description:
        'A huge two-foot-wide pothole in the right lane of Guadalupe St; vehicles swerve into the bike lane to avoid it.',
      latitude: 30.2847,
      longitude: -97.741,
    });
    expect(res.status).toBe(201);
    expect(res.body.merged).toBe(true);
    expect(res.body.report.id).toBe(firstId);
    expect(res.body.report.upvotes).toBe(1);
  });
});

describe('GET /api/reports', () => {
  it('lists with pagination metadata and filters', async () => {
    await createReport(); // roads, reported
    await createReport({
      title: 'Streetlight out on 6th and Congress',
      description: 'The streetlight at the corner has been out for over a week now.',
      latitude: 30.2674,
      longitude: -97.7433,
    }); // streetlights, reported
    await createReport({
      title: 'Overflowing dumpster on S Congress',
      description: 'The shared dumpster behind the shops is overflowing with trash everywhere.',
      latitude: 30.2498,
      longitude: -97.7492,
    }); // waste, reported

    const list = await request(app).get('/api/reports');
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
    expect(list.body.limit).toBe(20);
    expect(list.body.offset).toBe(0);
    expect(list.body.reports).toHaveLength(3);

    const roads = await request(app).get('/api/reports').query({ category: 'roads' });
    expect(roads.body.total).toBe(1);

    const page = await request(app).get('/api/reports').query({ limit: 2, offset: 2 });
    expect(page.body.reports).toHaveLength(1);
    expect(page.body.total).toBe(3);

    const search = await request(app).get('/api/reports').query({ q: 'dumpster' });
    expect(search.body.total).toBe(1);
    expect(search.body.reports[0].category).toBe('waste');
  });

  it('sorts by priority descending', async () => {
    await createReport({
      title: 'Graffiti on bus shelter',
      description: 'Tags all over the downtown bus shelter glass and schedule board.',
      latitude: 30.2689,
      longitude: -97.7439,
    }); // other, weight 2
    await createReport(); // roads, weight 8
    await createReport({
      title: 'Damaged guardrail on Mopac exit ramp',
      description:
        'The guardrail on the exit ramp is bent inward after a crash and the reflective panels are gone.',
      latitude: 30.2789,
      longitude: -97.7821,
    }); // roads (guardrail), weight 8 — high severity wording keeps it top of roads
    await createReport({
      title: 'Unsafe intersection after crash at night',
      description:
        'The intersection feels unsafe since the crash last week; debris everywhere and no lighting, drivers speed through.',
      latitude: 30.2791,
      longitude: -97.7823,
    }); // safety, weight 15

    const res = await request(app).get('/api/reports').query({ sort: 'priority' });
    const cats = res.body.reports.map((r: { category: string }) => r.category);
    expect(cats).toEqual(['safety', 'roads', 'roads', 'other']);
  });

  it('filters by bbox', async () => {
    await createReport(); // downtown Austin
    await createReport({
      title: 'Fallen tree in far away park',
      description: 'A large tree came down across the walking path during the storm.',
      latitude: 29.0,
      longitude: -99.0,
    });
    const res = await request(app)
      .get('/api/reports')
      .query({ bbox: '-98,30,-97,31' });
    expect(res.body.total).toBe(1);
    expect(res.body.reports[0].title).toContain('pothole');
  });

  it('rejects bad query params with 400', async () => {
    for (const query of [
      { sort: 'bogus' },
      { status: 'bogus' },
      { category: 'bogus' },
      { bbox: 'a,b,c' },
      { bbox: '-98,30' },
      { limit: '0' },
      { limit: '101' },
      { offset: '-1' },
    ]) {
      const res = await request(app).get('/api/reports').query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
    }
  });
});

describe('GET /api/reports/:id', () => {
  it('returns report, history, and similar reports', async () => {
    const a = await createReport();
    const idA = a.body.report.id;
    await createReport({
      title: 'Faded crosswalk paint on Congress Ave',
      description: 'The crosswalk markings near the intersection have worn away completely.',
      latitude: 30.2855,
      longitude: -97.742,
    });

    const res = await request(app).get(`/api/reports/${idA}`);
    expect(res.status).toBe(200);
    expect(res.body.report.id).toBe(idA);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].toStatus).toBe('reported');
    expect(res.body.history[0].fromStatus).toBeNull();
    expect(res.body.similar).toHaveLength(1);
    expect(res.body.similar[0].category).toBe('roads');
  });

  it('returns 404 for unknown or malformed ids', async () => {
    const unknown = await request(app).get('/api/reports/22222222-2222-2222-2222-222222222222');
    expect(unknown.status).toBe(404);
    const malformed = await request(app).get('/api/reports/not-a-uuid');
    expect(malformed.status).toBe(404);
  });
});

describe('POST /api/reports/:id/upvote', () => {
  it('increments once per voterKey (idempotent)', async () => {
    const created = await createReport();
    const id = created.body.report.id;
    const before = created.body.report.priorityScore;

    const v1 = await request(app).post(`/api/reports/${id}/upvote`).send({ voterKey: 'alice' });
    expect(v1.status).toBe(200);
    expect(v1.body.upvotes).toBe(1);
    expect(v1.body.priorityScore).toBeGreaterThan(before);

    const v2 = await request(app).post(`/api/reports/${id}/upvote`).send({ voterKey: 'alice' });
    expect(v2.status).toBe(200);
    expect(v2.body.upvotes).toBe(1); // no double count
    expect(v2.body.priorityScore).toBe(v1.body.priorityScore);

    const v3 = await request(app).post(`/api/reports/${id}/upvote`).send({ voterKey: 'bob' });
    expect(v3.body.upvotes).toBe(2);
  });

  it('rejects missing voterKey (400) and unknown report (404)', async () => {
    const created = await createReport();
    const id = created.body.report.id;
    const bad = await request(app).post(`/api/reports/${id}/upvote`).send({});
    expect(bad.status).toBe(400);
    const missing = await request(app)
      .post('/api/reports/22222222-2222-2222-2222-222222222222/upvote')
      .send({ voterKey: 'alice' });
    expect(missing.status).toBe(404);
  });
});

describe('PATCH /api/reports/:id/status', () => {
  it('requires the admin key', async () => {
    const created = await createReport();
    const id = created.body.report.id;
    const noKey = await request(app).patch(`/api/reports/${id}/status`).send({ status: 'acknowledged' });
    expect(noKey.status).toBe(401);
    const wrongKey = await request(app)
      .patch(`/api/reports/${id}/status`)
      .set('x-admin-key', 'wrong')
      .send({ status: 'acknowledged' });
    expect(wrongKey.status).toBe(401);
  });

  it('updates status, appends history, recomputes priority', async () => {
    const created = await createReport();
    const id = created.body.report.id;
    const res = await request(app)
      .patch(`/api/reports/${id}/status`)
      .set('x-admin-key', ADMIN_KEY)
      .send({ status: 'in_progress', note: 'Crew dispatched.' });
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('in_progress');

    const detail = await request(app).get(`/api/reports/${id}`);
    expect(detail.body.history).toHaveLength(2);
    expect(detail.body.history[1]).toMatchObject({
      fromStatus: 'reported',
      toStatus: 'in_progress',
      note: 'Crew dispatched.',
    });
  });

  it('rejects invalid status (400) and unknown id (404)', async () => {
    const created = await createReport();
    const id = created.body.report.id;
    const bad = await request(app)
      .patch(`/api/reports/${id}/status`)
      .set('x-admin-key', ADMIN_KEY)
      .send({ status: 'bogus' });
    expect(bad.status).toBe(400);
    const missing = await request(app)
      .patch('/api/reports/22222222-2222-2222-2222-222222222222/status')
      .set('x-admin-key', ADMIN_KEY)
      .send({ status: 'resolved' });
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/stats', () => {
  it('computes correct aggregates', async () => {
    const pool = getPool();
    const day = 86_400_000;
    const now = Date.now();
    const rows: Array<[string, string, string, number, number, number]> = [
      // id, category, status, daysAgoCreated, daysAgoUpdated, upvotes
      ['a1111111-1111-1111-1111-111111111111', 'roads', 'reported', 1, 1, 0],
      ['b2222222-2222-2222-2222-222222222222', 'water', 'acknowledged', 2, 2, 0],
      ['c3333333-3333-3333-3333-333333333333', 'water', 'resolved', 10, 8, 0],
      ['d4444444-4444-4444-4444-444444444444', 'safety', 'resolved', 20, 15, 0],
      ['e5555555-5555-5555-5555-555555555555', 'parks', 'reported', 40, 40, 0],
    ];
    for (const [id, category, status, daysAgoCreated, daysAgoUpdated, upvotes] of rows) {
      const created = new Date(now - daysAgoCreated * day).toISOString();
      const updated = new Date(now - daysAgoUpdated * day).toISOString();
      await pool.query(
        `INSERT INTO reports (id, title, description, category, severity, department, status,
                              latitude, longitude, upvotes, priority_score, created_at, updated_at)
         VALUES ($1,'t','d long enough description here',$2,3,'dept',$3,30.26,-97.74,$4,50,$5,$6)`,
        [id, category, status, upvotes, created, updated]
      );
    }
    // resolved transitions: c resolved 2 days after creation, d resolved 5 days after
    await pool.query(
      `INSERT INTO status_history (id, report_id, from_status, to_status, created_at) VALUES
       ('aaaaaaaa-1111-1111-1111-111111111111','c3333333-3333-3333-3333-333333333333','in_progress','resolved',$1),
       ('bbbbbbbb-2222-2222-2222-222222222222','d4444444-4444-4444-4444-444444444444','in_progress','resolved',$2)`,
      [
        new Date(now - 8 * day).toISOString(),
        new Date(now - 15 * day).toISOString(),
      ]
    );

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalReports).toBe(5);
    expect(res.body.byStatus).toMatchObject({
      reported: 2,
      acknowledged: 1,
      in_progress: 0,
      resolved: 2,
    });
    expect(res.body.byCategory).toMatchObject({
      roads: 1,
      water: 2,
      safety: 1,
      parks: 1,
      waste: 0,
      streetlights: 0,
      other: 0,
    });
    expect(res.body.resolvedLast30Days).toBe(2);
    expect(res.body.reportsThisWeek).toBe(2);
    expect(res.body.avgDaysToResolve).toBe(3.5); // (2 + 5) / 2
  });

  it('returns null avgDaysToResolve when nothing is resolved', async () => {
    await createReport();
    const res = await request(app).get('/api/stats');
    expect(res.body.avgDaysToResolve).toBeNull();
    expect(res.body.resolvedLast30Days).toBe(0);
  });
});

describe('GET /api/departments, /api/health, unknown routes', () => {
  it('lists the 7 departments', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(7);
    const pw = res.body.departments.find((d: { id: string }) => d.id === 'public-works');
    expect(pw).toMatchObject({ name: 'Public Works Department', categories: ['roads'] });
  });

  it('reports health with db/ai/version', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, db: 'pgmem', ai: 'heuristic', version: '0.1.0' });
  });

  it('returns JSON 404 for unknown /api routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('seed', () => {
  it('inserts 16 Austin sample reports and is idempotent', async () => {
    expect(SEED_REPORTS).toHaveLength(16);
    const first = await runSeed();
    expect(first).toMatchObject({ inserted: 16, skipped: false });

    const list = await request(app).get('/api/reports').query({ limit: 100 });
    expect(list.body.total).toBe(16);
    expect(list.body.reports.every((r: { isSample: boolean }) => r.isSample)).toBe(true);

    const second = await runSeed();
    expect(second.skipped).toBe(true);
    const again = await request(app).get('/api/reports').query({ limit: 100 });
    expect(again.body.total).toBe(16);

    // 3 resolved reports each carry a full 4-step history
    const resolved = list.body.reports.filter(
      (r: { status: string }) => r.status === 'resolved'
    );
    expect(resolved).toHaveLength(3);
    const detail = await request(app).get(`/api/reports/${resolved[0].id}`);
    expect(detail.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'reported',
      'acknowledged',
      'in_progress',
      'resolved',
    ]);
  });
});

describe('CORS', () => {
  it('emits no CORS headers when CORS_ORIGIN is unset (same-origin mode)', async () => {
    delete process.env.CORS_ORIGIN;
    const corsApp = createApp({ adminKey: ADMIN_KEY });
    const res = await request(corsApp)
      .get('/api/health')
      .set('Origin', 'https://civiclens.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows a listed origin and answers preflight', async () => {
    process.env.CORS_ORIGIN = 'https://civiclens.vercel.app';
    const corsApp = createApp({ adminKey: ADMIN_KEY });
    const res = await request(corsApp)
      .get('/api/health')
      .set('Origin', 'https://civiclens.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://civiclens.vercel.app');

    const preflight = await request(corsApp)
      .options('/api/reports')
      .set('Origin', 'https://civiclens.vercel.app')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('https://civiclens.vercel.app');
  });

  it('does not allow an unlisted origin', async () => {
    process.env.CORS_ORIGIN = 'https://civiclens.vercel.app';
    const corsApp = createApp({ adminKey: ADMIN_KEY });
    const res = await request(corsApp)
      .get('/api/health')
      .set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('startup DB init', () => {
  it('ensurePostgresSchema is a no-op for pg-mem pools', async () => {
    const { ensurePostgresSchema, getDbKind } = await import('../src/db');
    expect(getDbKind()).toBe('pgmem');
    await expect(ensurePostgresSchema()).resolves.toBeUndefined();
    // app still works afterwards
    const res = await request(app).get('/api/health');
    expect(res.body.ok).toBe(true);
  });

  it('schema.sql is idempotent (safe to apply twice)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'schema.sql'),
      'utf8'
    );
    const creates = sql.match(/^CREATE TABLE .*$/gm) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    for (const line of creates) {
      expect(line.startsWith('CREATE TABLE IF NOT EXISTS ')).toBe(true);
    }
  });
});
