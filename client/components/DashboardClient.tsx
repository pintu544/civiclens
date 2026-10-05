'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, fetchReports, fetchStats, type Report, type Stats } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/constants';
import { shortAddress, timeAgo } from '@/lib/utils';
import { StatusBadge } from './badges';
import { CategoryBarChart, StatusDonut } from './Charts';
import { EmptyState, ErrorState, LoadingSpinner } from './states';

interface AreaStat {
  key: string;
  count: number;
  label: string;
  sample: Report;
}

/** Group reports into ~1 km grid cells; label each cell by its most common short address. */
function topAreas(reports: Report[], n = 5): AreaStat[] {
  const cell = 0.01; // ~1.1 km
  const cells = new Map<string, Report[]>();
  for (const r of reports) {
    const key = `${Math.floor(r.latitude / cell)}:${Math.floor(r.longitude / cell)}`;
    const list = cells.get(key);
    if (list) list.push(r);
    else cells.set(key, [r]);
  }
  const areas: AreaStat[] = [...cells.entries()].map(([key, list]) => {
    const freq = new Map<string, number>();
    for (const r of list) {
      const label = shortAddress(r.address);
      freq.set(label, (freq.get(label) ?? 0) + 1);
    }
    const label = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Area';
    return { key, count: list.length, label, sample: list[0] };
  });
  return areas.sort((a, b) => b.count - a.count).slice(0, n);
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchStats(), fetchReports({ limit: 100, sort: 'newest' })])
      .then(([s, r]) => {
        if (!alive) return;
        setStats(s);
        setReports(r.reports);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : 'Could not load dashboard data.');
      });
    return () => {
      alive = false;
    };
  }, []);

  const areas = useMemo(() => (reports ? topAreas(reports) : []), [reports]);
  const recentActivity = useMemo(() => (reports ? reports.slice(0, 8) : []), [reports]);

  if (error) {
    return <ErrorState title="Dashboard unavailable" body={error} onRetry={() => window.location.reload()} />;
  }
  if (!stats || !reports) return <LoadingSpinner label="Loading dashboard…" />;

  const totalCategories = CATEGORIES.reduce((s, c) => s + (stats.byCategory[c.id] ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total reports" value={stats.totalReports.toLocaleString()} sub={`${stats.reportsThisWeek} filed this week`} />
        <StatCard label="Resolved" value={(stats.byStatus.resolved ?? 0).toLocaleString()} sub={`${stats.resolvedLast30Days} in the last 30 days`} />
        <StatCard
          label="Avg. days to resolve"
          value={stats.avgDaysToResolve != null ? stats.avgDaysToResolve.toFixed(1) : '—'}
          sub={stats.avgDaysToResolve != null ? 'from report to resolved' : 'no resolved reports yet'}
        />
        <StatCard label="In progress now" value={((stats.byStatus.acknowledged ?? 0) + (stats.byStatus.in_progress ?? 0)).toLocaleString()} sub="acknowledged or being worked on" />
      </section>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Reports by category" className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5 sm:p-6">
          <h2 className="text-base font-extrabold tracking-tight text-slate-900">Reports by category</h2>
          <p className="mt-0.5 text-xs text-slate-500">What kinds of issues the community reports most.</p>
          <div className="mt-4">
            {totalCategories === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>
            ) : (
              <CategoryBarChart byCategory={stats.byCategory} />
            )}
          </div>
        </section>
        <section aria-label="Reports by status" className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5 sm:p-6">
          <h2 className="text-base font-extrabold tracking-tight text-slate-900">Reports by status</h2>
          <p className="mt-0.5 text-xs text-slate-500">Where every report stands in the fix pipeline.</p>
          <div className="mt-4">
            <StatusDonut byStatus={stats.byStatus} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity */}
        <section aria-label="Recent activity" className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">Recent activity</h2>
            <Link href="/reports/" className="text-xs font-bold text-civic-600 hover:underline">View all →</Link>
          </div>
          {recentActivity.length === 0 ? (
            <EmptyState title="Nothing here yet" body="When neighbors file reports, the newest ones will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentActivity.map((r) => (
                <li key={r.id}>
                  <Link href={`/reports/${r.id}/`} className="group flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-civic-700">
                        {r.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {CATEGORY_LABEL[r.category]} · {timeAgo(r.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top areas */}
        <section aria-label="Top areas" className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5 sm:p-6">
          <h2 className="text-base font-extrabold tracking-tight text-slate-900">Top areas by report volume</h2>
          <p className="mt-0.5 text-xs text-slate-500">Neighborhoods with the most open issues right now.</p>
          {areas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {areas.map((a, i) => {
                const max = areas[0].count;
                return (
                  <li key={a.key}>
                    <Link href={`/reports/${a.sample.id}/`} className="group block">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-civic-700">
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[11px] font-extrabold text-slate-500">
                            {i + 1}
                          </span>
                          {a.label}
                        </p>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {a.count} <span className="font-medium text-slate-400">reports</span>
                        </p>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-civic-500"
                          style={{ width: `${Math.max(6, (a.count / max) * 100)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <Link href="/reports/" className="text-xs font-bold text-civic-600 hover:underline">
              Browse reports in these areas →
            </Link>
          </div>
        </section>
      </div>

      <p className="text-center text-xs text-slate-400">
        Areas are grouped automatically from report locations. Reports marked “Sample” are demonstration data.
      </p>
    </div>
  );
}
