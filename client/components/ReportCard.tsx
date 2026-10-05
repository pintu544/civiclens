import Link from 'next/link';
import type { Report } from '@/lib/api';
import { CATEGORY_COLOR } from '@/lib/constants';
import { shortAddress, timeAgo } from '@/lib/utils';
import { CategoryBadge, SampleBadge, StatusBadge } from './badges';
import { SeverityMeter } from './SeverityMeter';

export function ReportCard({ report }: { report: Report }) {
  return (
    <Link
      href={`/reports/${report.id}/`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative h-40 w-full overflow-hidden bg-slate-100">
        {report.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.photoUrl}
            alt={`Photo for report: ${report.title}`}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${CATEGORY_COLOR[report.category]}22, ${CATEGORY_COLOR[report.category]}0d)`,
            }}
            aria-hidden="true"
          >
            <svg className="h-10 w-10" style={{ color: CATEGORY_COLOR[report.category] }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <StatusBadge status={report.status} className="bg-white/95 backdrop-blur" />
          {report.isSample && <SampleBadge />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <CategoryBadge category={report.category} />
          <span className="shrink-0 text-xs font-medium text-slate-400">{timeAgo(report.createdAt)}</span>
        </div>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-civic-700">
          {report.title}
        </h3>
        <p className="line-clamp-1 flex items-center gap-1 text-xs text-slate-500">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span className="truncate">{shortAddress(report.address)}</span>
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <SeverityMeter severity={report.severity} size="sm" />
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
            <svg className="h-3.5 w-3.5 text-civic-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75A2.25 2.25 0 0 1 16.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.25M6.633 10.25H5.25a2.25 2.25 0 0 0-2.25 2.25v4.5c0 .621.504 1.125 1.125 1.125h2.25" />
            </svg>
            {report.upvotes}
          </span>
        </div>
      </div>
    </Link>
  );
}
