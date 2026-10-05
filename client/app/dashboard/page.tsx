import type { Metadata } from 'next';
import { DashboardClient } from '@/components/DashboardClient';

export const metadata: Metadata = {
  title: 'Civic dashboard',
  description:
    'The pulse of your community: report volumes by category and status, resolution times, recent activity, and the areas that need attention most.',
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Civic dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          The pulse of the community — where reports stand, what gets reported most, and which
          areas need attention.
        </p>
      </div>
      <DashboardClient />
    </div>
  );
}
