'use client';

import { useState } from 'react';
import { ApiError, upvoteReport } from '@/lib/api';
import { getVoterKey, hasVoted, markVoted } from '@/lib/utils';

export function UpvoteButton({
  reportId,
  initialUpvotes,
  onUpvoted,
}: {
  reportId: string;
  initialUpvotes: number;
  onUpvoted?: (upvotes: number, priorityScore: number) => void;
}) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [voted, setVoted] = useState(() => hasVoted(reportId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = async () => {
    if (voted || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await upvoteReport(reportId, getVoterKey());
      setUpvotes(res.upvotes);
      setVoted(true);
      markVoted(reportId);
      onUpvoted?.(res.upvotes, res.priorityScore);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register your upvote. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={vote}
        disabled={voted || busy}
        aria-pressed={voted}
        className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-sm transition ${
          voted
            ? 'cursor-default bg-emerald-600 text-white'
            : 'bg-civic-600 text-white hover:bg-civic-700 active:scale-[0.98]'
        } disabled:cursor-not-allowed disabled:opacity-80`}
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        ) : voted ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75A2.25 2.25 0 0 1 16.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.25M6.633 10.25H5.25a2.25 2.25 0 0 0-2.25 2.25v4.5c0 .621.504 1.125 1.125 1.125h2.25" />
          </svg>
        )}
        {voted ? 'You backed this' : 'I see this too'}
        <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${voted ? 'bg-white/25' : 'bg-white/20'}`}>
          {upvotes}
        </span>
      </button>
      <p className="mt-2 text-xs text-slate-500">
        {voted
          ? 'Thanks — your backing pushes this higher on the city’s priority list.'
          : 'Backing a report raises its priority score. One backing per device.'}
      </p>
      {error && <p className="mt-1.5 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
