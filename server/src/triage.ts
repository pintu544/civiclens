/**
 * AI triage for CivicLens.
 *
 * Primary: FastRouter (OpenAI-compatible chat completions),
 * with a 20s timeout and 1 retry. Defensive JSON parsing; ANY failure falls
 * back to the transparent keyword heuristic below — never throws.
 */

import { tokenize } from './dedup';

export type Category =
  | 'roads'
  | 'streetlights'
  | 'waste'
  | 'water'
  | 'parks'
  | 'safety'
  | 'other';

export const CATEGORIES: Category[] = [
  'roads',
  'streetlights',
  'waste',
  'water',
  'parks',
  'safety',
  'other',
];

export const STATUSES = [
  'reported',
  'acknowledged',
  'in_progress',
  'resolved',
] as const;
export type Status = (typeof STATUSES)[number];

export interface Department {
  id: string;
  name: string;
  categories: Category[];
}

export const DEPARTMENTS: Department[] = [
  { id: 'public-works', name: 'Public Works Department', categories: ['roads'] },
  { id: 'power-lighting', name: 'Power & Lighting Department', categories: ['streetlights'] },
  { id: 'sanitation', name: 'Sanitation Department', categories: ['waste'] },
  { id: 'water-authority', name: 'Water Authority', categories: ['water'] },
  { id: 'parks-recreation', name: 'Parks & Recreation', categories: ['parks'] },
  { id: 'public-safety', name: 'Public Safety Office', categories: ['safety'] },
  { id: 'general-services', name: 'General Services', categories: ['other'] },
];

const CATEGORY_TO_DEPARTMENT: Record<Category, string> = {
  roads: 'Public Works Department',
  streetlights: 'Power & Lighting Department',
  waste: 'Sanitation Department',
  water: 'Water Authority',
  parks: 'Parks & Recreation',
  safety: 'Public Safety Office',
  other: 'General Services',
};

export function departmentForCategory(category: Category): string {
  return CATEGORY_TO_DEPARTMENT[category];
}

export type TriageProvider = 'llm' | 'heuristic';

export interface TriageResult {
  provider: TriageProvider;
  category: Category;
  severity: number; // 1..5
  severityRationale: string;
  department: string;
}

export interface TriageInput {
  title: string;
  description: string;
  hasPhoto: boolean;
}

/** Which provider is active right now (no network call). */
export function aiProviderActive(): TriageProvider {
  return process.env.LLM_API_KEY ? 'llm' : 'heuristic';
}

// ---------------------------------------------------------------------------
// LLM primary (FastRouter, OpenAI-compatible)
// ---------------------------------------------------------------------------

const LLM_BASE_URL = (
  process.env.LLM_BASE_URL ?? 'https://api.fastrouter.ai/api/v1'
).replace(/\/$/, '');
const LLM_CHAT_URL = `${LLM_BASE_URL}/chat/completions`;
const LLM_MODEL = process.env.LLM_MODEL ?? 'anthropic/claude-opus-4.7';
const LLM_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT = [
  'You are the AI triage engine for CivicLens, a civic issue-reporting platform.',
  'Given a resident report (title + description, plus whether a photo was attached),',
  'classify it into exactly one category: roads, streetlights, waste, water, parks, safety, other.',
  'Score severity as an integer 1-5:',
  '1 = minor cosmetic issue, 2 = minor functional issue, 3 = moderate issue affecting daily use,',
  '4 = serious issue, safety risk or major disruption, 5 = urgent hazard needing immediate attention.',
  'Write a one-sentence severity rationale referencing specifics from the report.',
  'Respond with ONLY a JSON object, no markdown, no extra text:',
  '{"category": "<one of the 7>", "severity": <1-5>, "severityRationale": "<one sentence>"}.',
  'Category guide: roads = potholes, damaged roads, sidewalks, crosswalks, guardrails;',
  'streetlights = broken/flickering/out street lighting; waste = garbage, litter, illegal dumping, overflowing bins;',
  'water = leaks, burst pipes, flooding, clogged drains, hydrants; parks = playgrounds, trails, trees, park facilities;',
  'safety = hazards, accidents, crime, unsafe conditions; other = anything else.',
].join(' ');

function stripCodeFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

async function postLlm(apiKey: string, payload: object): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(LLM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('LLM returned empty content');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function parseLlmTriage(content: string): Omit<TriageResult, 'provider'> {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(stripCodeFences(content)) as Record<string, unknown>;
  } catch {
    throw new Error('LLM response was not valid JSON');
  }
  const category = String(obj.category ?? '').toLowerCase().trim() as Category;
  if (!CATEGORIES.includes(category)) {
    throw new Error(`LLM returned unknown category: ${String(obj.category)}`);
  }
  const severity = Number(obj.severity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    throw new Error(`LLM returned invalid severity: ${String(obj.severity)}`);
  }
  const rationale = String(
    obj.severityRationale ?? obj.rationale ?? ''
  ).trim();
  if (!rationale) {
    throw new Error('LLM returned empty severity rationale');
  }
  return {
    category,
    severity,
    severityRationale: rationale,
    // Department is always derived server-side from the category map,
    // never trusted from the model.
    department: departmentForCategory(category),
  };
}

async function triageWithLlm(
  input: TriageInput,
  apiKey: string
): Promise<TriageResult> {
  const payload = {
    model: LLM_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Title: ${input.title}\nDescription: ${input.description}\nPhoto attached: ${
          input.hasPhoto ? 'yes' : 'no'
        }`,
      },
    ],
  };
  let lastErr: unknown = new Error('unknown');
  for (let attempt = 0; attempt < 2; attempt++) {
    // 1 retry: 2 attempts total
    try {
      const content = await postLlm(apiKey, payload);
      return { provider: 'llm', ...parseLlmTriage(content) };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Keyword-heuristic fallback (transparent, deterministic — not presented as AI)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  roads: [
    'pothole', 'potholes', 'road', 'roads', 'street', 'avenue', 'lane',
    'asphalt', 'curb', 'sidewalk', 'pavement', 'highway', 'intersection',
    'crosswalk', 'manhole', 'guardrail', 'speed bump', 'bike lane', 'ramp',
  ],
  streetlights: [
    'streetlight', 'streetlights', 'street light', 'lamp post', 'lamppost',
    'light pole', 'lighting', 'flickering light',
  ],
  waste: [
    'garbage', 'trash', 'dump', 'dumping', 'dumped', 'litter', 'waste',
    'refuse', 'debris', 'dumpster', 'overflowing bin', 'overflowing',
  ],
  water: [
    'water', 'leak', 'leaking', 'leaky', 'pipe', 'hydrant', 'sewer',
    'drain', 'drainage', 'flood', 'flooding', 'flooded', 'waterlogged',
    'burst', 'pooling', 'puddle', 'gushing',
  ],
  parks: [
    'park', 'playground', 'trail', 'tree', 'bench', 'benches', 'swing',
    'grass', 'court', 'garden', 'playground equipment',
  ],
  safety: [
    'unsafe', 'hazard', 'hazardous', 'dangerous', 'accident', 'crash',
    'crime', 'vandalism', 'suspicious', 'dark alley', 'unlit',
  ],
  other: [],
};

/** Tie-break order when several categories match the same number of keywords. */
const CATEGORY_TIEBREAK: Category[] = [
  'safety',
  'water',
  'roads',
  'streetlights',
  'waste',
  'parks',
  'other',
];

const URGENCY_WORDS = [
  'urgent',
  'dangerous',
  'flood',
  'accident',
  'blocked',
  'overflowing',
  'broken',
  'leak',
  'sparking',
];

const MINOR_WORDS = ['small', 'minor', 'slight'];

export function heuristicTriage(
  input: TriageInput
): Omit<TriageResult, 'provider'> {
  const text = `${input.title} ${input.description}`.toLowerCase();
  // Token-based matching for single-word keywords avoids substring collisions
  // (e.g. "street" matching inside "streetlight"); multi-word phrases match
  // as substrings.
  const tokens = tokenize(text);

  const matchedByCategory = new Map<Category, string[]>();
  for (const category of CATEGORIES) {
    const hits = CATEGORY_KEYWORDS[category].filter((kw) =>
      kw.includes(' ') ? text.includes(kw) : tokens.has(kw)
    );
    matchedByCategory.set(category, hits);
  }

  let category: Category = 'other';
  let bestHits = 0;
  for (const c of CATEGORY_TIEBREAK) {
    const n = matchedByCategory.get(c)!.length;
    if (n > bestHits) {
      bestHits = n;
      category = c;
    }
  }

  // Severity: base 3, +1 per pair of urgency hits, -1 for minor wording, clamped 1-5.
  const urgencyHits = URGENCY_WORDS.filter((w) => text.includes(w));
  const minorHits = MINOR_WORDS.filter((w) => text.includes(w));
  let severity = 3 + Math.floor(urgencyHits.length / 2);
  if (minorHits.length > 0) severity -= 1;
  severity = Math.min(5, Math.max(1, severity));

  const matched = matchedByCategory.get(category)!;
  const rationale =
    matched.length > 0
      ? `Heuristic match: keyword${matched.length > 1 ? 's' : ''} (${matched
          .slice(0, 4)
          .join(', ')}) point to "${category}"; severity ${severity}/5 from ${
          urgencyHits.length >= 2
            ? `urgency signals (${urgencyHits.slice(0, 3).join(', ')})`
            : minorHits.length > 0
              ? `minor-issue wording (${minorHits.slice(0, 2).join(', ')})`
              : 'no strong urgency signals'
        }.`
      : `Heuristic match: no category keywords found, defaulted to "other"; severity ${severity}/5 (base).`;

  return {
    category,
    severity,
    severityRationale: rationale,
    department: departmentForCategory(category),
  };
}

// ---------------------------------------------------------------------------

/**
 * Run triage. Uses the LLM (FastRouter) when LLM_API_KEY is set; any LLM failure
 * (network, timeout, bad JSON, invalid values) falls back to the keyword
 * heuristic. Never throws for triage reasons. Returns which provider was used.
 */
export async function triageReport(input: TriageInput): Promise<TriageResult> {
  const apiKey = process.env.LLM_API_KEY;
  if (apiKey) {
    try {
      return await triageWithLlm(input, apiKey);
    } catch (err) {
      console.warn(
        '[triage] LLM failed, using heuristic fallback:',
        err instanceof Error ? err.message : err
      );
    }
  }
  return { provider: 'heuristic', ...heuristicTriage(input) };
}
