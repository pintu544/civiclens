# CivicLens API (server)

Express 4 + TypeScript REST API for CivicLens — community issue reporting with AI triage.
Serves the static frontend from `../client/out` when it exists.

## Quick start (zero setup — demo mode)

```bash
npm ci
DATABASE_URL=pgmem://demo npm run dev   # API on :4000, in-memory Postgres, schema auto-applied
```

Demo mode uses pg-mem: a real Postgres-compatible database in memory. Data resets on
restart. No Docker, no local Postgres needed.

To load the 16 clearly-labeled Austin sample reports:

```bash
npm run seed   # needs DATABASE_URL set; idempotent (skips if samples already exist)
```

Against a real Postgres (e.g. Render), set `DATABASE_URL` to the connection string and
apply `src/schema.sql` once (demo mode applies it automatically; real Postgres does not),
then `npm run seed`.

## Environment variables

| Var | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string, or `pgmem://demo` for in-memory demo mode |
| `NEBIUS_API_KEY` | no | Enables the Nebius (NVIDIA Nemotron) triage provider. Without it, triage uses the transparent keyword heuristic |
| `ADMIN_KEY` | no | Shared secret for `PATCH /api/reports/:id/status` via the `x-admin-key` header. If unset, an ephemeral key is generated and printed at startup |
| `PORT` | no | Defaults to `4000` |

Copy `.env.example` to `.env` to configure locally. Never commit real secrets.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with tsx (`src/index.ts`) |
| `npm run build` | TypeScript build to `dist/` (+ copies `schema.sql`) |
| `npm start` | Run the built server (`node dist/index.js`) |
| `npm test` | vitest suite (pg-mem + supertest, no real keys needed) |
| `npm run seed` | Insert 16 Austin sample reports (`is_sample=true`), idempotent |

## AI triage

`POST /api/reports` runs triage automatically:

1. **Nebius** (primary, when `NEBIUS_API_KEY` is set): `nvidia/Nemotron-3_5-Lightning`
   via the OpenAI-compatible chat-completions endpoint, `json_object` response format,
   20s timeout, 1 retry. Output is parsed defensively — unknown category, bad severity,
   or malformed JSON all trigger fallback. The department is always derived server-side
   from the category map, never trusted from the model.
2. **Keyword heuristic** (fallback, and the default with no key): deterministic
   keyword matching over the 7 categories (token-based, so e.g. "street" never
   matches inside "streetlight"); severity starts at 3, +1 per pair of urgency
   hits (`urgent, dangerous, flood, accident, blocked, overflowing, broken, leak, sparking`),
   −1 for minor wording (`small, minor, slight`), clamped 1–5. The rationale says
   "Heuristic match" openly — it is never presented as AI.

`GET /api/health` reports the active provider (`nebius` | `heuristic`).

## Dedup

A new report is checked against last-30-day reports of the same category within
0.4 km (haversine); Jaccard similarity ≥ 0.4 on the lowercased alphanumeric token
sets of title+description merges it into the best match. A merge returns
`201 { merged: true, report }` and adds the reporter's voice as one upvote on the
existing report.

## Priority score

`severity*20 + min(upvotes,25)*2 + max(0, 10 - daysOld) + categoryWeight`,
rounded to 1 decimal. Weights: safety 15, water 10, roads 8, streetlights 6,
waste 5, parks 3, other 2. Recomputed on create, upvote, and status change.

## API reference (base path `/api`)

| Method | Path | Notes |
|---|---|---|
| POST | `/reports` | Body: `title` (5–120), `description` (20–2000), `latitude`, `longitude`, `address?`, `photoUrl?`, `reporterName?`. → `201 { report, triage }` or `201 { merged: true, report }` |
| GET | `/reports` | Query: `status`, `category`, `bbox=minLng,minLat,maxLng,maxLat`, `sort=newest\|priority\|upvotes`, `limit` (1–100, default 20), `offset`, `q`. → `{ reports, total, limit, offset }` |
| GET | `/reports/:id` | → `{ report, history, similar }` (similar: same category, ≤1 km, max 5) |
| POST | `/reports/:id/upvote` | Body: `{ voterKey }`. Idempotent per voterKey. → `{ upvotes, priorityScore }` |
| PATCH | `/reports/:id/status` | Header `x-admin-key` required. Body: `{ status, note? }`. Appends history. → `{ report }` |
| GET | `/stats` | → `{ totalReports, byStatus, byCategory, resolvedLast30Days, avgDaysToResolve, reportsThisWeek }` |
| GET | `/departments` | → `{ departments: [{ id, name, categories }] }` |
| GET | `/health` | → `{ ok, db: 'postgres'\|'pgmem', ai: 'nebius'\|'heuristic', version }` |

Errors: `400 { error, details? }` for validation, `401` for a bad/missing admin key,
`404 { error: 'Report not found' }` for unknown ids, `500` for unexpected failures.
All report objects use camelCase (`isSample`, `priorityScore`, `createdAt`, …).

## Static frontend

If `../client/out` exists (built Next.js static export), it is served for all
non-`/api` routes with an SPA fallback to `index.html`. Otherwise `GET /`
returns a small JSON notice (API-only mode) — the server never crashes.
