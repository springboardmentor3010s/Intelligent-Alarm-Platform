# Changelog

All notable changes to this project are tracked here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Architecture Alignment (2026-09-07, in progress)

### Added
- `plan.md` — approved architecture-alignment plan (phases P0–P7 + backlog).
- `ARCHITECTURE.md` — source-of-truth doc mapping implemented ↔ planned architecture.
- `CHANGELOG.md` — this file.

### Planned (from `plan.md`)
- P1 Gateway hardening: request-id/trace middleware, structured logging, in-memory rate limiting.
- P2 Service modularization into 12 domain service modules (shims, no logic change).
- P3 AI/ML engine package (`backend/ai_engine/`) with clean interfaces + component facades/stubs.
- P4 Data/infra scaffolds: optional Redis adapter, background report generation, infrastructure docs.
- P5 Notification service + push-token registration API + integration adapters.
- P6 Web navigation hierarchy per architecture §21.
- P7 Docs sync + full architecture-consistency audit.

---

## [M4 core — 2026-09-07]

### Added
- Backend pytest suite (23 tests) verified on Python 3.11 + 3.14.
- Global structured error envelope `{detail, error_code, timestamp, status_code}`.
- GitHub Actions CI (ruff + pytest + smoke_m1 + smoke_m2 + web build).
- Admin UI page (`web/src/pages/Admin.jsx`) + `/admin` route.
- PDF/Excel report export (`format=csv|json|pdf|excel`) on all report endpoints.
- Fully-local mode: SQLite auto-init + seeding via `app/services/bootstrap.py`.
- Default ruff config (`backend/pyproject.toml`).

### Changed
- Docker: lean runtime image (torch excluded), migrations entrypoint, healthchecks, root build context.
- Fixed Python-3.14-only forward-ref bug in `schemas/auth.py` (order of `UserProfileRes`/`AuthRes`).

## [M3 — 2026-09-06]

### Added
- Trained `ml_models/difficulty_model.pt`; `ml-status model_loaded=true`.
- Recommendation engine (sleep/wake-up/habit/challenge) + `GET /analytics/recommendations`.
- Streak-factored habit scoring; real sleep/wake analytics; web wired to live data.

## [M2 — 2026-09-06]

### Added
- Server-authoritative challenge engine; `POST /challenges/submit`; no-answer-leak `/next`.
- Mobile E2E alarm dismissal flow; 7×5 challenge seed; `smoke_m2.py` (28 checks).

## [M1 — 2026-09-05]

### Added
- Auth + RBAC (env-driven JWT secret/CORS), profile/settings APIs, tz-aware alarms, migrations, `smoke_m1.py` (22 checks), initial commit.