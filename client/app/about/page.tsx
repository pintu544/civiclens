import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — how CivicLens works',
  description:
    'How CivicLens works: community reporting, AI triage, duplicate detection, and a public status timeline. Built for WarriorHacks 2.0.',
};

const PIPELINE = [
  {
    title: '1. You report',
    body: 'A photo, a pin on the map, and a sentence. Thirty seconds from your phone — no accounts, no forms that feel like tax returns.',
  },
  {
    title: '2. AI triages',
    body: 'The triage service classifies the issue into one of seven categories, scores its severity from 1 to 5 with a written rationale, and routes it to the right department — Public Works, Sanitation, Water Authority, and so on.',
  },
  {
    title: '3. Duplicates merge',
    body: 'If your neighbors already reported the same pothole, your report is merged into theirs instead of creating a second ticket. Your backing still counts — it raises the priority score.',
  },
  {
    title: '4. Everyone watches',
    body: 'Every report lives on the public map with a status timeline: reported → acknowledged → in progress → resolved. Transparency is the whole point.',
  },
];

const HONESTY = [
  {
    title: 'Honest about AI',
    body: 'Triage runs on an AI model when it is available. If the model is unreachable, a transparent keyword-based rules engine takes over — and the app says so on the triage result. We never present a guess as a certainty.',
  },
  {
    title: 'Honest about data',
    body: 'The map ships with clearly labeled sample reports so you can explore the product. They carry a “Sample” badge everywhere they appear — we never pretend they are real resident reports or a live city integration.',
  },
  {
    title: 'Honest about who we are',
    body: 'CivicLens is an independent community tool built for the WarriorHacks 2.0 hackathon. We are not affiliated with, or endorsed by, any city government or municipal body.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-civic-600">About CivicLens</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Complaining to the city shouldn’t feel like shouting into a void.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600">
        Every city has potholes nobody fixes and streetlights nobody reports — not because residents
        don’t care, but because reporting feels pointless. CivicLens makes it effortless to be
        heard, and makes the city’s response visible: one public map, one status timeline per
        issue, and a priority score the whole neighborhood can move.
      </p>

      <h2 className="mt-12 text-2xl font-extrabold tracking-tight text-slate-900">How it works</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {PIPELINE.map((s) => (
          <div key={s.title} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/5">
            <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-2xl font-extrabold tracking-tight text-slate-900">
        Three things we’re upfront about
      </h2>
      <div className="mt-5 space-y-4">
        {HONESTY.map((s) => (
          <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl bg-slate-950 p-8 text-center">
        <h2 className="text-xl font-extrabold text-white">See something? Say something.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">
          It takes thirty seconds, and your neighborhood can watch it get fixed.
        </p>
        <Link
          href="/report/"
          className="mt-5 inline-block rounded-full bg-civic-500 px-8 py-3 text-sm font-bold text-white transition hover:bg-civic-400"
        >
          Report an issue
        </Link>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Built for WarriorHacks 2.0 · Map data © OpenStreetMap contributors
      </p>
    </div>
  );
}
