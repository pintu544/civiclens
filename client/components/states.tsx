export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-civic-600"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function MapSkeleton({ height = 'h-[420px]' }: { height?: string }) {
  return (
    <div className={`${height} w-full animate-pulse rounded-2xl bg-slate-200`} aria-hidden="true">
      <div className="flex h-full items-center justify-center">
        <span className="text-sm font-medium text-slate-400">Loading map…</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-civic-50" aria-hidden="true">
        <svg className="h-6 w-6 text-civic-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body = 'We could not load this data. Please check your connection and try again.',
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100" aria-hidden="true">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="max-w-sm text-sm text-slate-600">{body}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-full bg-civic-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
