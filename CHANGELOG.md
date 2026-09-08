# Changelog

All notable changes to this project are tracked here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Architecture Alignment (2026-09-07)

### Added
- `plan.md` — approved architecture-alignment plan (phases P0–P7 + backlog).
- `ARCHITECTURE.md` — source-of-truth doc mapping implemented ↔ planned architecture.
- `CHANGELOG.md` — this file.
- **P1 Gateway hardening** (`gateway/`): request-id/trace middleware, structured logging, in-memory sliding-window rate limiting (`ERR_RATE_LIMIT` + `Retry-After`), `GET /api/v1/auth/register` (verify) + `GET /api/v1/auth/login` (inspector), CORS moved to env-config. Verified: 401/403/404/429/422 envelope smoke, `pytest` 23, smokes.
- **P2 Service modularization** — 12 domain modules (`user_service` incl. AuthService, `alarm_service`, `challenge_service`, `adaptive_difficulty_service`, `verification_service`, `behavior_analytics_service`, `habit_scoring_service`, `recommendation_service`, `analytics_service`, `report_service`, `admin_service`, `notification_service`); `api/*` routers now thin delegates; shims preserve public imports.
- **P3 AI/ML engine package** (`ai_engine/`): `interfaces.py` Protocols + `ENGINE_REGISTRY` + `engine_status`; `difficulty.py` (canonical ML engine), `recommendations.py`/`challenge_generation.py`/`behavior_analysis.py` (real adapters), `anomaly.py`/`performance_prediction.py` (planned stubs); `services/ml_inference.py` torch-tolerant facade so lean Docker runtime keeps rule-based fallback.
- **P4 Infra scaffolds**: optional Redis cache adapter (`services/cache.py`, active only if `REDIS_URL`), background-job interface (`workers/`), async report generation (`?async=1` + `GET /dashboard/reports/status/{job_id}`), `infrastructure/` docs (monitoring/logging/backup-dr/security-checklist).
- **P5 Notification service + push-token API**: `PushToken` model (unique token, user cascade), `POST|DELETE /api/v1/notifications/register`, `GET /api/v1/notifications/tokens`, idempotent re-register with ownership reassignment, `integrations/messaging.py` MessagingProvider protocol + NoopProvider (FCM/APNs planned), migration `992b0ec03dba` (push_tokens + restores `ix_users_email_lower` from Models/context that was never in the migration chain), 9 pytest tests (32 total).
- **P6 Frontend navigation (§21)**: `web/src/App.jsx` nav reorganized into Track / Plan / Account groups with tooltips; every destination reuses an existing page; Admin self-guards via RBAC.
- **Test coverage (frontend/mobile)**: `web` — Vitest + Testing Library (1 unit file `chartUtils` + `App`/`Dashboard` component tests, 8 tests), `vite.config.js` `test` block + `src/test/setup.js`; **found & fixed real `buildHabitCharts` bug** (keyed series by camelCase instead of the snake_case API contract → all four dashboard charts were empty). `mobile` — jest-expo (`preset: jest-expo`, SDK 57 peer-deps resolved via `overrides` `@react-native/jest-preset@0.86.0`), api utils + `useHabitScore` hook tests (14 tests). CI: web job now runs `npm test`, new `mobile` job runs `npm test -- --ci`.
- **Mobile offline-first sync + push notifications (M4 backlog)**: `notifications/registerPush.js` (acquireAndRegister/registerPushToken — Expo-Go guarded) wired into `useAuth` → POSTs the Expo token to `/api/v1/notifications/register` (P5) on login; `sync/{syncEngine,offlineStore,useSync,syncRequest}` — AsyncStorage-backed table cache (alarms/habit_scores/challenge_attempts) with `synced` flag, idempotent push to `/sync/pending` + pull via `/sync/pull`, triggered on Home focus with an offline banner + cached-data fallback; ChallengeScreen caches challenge payload + completed attempt locally. 17 new jest tests (mobile suite 31). Metro `expo export` bundles cleanly.
- **Final capstone presentation (M4 backlog)**: `presentation/CerebroKognit_Final.pptx` (15 slides, full speaker notes) generated reproducibly by `presentation/build_presentation.py` (python-pptx). Pyramid-ordered deck covering problem, cognitive-verification loop, architecture, milestones, backend/mobile/ML/web features, validation (32+31+8 tests), challenges, impact, and roadmap.

### Planned (backlog)
- Broader flow-level test coverage (alarm-dismiss flow components).
- FCM/APNs delivery provider + local alarm scheduling on-device.
- Real cloud deployment + monitoring/alerting (final presentation ✅ delivered 2026-09-07).
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
- Mobile E2E alarm dismissal flow; 7×5 challenge seed; `smoke_m2.py` (25 checks).

## [M1 — 2026-09-05]

### Added
- Auth + RBAC (env-driven JWT secret/CORS), profile/settings APIs, tz-aware alarms, migrations, `smoke_m1.py` (22 checks), initial commit.