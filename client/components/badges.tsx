import { STATUS_BG, STATUS_LABEL, CATEGORY_LABEL, CATEGORY_COLOR } from '@/lib/constants';
import type { Category, Status } from '@/lib/constants';

export function StatusBadge({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_BG[status]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CategoryBadge({ category, className = '' }: { category: Category; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 ${className}`}
    >
      <span
        className="mr-1.5 h-2 w-2 rounded-full"
        style={{ backgroundColor: CATEGORY_COLOR[category] }}
        aria-hidden="true"
      />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function SampleBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="This is demonstration data included so you can explore the app — not a real resident report."
      className={`inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white ${className}`}
    >
      Sample
    </span>
  );
}

export function PriorityChip({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span
      title="Priority score: how urgently this needs attention, based on severity, community upvotes, and age."
      className={`inline-flex items-center rounded-full bg-civic-50 px-2.5 py-1 text-xs font-bold text-civic-700 ring-1 ring-inset ring-civic-200 ${className}`}
    >
      Priority {score.toFixed(1)}
    </span>
  );
}
