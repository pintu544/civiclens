# CivicLens — Agent Runbook

WarriorHacks 2.0 project. Next.js 14 frontend (static export) + Express 4 API + Postgres.
Deadline: Oct 14, 2026 10:15am IST. Not submitted yet — video + track form pending (Pintu records).

## Live endpoints
- Frontend: https://civiclens-jet.vercel.app/ (Vercel project `civiclens`, root dir `client`)
- API: https://civiclens-ws3f.onrender.com (Render service `srv-db1eq6navr4c73bitmvg`)
- DB: `civiclens-db` (`dpg-db1epr7avr4c73birra0-a`), 16 seeded Austin sample reports

## Deploy workflow
1. Commit + push to `main` → Render auto-deploys backend, Vercel auto-deploys frontend.
2. Backend: `GET /api/health` must return 200 with `"db":"postgres"`.
3. Frontend: check `NEXT_PUBLIC_API_URL=https://civiclens-ws3f.onrender.com` is set on Vercel prod.
4. Render must have `CORS_ORIGIN=https://civiclens-jet.vercel.app`.
5. Verify CORS: `curl -X OPTIONS <api>/api/reports -H "Origin: https://civiclens-jet.vercel.app"` → 204 + matching `Access-Control-Allow-Origin`.

Use the `deploy` skill for CLI/API commands (Render has no CLI — use its REST API).

## Hard rules (learned the painful way)
- **Schema must be idempotent on boot.** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, async `ensurePostgresSchema()` + idempotent `runSeed()`. Real Postgres never gets schema.sql auto-applied — the 500s on /api/reports taught us this.
- **Never commit secrets.** `LLM_API_KEY` lives only in Render dashboard env, never in repo/chat.
- **Git identity:** Pintu Kumar <64580363+pintu544@users.noreply.github.com> — never pksharmagh4@gmail.com (maps to his other account pintuskumar).
- **Tests:** 44/44 must pass (`npm test` in server/). Kill stale port-4000 servers by exact PID.
- **No direct DB access from this VM** — egress proxy breaks PG SSL. Use the API.
- One clearly-labeled "E2E test" report may exist in prod data from verification; harmless.

## Env vars
Render: `DATABASE_URL` (auto), `LLM_API_KEY` (FastRouter — set in dashboard; without it, heuristic fallback), `CORS_ORIGIN`, `ADMIN_KEY`, `NODE_VERSION`.
Vercel: `NEXT_PUBLIC_API_URL`.
Local dev: `server/.env` → `DATABASE_URL=pgmem://demo` for zero-setup mode.

## AI triage
Provider `llm`: `LLM_BASE_URL` default `https://api.fastrouter.ai/api/v1`, `LLM_MODEL` default `anthropic/claude-opus-4.7`. Rules-engine fallback when key absent — label honestly in UI.
