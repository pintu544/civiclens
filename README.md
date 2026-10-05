# CivicLens

**See a problem. Report it in 30 seconds. Watch your community fix it.**

CivicLens is a community issue-reporting platform with an AI triage engine, built solo for
**WarriorHacks 2.0** (theme: solve an issue in your community). Residents photograph and report local
civic problems — potholes, dead streetlights, garbage dumps, water leaks — and every report is
automatically classified, severity-scored, routed to the right city department, deduplicated against
neighbors' reports, and placed on a public accountability map until it's resolved.

🔗 **Live demo:** *(URL after Render deploy)*
🎥 **Demo video:** *(YouTube link after recording)*

## What it does

- **30-second reporting** — photo, map pin (or GPS), one sentence. Mobile-first 3-step wizard.
- **AI triage** — each report gets a category (roads, streetlights, waste, water, parks, safety, other),
  a severity score 1–5 with a written rationale, a department assignment, and a public priority score.
- **Duplicate merging** — near-identical reports from neighbors (same area + similar text) merge into one
  ticket; the reporter's voice is added as an upvote instead of cluttering the queue.
- **Public accountability map** — every report is a pin with a status timeline:
  `reported → acknowledged → in_progress → resolved`.
- **Community upvotes** — "I see this too" pushes a report's priority up.
- **Civic dashboard** — resolution rates, average days to fix, category/department breakdowns, hotspots.

## How it's built

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript), Tailwind CSS — statically exported |
| Backend | Express 4 + TypeScript REST API |
| Database | PostgreSQL (Render free tier); in-memory demo mode for local runs |
| AI triage | FastRouter LLM (OpenAI-compatible) → transparent rules-engine fallback |
| Images | Direct browser upload to Cloudinary (unsigned preset) |
| Maps | Leaflet + OpenStreetMap, Nominatim reverse-geocoding — zero API keys |

**Single-service deployment:** the Express server mounts `/api/*` and serves the static Next.js export for
everything else — one Render web service, one URL, no CORS.

### AI honesty

The triage pipeline is genuinely two-tiered: when `LLM_API_KEY` is configured, an LLM returns
structured JSON (category, severity, rationale); otherwise a deterministic keyword rules engine does the
job and `/api/health` reports which provider is active. The UI labels which one triaged each report.
No fake "AI" claims, no mock endpoints.

### Demo data honesty

The live demo ships with clearly-labeled **sample reports** around Austin, TX so the map is explorable
immediately — each carries a "Sample" badge in the UI. Everything else (reporting, triage, upvotes,
status workflow, dashboard) is fully live. This project is not affiliated with any city government.

## Run it locally

**Zero-setup demo mode** (in-memory Postgres, data resets on restart):

```bash
cd server && npm ci
DATABASE_URL=pgmem://demo npm run dev   # API on :4000
cd ../client && npm ci && npm run dev    # UI on :3000 (proxies /api)
```

**With real Postgres:**

```bash
cd server && npm ci
# set DATABASE_URL in .env (see .env.example), then:
npm run build && npm start              # serves API + client/out on one port
npm run seed                            # optional: 16 sample Austin reports
```

**Seed + test:**

```bash
cd server && npm test                   # 39 tests (vitest + pg-mem + supertest)
```

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (or `pgmem://demo`) | Postgres connection string |
| `LLM_API_KEY` | no | Enables FastRouter LLM triage; rules engine otherwise |
| `ADMIN_KEY` | no (auto-generated) | Guards `PATCH /api/reports/:id/status` via `x-admin-key` |
| `PORT` | no (default 4000) | Server port |

See `server/.env.example`. The Cloudinary cloud name + unsigned preset in the client are public
by design (unsigned uploads).

## API

`GET /api/health` · `GET /api/reports` (filters: status, category, bbox, sort, q, pagination) ·
`POST /api/reports` · `GET /api/reports/:id` (report + history + similar) ·
`POST /api/reports/:id/upvote` · `PATCH /api/reports/:id/status` (admin key) ·
`GET /api/stats` · `GET /api/departments`

Full reference in `server/README.md`.

## Deploy (Render)

`render.yaml` is a ready blueprint: dashboard → New → Blueprint → connect this repo → Apply.
It provisions the web service + Postgres and wires `DATABASE_URL` automatically. Optionally set
`LLM_API_KEY` in Environment afterwards; copy the generated `ADMIN_KEY` to update report statuses.

## License

MIT — see [LICENSE](LICENSE).
