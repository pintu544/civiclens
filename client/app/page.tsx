import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';

export const metadata: Metadata = {
  title: 'CivicLens — See a problem. Report it. Watch it get fixed.',
  description:
    'Report potholes, broken streetlights, garbage dumps, and water leaks in seconds. AI triage routes every report to the right department on a live public map.',
};

export default function HomePage() {
  return <HomeClient />;
}
