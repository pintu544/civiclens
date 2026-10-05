'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, fetchReports, type Report } from '@/lib/api';
import { CATEGORIES, SORT_OPTIONS, STATUSES } from '@/lib/constants';
import type { Category, SortKey, Status } from '@/lib/constants';
import { ReportCard } from './ReportCard';
import { EmptyState, ErrorState, LoadingSpinner } from './states';

const PAGE_SIZE = 12;

export function ReportsClient() {
  const [status, setStatus] = useState<Status | ''>('');
  const [category, setCategory] = useState<Category | ''>('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useMemo(
    () => ({ status, category, sort, q: q.trim() || undefined }),
    [status, category, sort, q],
  );

  const load = useCallback(
    async (fresh: boolean) => {
      const off = fresh ? 0 : offset;
      if (fresh) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await fetchReports({ ...query, limit: PAGE_SIZE, offset: off });
        setReports((prev) => (fresh ? res.reports : [...prev, ...res.reports]));
        setTotal(res.total);
        setOffset(off + res.reports.length);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load reports.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, offset],
  );

  // Reload from scratch when filters change
  useEffect(() => {
    setOffset(0);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQ(qInput), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [qInput]);

  const hasMore = reports.length < total;
  const activeFilters = [status, category, q.trim()].filter(Boolean).length;

  const clearAll = () => {
    setStatus('');
    setCategory('');
    setQInput('');
    setQ('');
    setSort('newest');
  };

  const selectClass =
    'rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-civic-500 focus:outline-none focus:ring-2 focus:ring-civic-200';

  return (
    <div>
      {/* Filter bar */}
      <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search reports — “pothole”, “Main St”…"
              aria-label="Search reports"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-civic-500 focus:outline-none focus:ring-2 focus:ring-civic-200"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as Status | '')} aria-label="Filter by status" className={selectClass}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category | '')} aria-label="Filter by category" className={selectClass}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort reports" className={selectClass}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {activeFilters > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500">
              {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
            </p>
            <button onClick={clearAll} className="text-xs font-bold text-civic-600 hover:text-civic-700 hover:underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <LoadingSpinner label="Loading reports…" />
        ) : error ? (
          <ErrorState title="Could not load reports" body={error} onRetry={() => load(true)} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports match"
            body={
              activeFilters > 0
                ? 'Try widening your filters — or be the first to report this kind of issue in your neighborhood.'
                : 'Nobody has reported an issue yet. Be the first — it takes thirty seconds.'
            }
            action={
              activeFilters > 0 ? (
                <button onClick={clearAll} className="rounded-full bg-civic-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-civic-700">
                  Clear filters
                </button>
              ) : (
                <Link href="/report/" className="rounded-full bg-civic-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-civic-700">
                  Report an issue
                </Link>
              )
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500" aria-live="polite">
              Showing <strong className="text-slate-800">{reports.length}</strong> of{' '}
              <strong className="text-slate-800">{total}</strong> reports
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-bold text-civic-700 shadow-card ring-1 ring-slate-200 transition hover:bg-civic-50 disabled:opacity-60"
                >
                  {loadingMore && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-civic-200 border-t-civic-600" aria-hidden="true" />
                  )}
                  {loadingMore ? 'Loading…' : `Load more (${total - reports.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
