// Small client-side utilities.

const VOTER_KEY_LS = 'civiclens_voter_key';
const VOTED_LS = 'civiclens_voted_ids';

/** Stable anonymous voter identity, generated once and persisted. */
export function getVoterKey(): string {
  if (typeof window === 'undefined') return '';
  let key = window.localStorage.getItem(VOTER_KEY_LS);
  if (!key) {
    key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VOTER_KEY_LS, key);
  }
  return key;
}

export function hasVoted(reportId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ids: string[] = JSON.parse(window.localStorage.getItem(VOTED_LS) || '[]');
    return ids.includes(reportId);
  } catch {
    return false;
  }
}

export function markVoted(reportId: string) {
  if (typeof window === 'undefined') return;
  try {
    const ids: string[] = JSON.parse(window.localStorage.getItem(VOTED_LS) || '[]');
    if (!ids.includes(reportId)) {
      ids.push(reportId);
      window.localStorage.setItem(VOTED_LS, JSON.stringify(ids));
    }
  } catch {
    /* ignore */
  }
}

/** "2h ago", "3d ago", … */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

/** Shorten "123 Main St, Austin, TX 78701, USA" -> "123 Main St, Austin" */
export function shortAddress(address: string | null | undefined): string {
  if (!address) return 'Location pinned on map';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(', ');
}

/** Severity label for the 1-5 meter. */
export function severityLabel(sev: number): string {
  if (sev >= 5) return 'Critical';
  if (sev === 4) return 'High';
  if (sev === 3) return 'Moderate';
  if (sev === 2) return 'Low';
  return 'Minor';
}

export function severityColor(sev: number): string {
  if (sev >= 4) return '#dc2626';
  if (sev === 3) return '#d97706';
  return '#059669';
}

/** Haversine distance in km. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Read the report id from the current URL path (e.g. /reports/<id>/).
 * The detail page is statically exported, so we parse window.location
 * instead of relying on prerendered route params.
 */
export function idFromPathname(): string | null {
  if (typeof window === 'undefined') return null;
  const segs = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // ['', 'reports', '<id>'] -> last segment; also tolerate '/reports/<id>/' variants
  const idx = segs.lastIndexOf('reports');
  if (idx === -1 || idx + 1 >= segs.length) return null;
  return decodeURIComponent(segs[idx + 1]);
}
