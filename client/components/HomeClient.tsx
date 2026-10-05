'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, fetchReports, fetchStats, type Report, type Stats } from '@/lib/api';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/constants';
import type { Status } from '@/lib/constants';
import { BrowseMapShell } from './maps/MapShell';
import { ReportCard } from './ReportCard';
import { EmptyState, ErrorState, LoadingSpinner, MapSkeleton } from './states';

function StatStrip({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Reports filed', value: stats.totalReports.toLocaleString() },
    { label: 'Resolved', value: (stats.byStatus.resolved ?? 0).toLocaleString() },
    { label: 'Fixed in the last 30 days', value: stats.resolvedLast30Days.toLocaleString() },
    { label: 'Filed this week', value: stats.reportsThisWeek.toLocaleString() },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl bg-white px-5 py-4 shadow-card ring-1 ring-slate-900/5">
          <dd className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">{it.value}</dd>
          <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{it.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const HOW_IT_WORKS = [
  {
    title: 'Snap & report',
    body: 'Photograph the pothole, broken light, or garbage pile, drop a pin on the map, and add one sentence. Thirty seconds, from your phone.',
  },
  {
    title: 'AI triages instantly',
    body: 'Our triage pipeline classifies the issue, scores its severity 1–5, merges duplicates from neighbors, and routes it to the right city department.',
  },
  {
    title: 'Watch it get fixed',
    body: 'Every report is public on the live map with a status timeline — reported, acknowledged, in progress, resolved. No more shouting into the void.',
  },
];

const LEGEND: Status[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];

export function HomeClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [mapReports, setMapReports] = useState<Report[] | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Report[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStats()
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setStatsError(e instanceof ApiError ? e.message : 'Could not load stats.'));
    fetchReports({ limit: 200, sort: 'newest' })
      .then((r) => {
        if (!alive) return;
        setMapReports(r.reports);
        setRecent(r.reports.slice(0, 6));
      })
      .catch((e) => {
        if (!alive) return;
        const msg = e instanceof ApiError ? e.message : 'Could not load reports.';
        setMapError(msg);
        setRecentError(msg);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(900px 420px at 15% 10%, rgba(59,102,240,0.35), transparent 60%), radial-gradient(700px 380px at 85% 90%, rgba(124,58,237,0.25), transparent 60%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-civic-200 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            Live community reporting
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            See a problem. Report it in seconds. Watch your community fix it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Potholes nobody fixes. Streetlights nobody reports. Complaining to the city feels like
            shouting into a void — CivicLens turns a 30-second phone report into a tracked,
            AI-triaged ticket on a public map.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/report/"
              className="rounded-full bg-civic-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-civic-600/30 transition hover:bg-civic-400"
            >
              Report an issue
            </Link>
            <Link
              href="/reports/"
              className="rounded-full bg-white/10 px-7 py-3.5 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              Browse reports
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6">
        {/* Stats strip */}
        <section aria-label="Community impact stats">
          {statsError ? (
            <ErrorState title="Stats unavailable" body={statsError} onRetry={() => window.location.reload()} />
          ) : stats ? (
            <StatStrip stats={stats} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          )}
        </section>

        {/* Live map */}
        <section aria-label="Live report map">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Live report map</h2>
              <p className="mt-1 text-sm text-slate-500">
                Every public report, right now. Pins are colored by status — click one for details.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Map legend">
              {LEGEND.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          </div>
          {mapError ? (
            <ErrorState title="Map unavailable" body={mapError} onRetry={() => window.location.reload()} />
          ) : mapReports ? (
            <div className="overflow-hidden rounded-2xl shadow-card ring-1 ring-slate-900/10">
              <BrowseMapShell reports={mapReports} heightClass="h-[420px] sm:h-[520px]" />
            </div>
          ) : (
            <MapSkeleton height="h-[420px] sm:h-[520px]" />
          )}
        </section>

        {/* How it works */}
        <section aria-label="How it works">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">How it works</h2>
          <p className="mt-1 text-sm text-slate-500">From sidewalk to city crew in three steps.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.title} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-civic-600 text-base font-extrabold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent reports */}
        <section aria-label="Recent reports">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Recent reports</h2>
              <p className="mt-1 text-sm text-slate-500">The latest issues your neighbors flagged.</p>
            </div>
            <Link href="/reports/" className="shrink-0 text-sm font-bold text-civic-600 hover:text-civic-700 hover:underline">
              View all →
            </Link>
          </div>
          {recentError ? (
            <ErrorState title="Reports unavailable" body={recentError} onRetry={() => window.location.reload()} />
          ) : recent ? (
            recent.length === 0 ? (
              <EmptyState
                title="No reports yet"
                body="Nobody has reported an issue in this community yet. Be the first — it takes thirty seconds."
                action={
                  <Link href="/report/" className="rounded-full bg-civic-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-civic-700">
                    Report an issue
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
