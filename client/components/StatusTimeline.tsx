import type { StatusHistoryItem } from '@/lib/api';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/constants';
import type { Status } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';

export function StatusTimeline({
  history,
  reportedAt,
  currentStatus,
}: {
  history: StatusHistoryItem[];
  reportedAt: string;
  currentStatus: Status;
}) {
  // Build a chronological timeline. If the API history is empty, derive the
  // "Reported" node from createdAt so the timeline is never blank.
  const items: { status: Status; note: string | null; at: string }[] = [];
  if (history.length === 0) {
    items.push({ status: 'reported', note: null, at: reportedAt });
  } else {
    const sorted = [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const h of sorted) {
      items.push({ status: h.toStatus, note: h.note, at: h.createdAt });
    }
  }
  const order: Status[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];
  const currentIdx = order.indexOf(currentStatus);

  return (
    <ol className="relative space-y-6 border-l-2 border-slate-200 pl-0" aria-label="Status timeline">
      {items.map((item, i) => {
        const idx = order.indexOf(item.status);
        const isCurrent = i === items.length - 1;
        const reached = idx <= currentIdx || isCurrent;
        return (
          <li key={`${item.status}-${item.at}-${i}`} className="relative pl-8">
            <span
              className="absolute -left-[9px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white"
              style={{ backgroundColor: reached ? STATUS_COLOR[item.status] : '#cbd5e1' }}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={`text-sm font-bold ${reached ? 'text-slate-900' : 'text-slate-400'}`}>
                {STATUS_LABEL[item.status]}
                {isCurrent && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    current
                  </span>
                )}
              </p>
              <time className="text-xs text-slate-400">{formatDateTime(item.at)}</time>
            </div>
            {item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}
            {!item.note && item.status === 'reported' && (
              <p className="mt-1 text-sm text-slate-500">The report was received and queued for triage.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
