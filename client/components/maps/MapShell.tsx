'use client';

import dynamic from 'next/dynamic';
import { MapSkeleton } from '../states';
import type { ReportMapProps } from './ReportMap';

const ReportMap = dynamic(() => import('./ReportMap'), {
  ssr: false,
  loading: () => <MapSkeleton height="h-[420px]" />,
});

/** Live map of many reports: status-colored pins, clustering, popups. */
export function BrowseMapShell(props: Omit<ReportMapProps, 'mode'>) {
  return <ReportMap {...props} mode="browse" />;
}

/** Single draggable pin for the report wizard's location step. */
export function PickMapShell(
  props: Pick<ReportMapProps, 'pickPosition' | 'onPick' | 'center' | 'heightClass'>,
) {
  return <ReportMap {...props} mode="pick" zoom={14} />;
}

/** Fixed-zoom single-pin map for the report detail page. */
export function DetailMapShell({
  report,
  heightClass = 'h-56',
}: {
  report: import('@/lib/api').Report;
  heightClass?: string;
}) {
  return (
    <ReportMap
      reports={[report]}
      mode="browse"
      fitToReports={false}
      center={[report.latitude, report.longitude]}
      zoom={16}
      heightClass={heightClass}
    />
  );
}
