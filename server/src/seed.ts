import crypto from 'crypto';
import { getPool, closePool } from './db';
import { departmentForCategory, type Category } from './triage';
import { computePriorityScore } from './priority';
import type { Status } from './triage';

/**
 * Seed script: inserts 16 realistic sample reports around Austin, TX.
 * `npm run seed`. All rows carry is_sample=true. Idempotent-ish: if any
 * sample reports already exist, the script skips instead of duplicating.
 */

interface SeedHistory {
  from: Status | null;
  to: Status;
  note: string;
  daysAgo: number;
}

interface SeedReport {
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  category: Category;
  severity: number;
  severityRationale: string;
  status: Status;
  upvotes: number;
  reporterName: string;
  daysAgoCreated: number;
  history: SeedHistory[];
}

export const SEED_REPORTS: SeedReport[] = [
  {
    title: 'Large pothole on Guadalupe St near 24th',
    description:
      'A deep pothole roughly two feet wide has opened up in the right lane of Guadalupe St just south of 24th St. Cars are swerving into the bike lane to avoid it, and it got noticeably worse after last week\u2019s rain.',
    address: '2400 Guadalupe St, Austin, TX 78705',
    latitude: 30.2845,
    longitude: -97.7412,
    category: 'roads',
    severity: 4,
    severityRationale:
      'A two-foot-wide pothole forcing cars into the bike lane is a serious collision risk.',
    status: 'reported',
    upvotes: 12,
    reporterName: 'Maya R.',
    daysAgoCreated: 2,
    history: [],
  },
  {
    title: 'Streetlight out at the corner of 6th and Congress',
    description:
      'The streetlight on the southwest corner of E 6th St and Congress Ave has been out for over a week. The intersection feels unsafe to cross after dark, especially for pedestrians coming from the bus stop.',
    address: '600 Congress Ave, Austin, TX 78701',
    latitude: 30.2674,
    longitude: -97.7433,
    category: 'streetlights',
    severity: 3,
    severityRationale:
      'A dark major intersection for over a week meaningfully raises nighttime pedestrian risk.',
    status: 'acknowledged',
    upvotes: 7,
    reporterName: 'Anonymous',
    daysAgoCreated: 9,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Crew scheduled to inspect the fixture this week.', daysAgo: 7 },
    ],
  },
  {
    title: 'Overflowing dumpster behind food trucks on S Congress',
    description:
      'The shared dumpster behind the food truck lot on South Congress is overflowing and trash is blowing into the parking lot and onto the sidewalk. The smell gets bad in the afternoons and it is attracting rats at night.',
    address: '1500 S Congress Ave, Austin, TX 78704',
    latitude: 30.2498,
    longitude: -97.7492,
    category: 'waste',
    severity: 3,
    severityRationale:
      'Overflowing commercial waste spreading into public areas is a moderate sanitation issue.',
    status: 'reported',
    upvotes: 5,
    reporterName: 'Daniel K.',
    daysAgoCreated: 1,
    history: [],
  },
  {
    title: 'Burst water pipe flooding sidewalk on E 11th',
    description:
      'A water main appears to have burst near E 11th St \u2014 water is gushing onto the sidewalk and pooling across the bike lane. It has been flowing for at least two hours and the pressure looks strong enough to undermine the pavement.',
    address: '1100 E 11th St, Austin, TX 78702',
    latitude: 30.2603,
    longitude: -97.7104,
    category: 'water',
    severity: 5,
    severityRationale:
      'An actively gushing water main is an urgent hazard wasting water and threatening the roadbed.',
    status: 'in_progress',
    upvotes: 23,
    reporterName: 'Priya S.',
    daysAgoCreated: 4,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Water Authority notified, emergency crew dispatched.', daysAgo: 4 },
      { from: 'acknowledged', to: 'in_progress', note: 'Crew on site, shutting off the main before repair.', daysAgo: 3 },
    ],
  },
  {
    title: 'Broken swing set at Zilker Park playground',
    description:
      'One of the swings at the Zilker Park playground has a snapped chain and is hanging at an angle. Kids were still trying to use it this morning, which looks like an accident waiting to happen.',
    address: '2207 Lou Neff Rd, Austin, TX 78746',
    latitude: 30.2671,
    longitude: -97.7725,
    category: 'parks',
    severity: 2,
    severityRationale:
      'A single broken swing is a minor but real injury risk in a busy playground.',
    status: 'reported',
    upvotes: 4,
    reporterName: 'Anonymous',
    daysAgoCreated: 1,
    history: [],
  },
  {
    title: 'Poorly lit trail section near Barton Springs',
    description:
      'The hike-and-bike trail segment just east of Barton Springs is completely dark at night \u2014 several lights are out and the path surface is uneven. Runners have tripped here, and it feels unsafe for anyone out after sunset.',
    address: 'Barton Springs Rd, Austin, TX 78746',
    latitude: 30.2665,
    longitude: -97.7698,
    category: 'safety',
    severity: 4,
    severityRationale:
      'A pitch-dark, uneven trail used by night runners is a serious personal-safety and injury risk.',
    status: 'acknowledged',
    upvotes: 15,
    reporterName: 'Jordan T.',
    daysAgoCreated: 12,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Lighting crew assigned; waiting on replacement fixtures.', daysAgo: 10 },
    ],
  },
  {
    title: 'Faded crosswalk paint at Hyde Park Elementary crossing',
    description:
      'The crosswalk markings in front of the school on Avenue G have almost completely faded. Drivers do not seem to notice the crossing anymore during morning drop-off, and the crossing guard says it gets scary.',
    address: '4000 Avenue G, Austin, TX 78751',
    latitude: 30.3143,
    longitude: -97.7227,
    category: 'roads',
    severity: 2,
    severityRationale:
      'Faded school-zone markings are a minor issue with outsized importance during drop-off hours.',
    status: 'resolved',
    upvotes: 9,
    reporterName: 'Sofia M.',
    daysAgoCreated: 20,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Added to the striping work list.', daysAgo: 18 },
      { from: 'acknowledged', to: 'in_progress', note: 'Striping crew on site this morning.', daysAgo: 15 },
      { from: 'in_progress', to: 'resolved', note: 'Crosswalk repainted with high-visibility markings.', daysAgo: 14 },
    ],
  },
  {
    title: 'Clogged storm drain causing pooling on Duval St',
    description:
      'The storm drain at the corner of Duval St and 45th is clogged with leaves and debris. After rain the water pools across the whole lane and takes hours to clear, forcing cyclists into car traffic.',
    address: '4500 Duval St, Austin, TX 78751',
    latitude: 30.3139,
    longitude: -97.7231,
    category: 'water',
    severity: 3,
    severityRationale:
      'A clogged drain that floods a full lane after rain is a moderate hazard, especially for cyclists.',
    status: 'reported',
    upvotes: 6,
    reporterName: 'Anonymous',
    daysAgoCreated: 3,
    history: [],
  },
  {
    title: 'Illegal dumping site under I-35 overpass',
    description:
      'Someone has dumped mattresses, tires, and construction debris under the I-35 overpass near 51st St. The pile has been growing for weeks and is now blocking part of the service road shoulder.',
    address: 'E 51st St & I-35 Frontage Rd, Austin, TX 78723',
    latitude: 30.3128,
    longitude: -97.7089,
    category: 'waste',
    severity: 4,
    severityRationale:
      'A growing pile of mattresses and tires blocking a road shoulder is a serious sanitation and traffic hazard.',
    status: 'in_progress',
    upvotes: 18,
    reporterName: 'Marcus L.',
    daysAgoCreated: 16,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Code enforcement opened a case.', daysAgo: 14 },
      { from: 'acknowledged', to: 'in_progress', note: 'Cleanup crew scheduled; bulky items need a special truck.', daysAgo: 11 },
    ],
  },
  {
    title: 'Flickering streetlight on South Congress',
    description:
      'The streetlight in front of the coffee shop on S Congress flickers constantly after 9pm. It is more of a nuisance than a hazard, but it has been doing it for a month and it strobes right into the patio seating.',
    address: '1600 S Congress Ave, Austin, TX 78704',
    latitude: 30.2502,
    longitude: -97.7488,
    category: 'streetlights',
    severity: 2,
    severityRationale:
      'A flickering light is a minor nuisance with no immediate safety impact.',
    status: 'resolved',
    upvotes: 3,
    reporterName: 'Elena V.',
    daysAgoCreated: 25,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Fixture added to the maintenance queue.', daysAgo: 23 },
      { from: 'acknowledged', to: 'in_progress', note: 'Technician replacing the ballast today.', daysAgo: 21 },
      { from: 'in_progress', to: 'resolved', note: 'Ballast replaced; light steady as of last night.', daysAgo: 20 },
    ],
  },
  {
    title: 'Fallen tree blocking trail at Zilker',
    description:
      'A large oak limb came down across the main trail loop near the Zilker botanical garden entrance during the storm. Walkers are having to climb over it or go around through the mud, and it is blocking the accessible path completely.',
    address: 'Zilker Park, Austin, TX 78746',
    latitude: 30.2667,
    longitude: -97.7719,
    category: 'parks',
    severity: 3,
    severityRationale:
      'A blocked accessible trail forces detours through mud \u2014 a moderate disruption for park users.',
    status: 'acknowledged',
    upvotes: 11,
    reporterName: 'Anonymous',
    daysAgoCreated: 6,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Parks crew notified; chainsaw team assigned.', daysAgo: 5 },
    ],
  },
  {
    title: 'Damaged guardrail on Mopac exit ramp',
    description:
      'The guardrail on the Mopac southbound exit at Barton Skyway is bent inward after a crash and the reflective panels are gone. Cars exiting at speed have very little margin for error here, especially at night.',
    address: 'Mopac Expy & Barton Skyway, Austin, TX 78746',
    latitude: 30.2789,
    longitude: -97.7821,
    category: 'safety',
    severity: 5,
    severityRationale:
      'A destroyed guardrail on a high-speed exit ramp is an urgent, life-safety hazard.',
    status: 'reported',
    upvotes: 21,
    reporterName: 'Chris B.',
    daysAgoCreated: 1,
    history: [],
  },
  {
    title: 'Deep cracks forming on Manor Rd bike lane',
    description:
      'Long cracks have opened along the bike lane on Manor Rd east of downtown. The surface is uneven enough that my front wheel caught yesterday and I nearly went over the handlebars.',
    address: '2100 Manor Rd, Austin, TX 78722',
    latitude: 30.2812,
    longitude: -97.7198,
    category: 'roads',
    severity: 3,
    severityRationale:
      'Cracks deep enough to catch a bike wheel are a moderate injury risk for cyclists.',
    status: 'reported',
    upvotes: 8,
    reporterName: 'Anonymous',
    daysAgoCreated: 5,
    history: [],
  },
  {
    title: 'Slow leak from fire hydrant on Guadalupe',
    description:
      'The fire hydrant at the corner of Guadalupe and 29th has a slow but steady leak. There is a constant small stream running into the gutter; it seems wasteful and the sidewalk stays slick.',
    address: '2900 Guadalupe St, Austin, TX 78705',
    latitude: 30.2951,
    longitude: -97.7418,
    category: 'water',
    severity: 2,
    severityRationale:
      'A slow hydrant leak wastes water but poses no immediate hazard \u2014 a minor issue.',
    status: 'resolved',
    upvotes: 2,
    reporterName: 'Nadia F.',
    daysAgoCreated: 18,
    history: [
      { from: 'reported', to: 'acknowledged', note: 'Water Authority confirmed the leak.', daysAgo: 17 },
      { from: 'acknowledged', to: 'in_progress', note: 'Valve replacement in progress.', daysAgo: 16 },
      { from: 'in_progress', to: 'resolved', note: 'Valve replaced, hydrant sealed and tested.', daysAgo: 15 },
    ],
  },
  {
    title: 'Graffiti covering bus stop shelter downtown',
    description:
      'The bus stop shelter at 7th and Congress is covered in graffiti tags, including on the route map glass so you cannot read the schedule. It makes the stop feel neglected.',
    address: '700 Congress Ave, Austin, TX 78701',
    latitude: 30.2689,
    longitude: -97.7439,
    category: 'other',
    severity: 2,
    severityRationale:
      'Graffiti obscuring transit information is a minor livability issue.',
    status: 'reported',
    upvotes: 5,
    reporterName: 'Anonymous',
    daysAgoCreated: 2,
    history: [],
  },
  {
    title: 'Irrigation leak flooding Zilker volleyball courts',
    description:
      'A broken irrigation head near the Zilker volleyball courts has been spraying nonstop for days. The courts are waterlogged, the surrounding grass is turning to mud, and it is clearly wasting a lot of water.',
    address: 'Zilker Park, Austin, TX 78746',
    latitude: 30.2659,
    longitude: -97.7731,
    category: 'parks',
    severity: 4,
    severityRationale:
      'A continuously spraying broken irrigation head wastes significant water and has ruined the courts.',
    status: 'reported',
    upvotes: 7,
    reporterName: 'Tom H.',
    daysAgoCreated: 3,
    history: [],
  },
];

export interface SeedResult {
  inserted: number;
  skipped: boolean;
}

export async function runSeed(): Promise<SeedResult> {
  const pool = getPool();
  const existing = await pool.query('SELECT count(*)::int AS n FROM reports WHERE is_sample = true');
  if (existing.rows[0].n > 0) {
    return { inserted: 0, skipped: true };
  }

  const now = Date.now();
  for (const s of SEED_REPORTS) {
    const createdAt = new Date(now - s.daysAgoCreated * 86_400_000);
    const id = crypto.randomUUID();
    const priorityScore = computePriorityScore({
      severity: s.severity,
      upvotes: s.upvotes,
      createdAt,
      category: s.category,
    });
    await pool.query(
      `INSERT INTO reports
         (id, title, description, category, severity, severity_rationale, department,
          status, latitude, longitude, address, photo_url, reporter_name,
          priority_score, upvotes, is_sample, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16,$16)`,
      [
        id,
        s.title,
        s.description,
        s.category,
        s.severity,
        s.severityRationale,
        departmentForCategory(s.category),
        s.status,
        s.latitude,
        s.longitude,
        s.address,
        null,
        s.reporterName,
        priorityScore,
        s.upvotes,
        createdAt.toISOString(),
      ]
    );
    // Initial "reported" history entry.
    await pool.query(
      'INSERT INTO status_history (id, report_id, from_status, to_status, note, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), id, null, 'reported', null, createdAt.toISOString()]
    );
    // Status transitions from the seed data.
    for (const h of s.history) {
      await pool.query(
        'INSERT INTO status_history (id, report_id, from_status, to_status, note, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          crypto.randomUUID(),
          id,
          h.from,
          h.to,
          h.note,
          new Date(now - h.daysAgo * 86_400_000).toISOString(),
        ]
      );
    }
    // Keep updated_at realistic: last transition (or creation) time.
    const lastEventDaysAgo =
      s.history.length > 0 ? Math.min(...s.history.map((h) => h.daysAgo)) : s.daysAgoCreated;
    await pool.query('UPDATE reports SET updated_at = $1 WHERE id = $2', [
      new Date(now - lastEventDaysAgo * 86_400_000).toISOString(),
      id,
    ]);
  }
  return { inserted: SEED_REPORTS.length, skipped: false };
}

// Allow `npm run seed` (tsx src/seed.ts) to execute directly.
const invokedDirectly =
  process.argv[1] !== undefined && /seed\.(ts|js)$/.test(process.argv[1]);

if (invokedDirectly) {
  runSeed()
    .then(async (r) => {
      if (r.skipped) {
        console.log('[seed] Sample reports already present — skipping (idempotent).');
      } else {
        console.log(`[seed] Inserted ${r.inserted} sample reports around Austin, TX (is_sample=true).`);
      }
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[seed] Failed:', err);
      await closePool();
      process.exit(1);
    });
}
