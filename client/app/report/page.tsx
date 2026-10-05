import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReportWizard, ReportWizardLoading } from '@/components/ReportWizard';

export const metadata: Metadata = {
  title: 'Report an issue',
  description:
    'Report a civic issue in three steps: add a photo, describe it and pin the location, then review. Our AI triages it instantly.',
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Suspense fallback={<ReportWizardLoading />}>
        <ReportWizard />
      </Suspense>
    </div>
  );
}
