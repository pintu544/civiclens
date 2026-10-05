// Typed client for the CivicLens REST API (PLAN.md §4).
// API base URL: same-origin by default (single-service Render deploy where the
// Express server mounts /api/* alongside the static export). When the frontend
// is hosted separately (e.g. Vercel), set NEXT_PUBLIC_API_URL to the backend
// origin (e.g. https://civiclens-xxxx.onrender.com). In dev, next.config
// rewrites /api/* to localhost:4000 so the browser stays same-origin (no CORS).

import type { Category, Status, SortKey } from './constants';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export interface Report {
  id: string;
  title: string;
  description: string;
  category: Category;
  severity: number; // 1-5
  severityRationale: string | null;
  department: string;
  status: Status;
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

export interface TriageResult {
  provider: 'llm' | 'heuristic';
  category: Category;
  severity: number;
  severityRationale: string;
  department: string;
  priorityScore: number;
}

export interface CreateReportResponse {
  merged: boolean;
  report: Report;
  triage?: TriageResult;
}

export interface StatusHistoryItem {
  fromStatus: Status | null;
  toStatus: Status;
  note: string | null;
  createdAt: string;
}

export interface ReportDetail {
  report: Report;
  history: StatusHistoryItem[];
  similar: Report[];
}

export interface Stats {
  totalReports: number;
  byStatus: Record<Status, number>;
  byCategory: Record<Category, number>;
  resolvedLast30Days: number;
  avgDaysToResolve: number | null;
  reportsThisWeek: number;
}

export interface Department {
  id: string;
  name: string;
  categories: Category[];
}

export interface CreateReportInput {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  photoUrl?: string;
  reporterName?: string;
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string; message?: string } | null)?.error ||
      (data as { error?: string; message?: string } | null)?.message ||
      `Request failed (${res.status})`;
    const fields = (data as { fields?: Record<string, string> } | null)?.fields;
    throw new ApiError(res.status, msg, fields);
  }
  return data as T;
}

export interface ReportQuery {
  status?: Status | '';
  category?: Category | '';
  sort?: SortKey;
  q?: string;
  limit?: number;
  offset?: number;
  bbox?: string;
}

export function fetchReports(query: ReportQuery = {}) {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.sort) params.set('sort', query.sort);
  if (query.q) params.set('q', query.q);
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  if (query.bbox) params.set('bbox', query.bbox);
  const qs = params.toString();
  return request<{ reports: Report[]; total: number; limit: number; offset: number }>(
    `/api/reports${qs ? `?${qs}` : ''}`,
  );
}

export function fetchReport(id: string) {
  return request<ReportDetail>(`/api/reports/${encodeURIComponent(id)}`);
}

export function createReport(input: CreateReportInput) {
  return request<CreateReportResponse>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function upvoteReport(id: string, voterKey: string) {
  return request<{ upvotes: number; priorityScore: number }>(
    `/api/reports/${encodeURIComponent(id)}/upvote`,
    { method: 'POST', body: JSON.stringify({ voterKey }) },
  );
}

export function fetchStats() {
  return request<Stats>('/api/stats');
}

export function fetchDepartments() {
  return request<{ departments: Department[] }>('/api/departments');
}

export function fetchHealth() {
  return request<{ ok: boolean; db: string; ai: string; version: string }>('/api/health');
}
