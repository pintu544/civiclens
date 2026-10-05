import type { Metadata } from 'next';
import { ReportsClient } from '@/components/ReportsClient';

export const metadata: Metadata = {
  title: 'Browse reports',
  description:
    'Browse every public civic report: filter by status and category, search, and sort by newest, priority, or community backing.',
};

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Community reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Every report filed by residents, with its live status. Back the ones you see too — it
          raises their priority.
        </p>
      </div>
      <ReportsClient />
    </div>
  );
}
