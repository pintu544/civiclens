import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report not found',
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="text-6xl font-extrabold text-slate-200" aria-hidden="true">404</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        The page you are looking for does not exist or was moved.
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-full bg-civic-600 px-7 py-3 text-sm font-bold text-white hover:bg-civic-700"
      >
        Back to home
      </a>
    </div>
  );
}
