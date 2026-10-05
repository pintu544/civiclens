'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, createReport, type CreateReportResponse, type TriageResult } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABEL, DEFAULT_CENTER } from '@/lib/constants';
import type { Category } from '@/lib/constants';
import { severityColor } from '@/lib/utils';
import { PhotoUploader, type PhotoState } from './PhotoUploader';
import { PickMapShell } from './maps/MapShell';
import { CategoryBadge, SampleBadge, StatusBadge } from './badges';
import { SeverityMeter } from './SeverityMeter';
import { LoadingSpinner } from './states';

const STEPS = ['Photo', 'Details', 'Review'] as const;

interface Draft {
  title: string;
  description: string;
  categoryPick: Category | '';
  reporterName: string;
  lat: number | null;
  lng: number | null;
  address: string;
  addressLoading: boolean;
  geoError: string | null;
}

const EMPTY_DRAFT: Draft = {
  title: '',
  description: '',
  categoryPick: '',
  reporterName: '',
  lat: null,
  lng: null,
  address: '',
  addressLoading: false,
  geoError: null,
};

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.display_name === 'string' ? data.display_name : null;
  } catch {
    return null;
  }
}

export function ReportWizard() {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<PhotoState>({ kind: 'empty' });
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateReportResponse | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const updatePosition = async (lat: number, lng: number, { geocode }: { geocode: boolean }) => {
    set({ lat, lng, geoError: null, addressLoading: geocode });
    if (geocode) {
      const addr = await reverseGeocode(lat, lng);
      set({ address: addr ?? '', addressLoading: false });
    }
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      set({ geoError: 'This browser does not support location. Drag the pin to the issue instead.' });
      return;
    }
    set({ addressLoading: true, geoError: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => updatePosition(pos.coords.latitude, pos.coords.longitude, { geocode: true }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Drag the pin to the issue instead — no worries.'
            : 'Could not get your location. Drag the pin to the issue instead.';
        // Fall back to the default view so the user can drag the pin.
        set({ addressLoading: false, geoError: msg, lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const validateDetails = (): boolean => {
    const e: Record<string, string> = {};
    if (draft.title.trim().length < 5) e.title = 'Give it a short title (at least 5 characters).';
    else if (draft.title.trim().length > 120) e.title = 'Keep the title under 120 characters.';
    if (draft.description.trim().length < 20)
      e.description = 'Describe the issue in a sentence or two (at least 20 characters).';
    else if (draft.description.trim().length > 2000) e.description = 'Keep the description under 2000 characters.';
    if (draft.lat == null || draft.lng == null) e.location = 'Pin the location on the map so crews can find it.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateDetails()) return;
    setSubmitError(null);
    setStep((s) => Math.min(s + 1, 2));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (!validateDetails()) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createReport({
        title: draft.title.trim(),
        description: draft.description.trim(),
        latitude: draft.lat as number,
        longitude: draft.lng as number,
        ...(draft.address.trim() ? { address: draft.address.trim() } : {}),
        ...(photo.kind === 'done' ? { photoUrl: photo.url } : {}),
        ...(draft.reporterName.trim() ? { reporterName: draft.reporterName.trim() } : {}),
      });
      setResult(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setErrors(err.fields);
        setStep(1);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <SuccessScreen result={result} userPick={draft.categoryPick || null} />;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Stepper */}
      <ol className="mb-8 flex items-center" aria-label="Report progress">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    done
                      ? 'bg-emerald-600 text-white'
                      : active
                        ? 'bg-civic-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-3 h-0.5 flex-1 rounded ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <section aria-label="Step 1: photo">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Show us the problem</h1>
          <p className="mt-1 text-sm text-slate-500">
            A photo helps the AI understand the issue and helps repair crews find it. Optional — you can skip it.
          </p>
          <div className="mt-5">
            <PhotoUploader value={photo} onChange={setPhoto} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPhoto({ kind: 'empty' });
                next();
              }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Skip photo
            </button>
            <button
              type="button"
              onClick={next}
              disabled={photo.kind === 'uploading'}
              className="rounded-full bg-civic-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section aria-label="Step 2: details">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Describe the issue</h1>
          <p className="mt-1 text-sm text-slate-500">A sentence or two and a pin on the map is all it takes.</p>

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="rw-title" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Title <span className="font-normal text-slate-400">(e.g. “Large pothole on Main St”)</span>
              </label>
              <input
                id="rw-title"
                type="text"
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                maxLength={120}
                placeholder="What is the problem?"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.title ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-civic-500 focus:ring-civic-200'
                }`}
              />
              {errors.title && <p className="mt-1.5 text-sm font-medium text-red-600">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="rw-desc" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Description
              </label>
              <textarea
                id="rw-desc"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={4}
                maxLength={2000}
                placeholder="Where exactly is it, how bad is it, who does it affect?"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.description ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-civic-500 focus:ring-civic-200'
                }`}
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.description ? (
                  <p className="text-sm font-medium text-red-600">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-slate-400">{draft.description.trim().length}/2000</span>
              </div>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-slate-800">
                What kind of issue is this?{' '}
                <span className="font-normal text-slate-400">(helps neighbors find it — our AI makes the final call)</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => set({ categoryPick: '' })}
                  aria-pressed={draft.categoryPick === ''}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    draft.categoryPick === ''
                      ? 'border-civic-600 bg-civic-50 text-civic-800 ring-1 ring-civic-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Not sure — let AI decide
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set({ categoryPick: c.id })}
                    aria-pressed={draft.categoryPick === c.id}
                    title={c.hint}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                      draft.categoryPick === c.id
                        ? 'border-civic-600 bg-civic-50 text-civic-800 ring-1 ring-civic-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Location</span>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={draft.addressLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-civic-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-civic-700 disabled:opacity-60"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  {draft.addressLoading ? 'Locating…' : 'Use my location'}
                </button>
                <span className="text-xs text-slate-500">or drag the pin to the exact spot</span>
              </div>
              <PickMapShell
                pickPosition={draft.lat != null && draft.lng != null ? [draft.lat, draft.lng] : null}
                onPick={(lat, lng) => updatePosition(lat, lng, { geocode: true })}
                center={draft.lat != null && draft.lng != null ? [draft.lat, draft.lng] : DEFAULT_CENTER}
                heightClass="h-[300px]"
              />
              {draft.geoError && <p className="mt-2 text-sm font-medium text-amber-700">{draft.geoError}</p>}
              <label htmlFor="rw-address" className="mb-1.5 mt-3 block text-sm font-semibold text-slate-800">
                Address <span className="font-normal text-slate-400">(filled in automatically — edit if needed)</span>
              </label>
              <input
                id="rw-address"
                type="text"
                value={draft.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder={draft.addressLoading ? 'Looking up address…' : 'Street address or landmark'}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-civic-500 focus:outline-none focus:ring-2 focus:ring-civic-200"
              />
              {errors.location && <p className="mt-1.5 text-sm font-medium text-red-600">{errors.location}</p>}
            </div>

            <div>
              <label htmlFor="rw-name" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Your name <span className="font-normal text-slate-400">(optional — shown publicly)</span>
              </label>
              <input
                id="rw-name"
                type="text"
                value={draft.reporterName}
                onChange={(e) => set({ reporterName: e.target.value })}
                maxLength={80}
                placeholder="Anonymous"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-civic-500 focus:outline-none focus:ring-2 focus:ring-civic-200"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={back}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-full bg-civic-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-civic-700"
            >
              Review report
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Step 3: review">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Review your report</h1>
          <p className="mt-1 text-sm text-slate-500">
            Check everything looks right. Submitting runs our AI triage — category, severity, department, and duplicate check.
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {photo.kind === 'done' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="Your uploaded photo" className="h-52 w-full object-cover" />
            )}
            <dl className="space-y-4 p-5">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Title</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-slate-900">{draft.title.trim()}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{draft.description.trim()}</dd>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Your description</dt>
                  <dd className="mt-1">
                    {draft.categoryPick ? <CategoryBadge category={draft.categoryPick} /> : <span className="text-sm text-slate-500">Letting AI decide</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Reported as</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-700">{draft.reporterName.trim() || 'Anonymous'}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</dt>
                <dd className="mt-0.5 break-words text-sm text-slate-700">
                  {draft.address.trim() || 'Pinned on map'}
                  <span className="text-slate-400">
                    {' '}({draft.lat?.toFixed(5)}, {draft.lng?.toFixed(5)})
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {submitError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Could not submit the report.</p>
              <p className="mt-0.5 text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-civic-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
              {submitting ? 'Triaging…' : 'Submit report'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function SuccessScreen({ result, userPick }: { result: CreateReportResponse; userPick: Category | null }) {
  const { report } = result;

  if (result.merged) {
    return (
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-civic-100" aria-hidden="true">
          <svg className="h-8 w-8 text-civic-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Your neighbors beat you to it</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
          Our duplicate check found an existing report for this issue nearby. Instead of creating a
          second ticket, <strong>your voice was added to it</strong> — that is how issues climb the
          priority list.
        </p>
        <div className="mx-auto mt-6 max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-card">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <CategoryBadge category={report.category} />
              {report.isSample && <SampleBadge />}
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">{report.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {report.upvotes} {report.upvotes === 1 ? 'neighbor has' : 'neighbors have'} backed this · Priority {report.priorityScore.toFixed(1)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/reports/${report.id}/`}
            className="rounded-full bg-civic-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-civic-700"
          >
            View the existing report
          </Link>
          <Link href="/reports/" className="rounded-full px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Browse all reports
          </Link>
        </div>
      </div>
    );
  }

  const triage: TriageResult | undefined = result.triage;
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100" aria-hidden="true">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Report submitted</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-slate-600">
          Thank you — it is now on the public map where everyone can watch its progress.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">AI triage result</h2>
            {triage && (
              <span className="text-xs font-medium text-slate-400" title={triage.provider === 'nebius' ? 'Classified by an AI model (Nebius)' : 'Classified by our transparent rules engine (AI model unavailable)'}>
                {triage.provider === 'nebius' ? 'Triaged by AI' : 'Triaged by rules engine'}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {triage && <CategoryBadge category={triage.category} />}
            {userPick && triage && userPick !== triage.category && (
              <span className="text-xs text-slate-500">(you picked {CATEGORY_LABEL[userPick]} — the AI classified it as {CATEGORY_LABEL[triage.category]})</span>
            )}
            {report.isSample && <SampleBadge />}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Severity</p>
              <div className="mt-2"><SeverityMeter severity={triage?.severity ?? report.severity} /></div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Priority score</p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: severityColor(triage?.severity ?? report.severity) }}>
                {(triage?.priorityScore ?? report.priorityScore).toFixed(1)}
              </p>
              <p className="text-xs text-slate-500">Higher means it gets fixed sooner</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Routed to</p>
            <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <svg className="h-5 w-5 text-civic-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              {triage?.department ?? report.department}
            </p>
          </div>

          {(triage?.severityRationale || report.severityRationale) && (
            <div className="rounded-xl border border-civic-100 bg-civic-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-civic-500">Why this assessment</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {triage?.severityRationale ?? report.severityRationale}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/reports/${report.id}/`}
          className="rounded-full bg-civic-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-civic-700"
        >
          Track your report
        </Link>
        <Link href="/" className="rounded-full px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Back to the map
        </Link>
      </div>
    </div>
  );
}

export function ReportWizardLoading() {
  return <LoadingSpinner label="Preparing the report form…" />;
}
