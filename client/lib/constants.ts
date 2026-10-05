// CivicLens domain constants: categories, statuses, departments, colors.
// Matches the API contract in PLAN.md §4.

export type Category =
  | 'roads'
  | 'streetlights'
  | 'waste'
  | 'water'
  | 'parks'
  | 'safety'
  | 'other';

export type Status = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';

export const CATEGORIES: { id: Category; label: string; hint: string }[] = [
  { id: 'roads', label: 'Roads & Potholes', hint: 'Potholes, cracked pavement, damaged sidewalks' },
  { id: 'streetlights', label: 'Streetlights', hint: 'Out, flickering, or damaged streetlights' },
  { id: 'waste', label: 'Waste & Sanitation', hint: 'Garbage dumps, overflowing bins, litter' },
  { id: 'water', label: 'Water', hint: 'Leaks, waterlogging, drainage, supply issues' },
  { id: 'parks', label: 'Parks & Trees', hint: 'Fallen trees, broken benches, park upkeep' },
  { id: 'safety', label: 'Public Safety', hint: 'Unsafe spots, broken signals, hazards' },
  { id: 'other', label: 'Other', hint: 'Anything else affecting your neighborhood' },
];

export const CATEGORY_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<Category, string>;

export const CATEGORY_HINT: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.hint]),
) as Record<Category, string>;

// Category -> department routing (PLAN.md §4)
export const CATEGORY_DEPARTMENT: Record<Category, string> = {
  roads: 'Public Works Department',
  streetlights: 'Power & Lighting Department',
  waste: 'Sanitation Department',
  water: 'Water Authority',
  parks: 'Parks & Recreation',
  safety: 'Public Safety Office',
  other: 'General Services',
};

export const STATUSES: { id: Status; label: string; blurb: string }[] = [
  { id: 'reported', label: 'Reported', blurb: 'Received and waiting for review' },
  { id: 'acknowledged', label: 'Acknowledged', blurb: 'Seen by the city team' },
  { id: 'in_progress', label: 'In Progress', blurb: 'A crew is on it' },
  { id: 'resolved', label: 'Resolved', blurb: 'Fixed and verified' },
];

export const STATUS_LABEL: Record<Status, string> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s.label]),
) as Record<Status, string>;

// Pin / badge colors per status (also used on the map)
export const STATUS_COLOR: Record<Status, string> = {
  reported: '#d97706', // amber-600
  acknowledged: '#2563eb', // blue-600
  in_progress: '#7c3aed', // violet-600
  resolved: '#059669', // emerald-600
};

export const STATUS_BG: Record<Status, string> = {
  reported: 'bg-amber-50 text-amber-800 ring-amber-200',
  acknowledged: 'bg-blue-50 text-blue-800 ring-blue-200',
  in_progress: 'bg-violet-50 text-violet-800 ring-violet-200',
  resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export const CATEGORY_COLOR: Record<Category, string> = {
  roads: '#b45309',
  streetlights: '#ca8a04',
  waste: '#15803d',
  water: '#0284c7',
  parks: '#16a34a',
  safety: '#dc2626',
  other: '#64748b',
};

export type SortKey = 'newest' | 'priority' | 'upvotes';

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'priority', label: 'Highest priority' },
  { id: 'upvotes', label: 'Most upvoted' },
];

// Default map view: Austin, TX (where the sample reports live)
export const DEFAULT_CENTER: [number, number] = [30.2672, -97.7431];
export const DEFAULT_ZOOM = 12;

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
