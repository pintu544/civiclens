import type { Category } from './triage';

/**
 * Public priority score (PLAN §4):
 *   severity*20 + min(upvotes,25)*2 + max(0, 10 - daysOld) + categoryWeight
 * rounded to 1 decimal. Recomputed on create, upvote, and status change.
 */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  safety: 15,
  water: 10,
  roads: 8,
  streetlights: 6,
  waste: 5,
  parks: 3,
  other: 2,
};

export interface PriorityInput {
  severity: number;
  upvotes: number;
  createdAt: Date | string;
  category: Category;
}

export function computePriorityScore(input: PriorityInput): number {
  const daysOld =
    (Date.now() - new Date(input.createdAt).getTime()) / 86_400_000;
  const raw =
    input.severity * 20 +
    Math.min(input.upvotes, 25) * 2 +
    Math.max(0, 10 - daysOld) +
    (CATEGORY_WEIGHTS[input.category] ?? CATEGORY_WEIGHTS.other);
  return Math.round(raw * 10) / 10;
}
