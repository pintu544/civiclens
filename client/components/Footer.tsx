import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-civic-600" aria-hidden="true">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </span>
            <span className="text-base font-extrabold tracking-tight text-slate-900">
              Civic<span className="text-civic-600">Lens</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            See a problem. Report it in seconds. Watch your community fix it. CivicLens turns a
            30-second phone report into a tracked, AI-triaged civic ticket on a public map.
          </p>
        </div>
        <nav aria-label="Footer">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm font-medium text-slate-600">
            <li><Link href="/report/" className="hover:text-civic-700">Report an issue</Link></li>
            <li><Link href="/reports/" className="hover:text-civic-700">Browse reports</Link></li>
            <li><Link href="/dashboard/" className="hover:text-civic-700">Civic dashboard</Link></li>
            <li><Link href="/about/" className="hover:text-civic-700">How it works</Link></li>
          </ul>
        </nav>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Our promise</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>Every report is public and trackable.</li>
            <li>Reports marked “Sample” are demonstration data, not real resident reports.</li>
            <li>We never claim to be affiliated with any city government.</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:px-6">
          <p>© 2026 CivicLens. Built for WarriorHacks 2.0.</p>
          <p>Map data © OpenStreetMap contributors.</p>
        </div>
      </div>
    </footer>
  );
}
