import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CivicLens — See a problem. Report it. Watch it get fixed.',
    template: '%s · CivicLens',
  },
  description:
    'CivicLens turns a 30-second phone report into a tracked, AI-triaged civic ticket on a public map. Report potholes, broken streetlights, garbage dumps, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
