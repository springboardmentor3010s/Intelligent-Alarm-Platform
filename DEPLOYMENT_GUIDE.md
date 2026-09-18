# Deployment Guide — CerebroKognit (Phase 9)

> Scope decision: **no public-cloud deployment is performed by this repo.**
> Everything below is validated against a local production-like stack
> (production images + `docker-compose.prod.yml` + Postgres). See
> `FINAL_VALIDATION_REPORT.md` for the executed evidence. Cloud rollout is a
> human decision documented at the end of this file.

## 1. Architecture being deployed

| Service | Image | Contents |
|---|---|---|
| `db` | `postgres:15-alpine` (pinned) | PostgreSQL 15, named volume `pg_data` |
| `api` | built from `backend/Dockerfile` (python:3.11-slim, non-root `appuser`, exact-pinned `requirements-runtime.txt`, torch intentionally excluded → rule-based difficulty fallback in-container) | FastAPI on :8000; runs `alembic upgrade head` at container start, then uvicorn |
| `web` | built from `web/Dockerfile` (node:20 build → nginx:1.27-alpine, SPA fallback) | Static bundle on :80; `VITE_API_URL` baked in at build time |

## 2. Required environment variables (production)

No defaults exist for secrets in `docker-compose.prod.yml` — compose aborts
with `Set ... before starting the production stack` unless these are set:

| Variable | Purpose | Example |
|---|---|---|
| `POSTGRES_PASSWORD` | Postgres role password | `python -c "import secrets;print(secrets.token_urlsafe(32))"` |
| `SECRET_KEY` | JWT signing secret (min 32 random bytes; placeholder refused at boot) | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | Exact frontend origin(s), comma-separated, never `*` | `https://app.example.com` |
| `POSTGRES_DB/USER/PORT`, `API_PORT`, `WEB_PORT` | Optional overrides | defaults: cerebro_kognit/cerebro_user/5432/8000/80 |
| `VITE_API_URL` | Public API base baked into the web bundle | `https://api.example.com` |
| `PUSH_PROVIDER` | `noop` (default) or `expo` (real FCM/APNs relay) | `noop` |
| `EXPO_ACCESS_TOKEN` | Optional Expo push credential | — |
| `SENTRY_DSN` | Optional error tracking; unset = disabled, never breaks startup | — |
| `LOG_LEVEL` | `INFO` default | `INFO` |

Full catalog with dev defaults lives in `backend/.env.example`.

## 3. Local production-like deploy (validated procedure)

```powershell
$env:POSTGRES_PASSWORD="<strong-pw>"
$env:SECRET_KEY="<min-32-random>"
$env:CORS_ORIGINS="http://localhost"   # or the real frontend origin
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps      # db + api healthy
Invoke-RestMethod http://localhost:8000/health                          # measured body
```

What happens at start: `db` waits on `pg_isready`; `api` runs
`alembic upgrade head` (creates all 15 tables incl. `alembic_version` at the
current head), then serves. With a placeholder `SECRET_KEY`, the api container
**refuses to boot** (`RuntimeError`, `Application startup failed`) — verified.

## 4. Database setup and migrations

- Fresh volumes migrate automatically via the entrypoint (`alembic upgrade head`).
- Never run `bootstrap_local_db` against Postgres (it only touches SQLite).
- New schema change procedure: add a migration under `migrations/versions/`,
  verify `alembic upgrade head` on a scratch volume, then ship (entrypoint
  applies it on next start). Rollback: `alembic downgrade -1` via
  `docker compose exec api alembic downgrade -1` (only for backward-compatible
  migrations; data-loss migrations need a backup first — see OPERATIONS_GUIDE).

## 5. HTTPS / TLS termination

TLS is terminated **outside** the compose stack (recommended: a reverse proxy
such as Caddy/nginx/Traefik or the cloud load balancer in front of `web:80`
and `api:8000`). The API already enforces HSTS in production, secure CORS
(explicit allowlist, credentials only with explicit origins), and security
headers (nosniff, DENY framing, no-referrer) via `SecurityHeadersMiddleware`.
Do not expose Postgres (unpublished in the prod overlay) or uvicorn directly.

## 6. Rollback procedure

1. Note the currently running image digests (`docker images`, or the git SHA
   the images were built from — rebuilds are pinned, so any SHA rebuilds
   byte-equivalent layers for the same lockfile).
2. `docker compose -f docker-compose.yml -f docker-compose.prod.yml down`
3. Restore the database from the pre-deploy backup if the deploy migrated
   schema forward incompatibly (see OPERATIONS_GUIDE backup/restore).
4. Check out the previous git SHA, rebuild, `up -d`, verify `/health` +
   smoke login.

## 7. Public-cloud rollout (NOT performed — decision record)

Per the phase constraint, deployment stops at local production-like
validation. When a platform is selected, the ship checklist is: managed
Postgres (or the same container with a cloud volume), secrets in the
platform's secret manager (never in the image), `VITE_API_URL` rebuilt per
environment, TLS at the edge, `SENTRY_DSN` set, and the OPERATIONS_GUIDE
monitoring/backup procedures pointed at cloud primitives. Record the
deployment URL, service config, and env set in FINAL_VALIDATION_REPORT.md at
that time.
