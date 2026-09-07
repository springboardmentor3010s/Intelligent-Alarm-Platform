# Security Checklist

> Status: mixed — the auth/RBAC/env aspects are **implemented**; infrastructure
> hardening items are **planned**.

## Implemented (real)
- [x] Passwords hashed with bcrypt (12-round cost).
- [x] JWT (HS256) auth with 60-min access + 30-day refresh tokens; `SECRET_KEY`
      from environment (dev fallback documented in `.env.example`).
- [x] RBAC (User / Wellness Coach / Administrator) enforced via
      `app/api/deps.py:require_roles` on admin/coach endpoints (403 verified).
- [x] Pydantic v2 input validation on every endpoint.
- [x] Global structured error envelope `{detail, error_code, timestamp, status_code}`
      (no stack traces leaked).
- [x] In-memory sliding-window rate limiting on auth routes (60/min) + global
      (300/min) with `Retry-After`; 429 uses the same error envelope.
- [x] CORS origins from env (`CORS_ORIGINS`), credentials only with explicit origins.
- [x] Server-authoritative challenge verification — expected answers never leave
      the server (no answer leakage on `/next`).
- [x] SQLAlchemy parameterized queries (SQL-injection resistant).

## Planned
- [ ] Enforce `SECRET_KEY`/credentials strictly (fail-fast when unset in prod).
- [ ] pgcrypto / column encryption at rest (Dev uses SQLite; Postgres planned).
- [ ] Push-token storage hygiene (P5) — tokens encrypted at rest, revocable.
- [ ] HTTPS/TLS termination + HSTS on the public gateway.
- [ ] Dependency scanning (pip-audit/`dependabot`) wired into CI.
- [ ] Audit log of admin actions (user listing/report exports).
- [ ] OWASP Top 10 review pass before production deployment.

## Rules of thumb
- Never commit secrets; keep sensitive values in env/secret manager.
- Rate-limit auth endpoints at the gateway (already active).