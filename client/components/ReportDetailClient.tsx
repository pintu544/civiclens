'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, fetchReport, type ReportDetail } from '@/lib/api';
import { idFromPathname, formatDate, shortAddress, timeAgo } from '@/lib/utils';
import { CategoryBadge, PriorityChip, SampleBadge, StatusBadge } from './badges';
import { SeverityMeter } from './SeverityMeter';
import { StatusTimeline } from './StatusTimeline';
import { UpvoteButton } from './UpvoteButton';
import { ReportCard } from './ReportCard';
import { DetailMapShell } from './maps/MapShell';
import { EmptyState, ErrorState, LoadingSpinner } from './states';

export function ReportDetailClient() {
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorityScore, setPriorityScore] = useState<number | null>(null);

  useEffect(() => {
    const id = idFromPathname();
    if (!id) {
      setNotFound(true);
      return;
    }
    let alive = true;
    fetchReport(id)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setPriorityScore(d.report.priorityScore);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof ApiError ? e.message : 'Could not load this report.');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (notFound) {
    return (
      <EmptyState
        title="Report not found"
        body="This report may have been removed, or the link is incomplete. Browse the public reports to find what you are looking for."
        action={
          <Link href="/reports/" className="rounded-full bg-civic-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-civic-700">
            Browse reports
          </Link>
        }
      />
    );
  }

  if (error) {
    return <ErrorState title="Could not load this report" body={error} onRetry={() => window.location.reload()} />;
  }

  if (!detail) return <LoadingSpinner label="Loading report…" />;

  const { report, history, similar } = detail;

  return (
    <div>
      <Link href="/reports/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-civic-700">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        All reports
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            <CategoryBadge category={report.category} />
            {report.isSample && <SampleBadge />}
            <PriorityChip score={priorityScore ?? report.priorityScore} />
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {report.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Reported by <strong className="text-slate-700">{report.reporterName}</strong></span>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(report.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="break-words">{shortAddress(report.address)}</span>
          </p>

          {report.photoUrl ? (
            <figure className="mt-5 overflow-hidden rounded-2xl shadow-card ring-1 ring-slate-900/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={report.photoUrl} alt={`Photo for report: ${report.title}`} className="max-h-[480px] w-full object-cover" />
            </figure>
          ) : null}

          <div className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{report.description}</p>
          </div>

          {report.severityRationale && (
            <div className="mt-6 rounded-2xl border border-civic-100 bg-civic-50/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-civic-500">AI assessment</h2>
                <SeverityMeter severity={report.severity} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{report.severityRationale}</p>
              <p className="mt-2 text-xs text-slate-500">
                Routed to <strong className="text-slate-700">{report.department}</strong>
              </p>
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-400">Status timeline</h2>
            <StatusTimeline history={history} reportedAt={report.createdAt} currentStatus={report.status} />
          </div>

          {similar.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Similar reports nearby</h2>
              <p className="mt-1 text-sm text-slate-500">Same category, within about a kilometer.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {similar.map((s) => (
                  <ReportCard key={s.id} report={s} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5">
            <UpvoteButton
              reportId={report.id}
              initialUpvotes={report.upvotes}
              onUpvoted={(_u, ps) => setPriorityScore(ps)}
            />
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5">
            <DetailMapShell report={report} />
            <div className="p-4">
              <p className="break-words text-sm text-slate-600">
                {report.address ?? 'Location pinned on map'}
              </p>
              <p className="mt-1 text-xs tabular-nums text-slate-400">
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </p>
            </div>
          </div>

          <dl className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm text-slate-500">Department</dt>
              <dd className="text-right text-sm font-semibold text-slate-900">{report.department}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 py-2">
              <dt className="text-sm text-slate-500">Priority score</dt>
              <dd className="text-sm font-bold tabular-nums text-slate-900">
                {(priorityScore ?? report.priorityScore).toFixed(1)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 py-2">
              <dt className="text-sm text-slate-500">Reported</dt>
              <dd className="text-sm font-semibold text-slate-900">{formatDate(report.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 py-2">
              <dt className="text-sm text-slate-500">Last update</dt>
              <dd className="text-sm font-semibold text-slate-900">{formatDate(report.updatedAt)}</dd>
            </div>
            {report.isSample && (
              <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
                Marked “Sample”: this is demonstration data included so you can explore the app, not a
                real resident report.
              </p>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}
