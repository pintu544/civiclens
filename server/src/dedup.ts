import type { Pool } from 'pg';
import type { Category } from './triage';
import type { ReportRow } from './models';

/**
 * Duplicate detection (PLAN §5):
 * candidates = last-30-day reports, same category, haversine ≤ 0.4 km;
 * Jaccard similarity on lowercased alphanumeric token sets of
 * title+description ≥ 0.4 → duplicate of the best match.
 */

export const DEDUP_RADIUS_KM = 0.4;
export const DEDUP_JACCARD_THRESHOLD = 0.4;
export const DEDUP_WINDOW_DAYS = 30;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DedupInput {
  category: Category;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
}

/** Return the existing report this input duplicates, or null. */
export async function findDuplicate(
  pool: Pool,
  input: DedupInput
): Promise<ReportRow | null> {
  const cutoff = new Date(
    Date.now() - DEDUP_WINDOW_DAYS * 86_400_000
  ).toISOString();
  const { rows } = await pool.query<ReportRow>(
    'SELECT * FROM reports WHERE category = $1 AND created_at >= $2',
    [input.category, cutoff]
  );
  const text = `${input.title} ${input.description}`;
  let best: ReportRow | null = null;
  let bestScore = 0;
  for (const row of rows as ReportRow[]) {
    if (
      haversineKm(input.latitude, input.longitude, row.latitude, row.longitude) >
      DEDUP_RADIUS_KM
    ) {
      continue;
    }
    const score = jaccardSimilarity(text, `${row.title} ${row.description}`);
    if (score >= DEDUP_JACCARD_THRESHOLD && score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}
