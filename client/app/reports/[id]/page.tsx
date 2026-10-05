import type { Metadata } from 'next';
import { ReportDetailClient } from '@/components/ReportDetailClient';

export const metadata: Metadata = {
  title: 'Report details',
  description: 'Track a civic report: photo, location, AI assessment, status timeline, and community backing.',
};

/**
 * Static export requires generateStaticParams for dynamic routes.
 * We prerender a single shell page; at request time the Express server serves
 * this shell HTML for ANY /reports/:id, and the client component reads the
 * real id from window.location (see lib/utils.ts idFromPathname).
 */
export async function generateStaticParams() {
  return [{ id: 'view' }];
}

export default function ReportDetailPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <ReportDetailClient />
    </div>
  );
}
