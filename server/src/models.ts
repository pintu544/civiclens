/** DB row <-> API JSON mapping (snake_case DB, camelCase API). */

export interface ReportRow {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: number;
  severity_rationale: string | null;
  department: string;
  status: string;
  latitude: number;
  longitude: number;
  address: string | null;
  photo_url: string | null;
  reporter_name: string;
  priority_score: number;
  upvotes: number;
  is_sample: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ReportJson {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: number;
  severityRationale: string | null;
  department: string;
  status: string;
  latitude: number;
  longitude: number;
  address: string | null;
  photoUrl: string | null;
  reporterName: string;
  priorityScore: number;
  upvotes: number;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toReportJson(r: ReportRow): ReportJson {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    severity: Number(r.severity),
    severityRationale: r.severity_rationale,
    department: r.department,
    status: r.status,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    address: r.address,
    photoUrl: r.photo_url,
    reporterName: r.reporter_name,
    priorityScore: Number(r.priority_score),
    upvotes: Number(r.upvotes),
    isSample: Boolean(r.is_sample),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export interface HistoryRow {
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: Date | string;
}

export interface HistoryJson {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export function toHistoryJson(h: HistoryRow): HistoryJson {
  return {
    fromStatus: h.from_status,
    toStatus: h.to_status,
    note: h.note,
    createdAt: new Date(h.created_at).toISOString(),
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
