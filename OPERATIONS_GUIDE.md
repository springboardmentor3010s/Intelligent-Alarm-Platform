# Operations Guide — CerebroKognit (Phase 9)

All commands assume PowerShell at the repo root with the production secrets
exported (see DEPLOYMENT_GUIDE.md §2). Use `-f docker-compose.yml
-f docker-compose.prod.yml` on every compose invocation (aliased as `$dc`
below for brevity).

## 1. Health checks

| Layer | Check | Healthy signal |
|---|---|---|
| Postgres | compose `healthcheck` (`pg_isready`) | `db` shows `(healthy)` in `ps` |
| API | compose `healthcheck` polls `/health` | `api` shows `(healthy)` |
| API (measured) | `GET /health` | `{status: healthy|degraded, uptime_seconds, db_connected, success_rate_percent}` |
| Web | compose `healthcheck` spiders `/` | `web` shows `(healthy)` |
| Platform | `GET /api/v1/dashboard/analytics` (admin) | `system_uptime_percentage` (measured lifetime success ratio), `uptime_seconds`, `db_connected` |

```powershell
$dc = "docker compose -f docker-compose.yml -f docker-compose.prod.yml"
Invoke-Expression "$dc ps"
Invoke-RestMethod http://localhost:8000/health
```

## 2. Logs

- API (structured request lines with request id, duration, status; alarm/notification lifecycle events):
  `... logs -f api` / `... logs --tail 100 api`
- Postgres: `... logs db`. Web (nginx access/error): `... logs web`.
- Log level via `LOG_LEVEL` (default `INFO`); uvicorn access logs are disabled
  by design in favor of the gateway request lines.

## 3. Monitoring procedure (no extra infra required)

1. Poll `GET /health` every 60s from any uptime monitor (Uptime Kuma,
   Better Uptime, cron+curl). Alert when `status != healthy`,
   `db_connected == false`, or the endpoint is unreachable.
2. Daily: read admin `/dashboard/analytics` — `system_uptime_percentage`
   is the measured lifetime API success ratio (gateway-fed counters);
   investigate sustained drops with `docker compose logs api`.
3. Errors: unhandled exceptions log with stack + request id; with
   `SENTRY_DSN` set they also ship to Sentry (PII disabled). Without a DSN,
   `docker compose logs` is the error store — rotate via the Docker
   `json-file` defaults or a log shipper.

## 4. Backup and restore (validated 2026-09-17)

Postgres is unpublished in production, so operate through `exec`:

```powershell
# Backup (custom format, timestamped; then copy off-host)
$dc2 = "docker compose -f docker-compose.yml -f docker-compose.prod.yml"
Invoke-Expression "$dc2 exec -T db pg_dump -U cerebro_user -d cerebro_kognit -F c -f /tmp/ck-backup.dump"
docker cp cerebrokognit-db:/tmp/ck-backup.dump .\backups\ck-backup.dump
# Restore (after down -v disaster or onto a fresh volume)
docker cp .\backups\ck-backup.dump cerebrokognit-db:/tmp/restore.dump
Invoke-Expression "$dc2 exec -T db pg_restore -U cerebro_user -d cerebro_kognit --clean --if-exists /tmp/restore.dump"
Invoke-Expression "$dc2 exec -T db psql -U cerebro_user -d cerebro_kognit -t -c 'SELECT count(*) FROM alarms;'"
```

Recommended schedule: nightly `pg_dump` + off-host copy; retain 7 daily + 4
weekly. Restore drills quarterly.

## 5. Restart recovery (validated 2026-09-17)

`docker compose ... restart db api` → both return healthy; all rows persist
(named volume `pg_data`); login + alarm reads succeed immediately after.
For host reboots, `restart: unless-stopped` brings the stack back; the api
entrypoint re-runs `alembic upgrade head` (idempotent) before serving.

## 6. Common incidents

| Symptom | Likely cause | Action |
|---|---|---|
| api crash-loops at boot, `SECRET_KEY ... placeholder` | placeholder/default secret | set a real `SECRET_KEY`, recreate api |
| api 500s on auth only | secret rotated mid-run or placeholder | same as above; tokens signed before rotation stay valid until expiry |
| compose refuses to start: `Set POSTGRES_PASSWORD...` | secrets not exported | export per DEPLOYMENT_GUIDE §2 |
| `/health` degraded, `db_connected=false` | Postgres down/full disk | `logs db`, check volume space, restart db |
| Habit scores look stale | normal: scores recompute on dismissal; history has honest gaps | no action unless errors in logs |

## 7. Upgrade procedure

1. Take a backup (§4). 2. `down`, rebuild (`--build`), `up -d`. 3. Watch
   entrypoint migration output, then `/health` + a smoke login. 4. Roll back
   per DEPLOYMENT_GUIDE §6 on any failure.
