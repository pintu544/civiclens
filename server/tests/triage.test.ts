import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  heuristicTriage,
  triageReport,
  departmentForCategory,
  aiProviderActive,
} from '../src/triage';
import { computePriorityScore } from '../src/priority';
import {
  haversineKm,
  jaccardSimilarity,
  findDuplicate,
} from '../src/dedup';
import { createInMemoryPool } from '../src/db';

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('heuristicTriage', () => {
  it('classifies a pothole report as roads', () => {
    const r = heuristicTriage({
      title: 'Large pothole on Guadalupe St near 24th',
      description: 'A deep pothole in the right lane; cars swerve to avoid it.',
      hasPhoto: false,
    });
    expect(r.category).toBe('roads');
    expect(r.department).toBe('Public Works Department');
    expect(r.severity).toBeGreaterThanOrEqual(1);
    expect(r.severity).toBeLessThanOrEqual(5);
    expect(r.severityRationale).toContain('Heuristic');
  });

  it('classifies a burst pipe report as water', () => {
    const r = heuristicTriage({
      title: 'Burst water pipe flooding sidewalk',
      description: 'Water is gushing from a broken pipe onto the sidewalk.',
      hasPhoto: true,
    });
    expect(r.category).toBe('water');
    expect(r.department).toBe('Water Authority');
  });

  it('defaults to other when nothing matches', () => {
    const r = heuristicTriage({
      title: 'Graffiti covering bus stop shelter',
      description: 'Tags all over the shelter glass; cannot read the schedule.',
      hasPhoto: false,
    });
    expect(r.category).toBe('other');
    expect(r.department).toBe('General Services');
  });

  it('bumps severity +1 with >=2 urgency hits', () => {
    const r = heuristicTriage({
      title: 'Blocked storm drain overflowing',
      description: 'The drain is blocked and overflowing across the whole road.',
      hasPhoto: false,
    });
    // base 3 + 1 (blocked, overflowing) = 4
    expect(r.severity).toBe(4);
  });

  it('lowers severity -1 for minor wording', () => {
    const r = heuristicTriage({
      title: 'Small crack in sidewalk',
      description: 'A small minor crack near the curb, barely noticeable.',
      hasPhoto: false,
    });
    // base 3 - 1 (small/minor) = 2
    expect(r.severity).toBe(2);
  });

  it('clamps severity to 5', () => {
    const r = heuristicTriage({
      title: 'Urgent: dangerous sparking wire, accident blocked road',
      description: 'Urgent dangerous sparking wire caused an accident, road blocked and flooding.',
      hasPhoto: false,
    });
    expect(r.severity).toBe(5);
  });
});

describe('triageReport provider selection', () => {
  it('uses heuristic when NEBIUS_API_KEY is absent', async () => {
    delete process.env.NEBIUS_API_KEY;
    expect(aiProviderActive()).toBe('heuristic');
    const r = await triageReport({
      title: 'Pothole on Main St',
      description: 'A pothole in the middle of the road near the crosswalk.',
      hasPhoto: false,
    });
    expect(r.provider).toBe('heuristic');
    expect(r.category).toBe('roads');
  });

  it('uses Nebius on mocked success and derives department from category', async () => {
    process.env.NEBIUS_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"category": "water", "severity": 4, "severityRationale": "Active leak wasting water near a walkway."}',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await triageReport({
      title: 'Leaking hydrant',
      description: 'Water streaming from a hydrant into the gutter.',
      hasPhoto: false,
    });
    expect(r.provider).toBe('nebius');
    expect(r.category).toBe('water');
    expect(r.severity).toBe(4);
    expect(r.department).toBe('Water Authority');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.studio.nebius.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('nvidia/Nemotron-3_5-Lightning');
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('retries once then falls back on Nebius HTTP failure', async () => {
    process.env.NEBIUS_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const r = await triageReport({
      title: 'Pothole on Main St',
      description: 'A pothole in the middle of the road.',
      hasPhoto: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 retry
    expect(r.provider).toBe('heuristic');
    expect(r.category).toBe('roads');
    expect(warn).toHaveBeenCalled();
  });

  it('falls back on Nebius garbage JSON', async () => {
    process.env.NEBIUS_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not json at all' } }],
        }),
      })
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const r = await triageReport({
      title: 'Overflowing dumpster',
      description: 'Trash everywhere behind the shops.',
      hasPhoto: false,
    });
    expect(r.provider).toBe('heuristic');
    expect(r.category).toBe('waste');
  });

  it('falls back when Nebius returns an invalid category', async () => {
    process.env.NEBIUS_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: '{"category": "aliens", "severity": 3, "severityRationale": "x"}' } },
          ],
        }),
      })
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const r = await triageReport({
      title: 'Pothole on Main St',
      description: 'A pothole in the middle of the road.',
      hasPhoto: false,
    });
    expect(r.provider).toBe('heuristic');
  });
});

describe('departmentForCategory', () => {
  it('maps every category to the PLAN department', () => {
    expect(departmentForCategory('roads')).toBe('Public Works Department');
    expect(departmentForCategory('streetlights')).toBe('Power & Lighting Department');
    expect(departmentForCategory('waste')).toBe('Sanitation Department');
    expect(departmentForCategory('water')).toBe('Water Authority');
    expect(departmentForCategory('parks')).toBe('Parks & Recreation');
    expect(departmentForCategory('safety')).toBe('Public Safety Office');
    expect(departmentForCategory('other')).toBe('General Services');
  });
});

describe('computePriorityScore', () => {
  it('follows severity*20 + min(upvotes,25)*2 + max(0,10-daysOld) + weight', () => {
    const score = computePriorityScore({
      severity: 4,
      upvotes: 10,
      createdAt: new Date(Date.now() - 2 * 86_400_000),
      category: 'safety',
    });
    // 80 + 20 + 8 + 15 = 123
    expect(score).toBe(123);
  });

  it('caps upvotes at 25 and drops the freshness bonus after 10 days', () => {
    const score = computePriorityScore({
      severity: 5,
      upvotes: 100,
      createdAt: new Date(Date.now() - 20 * 86_400_000),
      category: 'other',
    });
    // 100 + 50 + 0 + 2 = 152
    expect(score).toBe(152);
  });

  it('rounds to 1 decimal', () => {
    const score = computePriorityScore({
      severity: 3,
      upvotes: 5,
      createdAt: new Date(Date.now() - 2.37 * 86_400_000),
      category: 'safety',
    });
    // 60 + 10 + 7.63 + 15 = 92.63 -> 92.6
    expect(score).toBe(92.6);
  });
});

describe('haversineKm / jaccardSimilarity', () => {
  it('haversine is 0 for the same point and ~111.19 km per degree of longitude at the equator', () => {
    expect(haversineKm(30.2672, -97.7431, 30.2672, -97.7431)).toBe(0);
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });

  it('jaccard is 1 for identical text, 0 for disjoint text', () => {
    expect(jaccardSimilarity('pothole on main street', 'pothole on main street')).toBe(1);
    expect(jaccardSimilarity('abc def', 'ghi jkl')).toBe(0);
  });
});

describe('findDuplicate', () => {
  it('finds a near-duplicate within 0.4 km and ignores far / other-category reports', async () => {
    const pool = createInMemoryPool();
    try {
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO reports (id, title, description, category, severity, department, latitude, longitude, created_at, updated_at)
         VALUES ('11111111-1111-1111-1111-111111111111', 'Pothole on Main Street',
                 'A big pothole in the road near the crosswalk on Main Street', 'roads', 3,
                 'Public Works Department', 30.2672, -97.7431, $1, $1)`,
        [now]
      );

      const dup = await findDuplicate(pool, {
        category: 'roads',
        latitude: 30.2675,
        longitude: -97.7433,
        title: 'Big pothole on Main St near crosswalk',
        description: 'Large pothole in the road by the crosswalk on Main Street',
      });
      expect(dup).not.toBeNull();
      expect(dup!.id).toBe('11111111-1111-1111-1111-111111111111');

      const far = await findDuplicate(pool, {
        category: 'roads',
        latitude: 30.3,
        longitude: -97.78,
        title: 'Big pothole on Main St near crosswalk',
        description: 'Large pothole in the road by the crosswalk on Main Street',
      });
      expect(far).toBeNull();

      const otherCat = await findDuplicate(pool, {
        category: 'water',
        latitude: 30.2675,
        longitude: -97.7433,
        title: 'Big pothole on Main St near crosswalk',
        description: 'Large pothole in the road by the crosswalk on Main Street',
      });
      expect(otherCat).toBeNull();

      const dissimilar = await findDuplicate(pool, {
        category: 'roads',
        latitude: 30.2675,
        longitude: -97.7433,
        title: 'Completely unrelated fallen tree',
        description: 'A tree fell in the park during the storm last night',
      });
      expect(dissimilar).toBeNull();
    } finally {
      await pool.end();
    }
  });
});
