# Final Validation Report — Phase 9 (Production-Like Local Deployment)

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

Date: 2026-09-17 · Environment: Docker Desktop 29.6.2 / Compose v5.3.1 (desktop-linux) ·
Mode: `docker compose -f docker-compose.yml -f docker-compose.prod.yml` with
validation-only secrets (never committed). No public-cloud deployment was
performed, per the phase constraint.

## 1. Docker build — PASS
- `docker compose build api`: success (10.5s). Validates: python:3.11-slim base,
  exact-pinned `requirements-runtime.txt` (incl. `sentry-sdk==2.41.0`),
  non-root `appuser`, `COPY backend/ml_models` (tracked `.gitkeep` keeps fresh
  clones building), entrypoint executable.
- `... build web`: success. Validates: node:20 build (`npm ci` + `vite build`),
  nginx:1.27 serve with SPA fallback config.

## 2. Clean-environment start + migrations — PASS
- `down -v` (volume removed) → `up -d --build`: `db` healthy via `pg_isready`;
  `api` ran `alembic upgrade head` then served; api + web report healthy.
- `SELECT version_num FROM alembic_version` → **`f2b1d8e4a903`** (current head).
- `\dt` → 15 tables incl. `coach_assignments`, `productivity_logs`, `auth_tokens`.
- `GET /health` → `status: healthy, uptime_seconds: 9.6, db_connected: true,
  success_rate_percent: 100.0` (measured, not placeholder).

## 3. End-to-end flow in containers — PASS
register (id 1) → alarm create (id 1) → `/challenges/next` (`9 - 5`) →
submit `4` (`completed=True`) → dismiss (`successfully_dismissed=True`) →
`/habits/score` `overall=73`. Web `/` → 200; deep link `/alarms` → 200 (SPA fallback).

## 4. Secrets through environment — PASS (incl. negative test)
- Prod overlay **refuses to evaluate without secrets**: `build`/`up` abort
  with `Set POSTGRES_PASSWORD / SECRET_KEY / CORS_ORIGINS before starting...`.
- Placeholder `SECRET_KEY` in production: api container boot-loops with
  `RuntimeError: SECRET_KEY is missing or set to the placeholder value` +
  `Application startup failed. Exiting.` (new boot-time guard; previously it
  failed only at first auth request — hardened this phase).
- Valid secrets: restarts=0, healthy. Runtime user `appuser`; env shows
  `ENVIRONMENT=production DEBUG=false`, secret present (43 chars).

## 5. Restart recovery — PASS
`restart db api` → healthy again; login succeeds; the created alarm
("Prod Check") persisted (named volume `pg_data`).

## 6. Backup and restore — PASS
- `pg_dump -F c` (52,822 bytes) → `docker cp` to host → `down -v` (disaster:
  alarms count 0) → fresh `up` → `pg_restore --clean --if-exists` →
  alarms count 1 (`Prod Check`). Procedure in OPERATIONS_GUIDE §4 is the
  executed command set.

## 7. Logs — PASS
`docker compose logs api` shows entrypoint migration line, torch-absent
fallback notice, uvicorn startup, and per-request gateway lines. No log
access requires container shell (non-root image still permits `exec`).

## 8. Production web frontend — PASS
`npm run build` clean (existing gate) and the nginx image serves `/` (200)
plus SPA deep links (200). `VITE_API_URL` is a build ARG (default
`http://localhost:8000`).

## 9. Monitoring wiring — PASS (local)
`/health` measured fields feed the admin `system_uptime_percentage` metric;
gateway counts every response (incl. 429s and 500s) into the lifetime success
ratio. Sentry hook is a verified no-op without `SENTRY_DSN` (full pytest
suite green with it unset); with a DSN it initializes once at startup.

## 10. Mobile build / notification config — documented, NOT executed here
`USER_GUIDE.md` §7 + `Markdown Files/REAL_DEVICE_CHECKLIST.md` record the Expo dev-build
requirement, token registration, and tap-routing verification. No mobile
binary was built in this phase (requires Expo credentials/device).

## 11. Cloud deployment — explicitly NOT performed
Decision record: phase constraint forbids public-cloud rollout before local
production-like validation. That validation is now complete (items 1–9).
The ship checklist and required variables live in DEPLOYMENT_GUIDE §§2,7;
no deployment URL exists yet.

## Remaining gaps (honest backlog)
- Real-device alarm/notification firing (checklist ready, needs hardware).
- Public-cloud rollout + managed Postgres + edge TLS (guides ready).
- Sentry DSN never set in any environment (hook verified no-op only).
