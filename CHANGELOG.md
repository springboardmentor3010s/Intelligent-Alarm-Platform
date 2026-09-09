# Changelog

All notable changes to this project are tracked here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [2026-09-08] — Timezone + 12/24-hour format system (web)

### Added
- **Searchable timezone picker** (`components/ui/TimezonePicker.jsx`): click → scrollable dropdown with a type-to-filter search box; matches zone names, cities, regions, offsets, and **plain country names** ("india" → Asia/Kolkata, "usa" → US zones) via `timeZoneTags()` alias map in `utils/timezones.js`; exact country matches rank first; arrow-key navigation + Esc/click-outside close. Used in Profile and the register form.
- **Web timezone + 12/24-hour format system**: `utils/timezones.js` (full IANA catalog via `Intl.supportedValuesOf('timeZone')` with fallbacks + offset labels, offset-sorted; guarantees `UTC` + `Asia/Kolkata` — some ICU builds omit them / use legacy names), `utils/timeFormat.js` (`ck-time-format` store + `formatDateTime`/`formatDate`/`formatWeekday`/`formatTimeOfDay`/`parseTimeOfDay`/`toTimeInputValue`), `components/ui/LiveClock.jsx` (fixed top-right ticking clock; timezone from `localStorage.user`), `components/ui/TimeInput.jsx` (12h → Hour/Minute/AM-PM selects, 24h → native `<input type="time">`; always emits `HH:MM`), `components/ui/LiveZoneTime` + 12/24 segmented control in Profile.
- **Backend `time_format` setting**: `User.settings.time_format` ("12"/"24", default "12") via `PUT /api/v1/users/time_format` (whitelisted `_SETTING_KEYS`) + returned in `GET /api/v1/users/settings`; `SettingsUpdateReq` extended; `GET /users/settings` response_model → `Dict[str, object]`; pytest `test_time_format_setting` (default "12", valid "24", invalid → 400, unknown key → 400).
- **Pages wired**: Profile (catalog timezone select + format toggle), Auth register (catalog select), Home (alarm time/next formatted per preference), AlarmManagement (TimeInput + formatted times), Admin (tz-aware `formatDate`).

### Changed
- Web test suite **42/42** (added TimezonePicker 6; timezones 3, timeFormat 6, TimeInput 4, LiveClock 2, Profile 3); backend pytest **33**; `npm run build` clean (37.40 KB CSS / 402.97 KB JS).

---

## [2026-09-08] — M4 backlog close-out + full local-run verification

### Added
- **Web app-shell UI pass (user-authored, committed)**: fixed 248px collapsible sidebar (`Sidebar.jsx`, `navSections.js`), global theme system (`theme.js` — shared `data-theme` + `ck-theme` persistence + cross-tab sync), auth design system (`Auth.test.jsx`, `ThemeToggle`, `login-bg.svg`), new Profile page, rebuilt Home/Dashboard/Alarms/Challenges/Reports/Settings/Admin as one cohesive product. Vitest 18/18 + `npm run build` clean.
- **Web test count corrected**: `web` Vitest is **18/18** (chartUtils 5 · Dashboard 1 · Auth 7 · App 5) — prior CHANGELOG/README entries had misreported `8`/`16`. Mobile jest 31/31 (unchanged).
- **Mobile shared-auth fix**: `context/AuthContext.jsx` (`AuthProvider` + `useAuthContext`) — login/logout/401-expiry now notify the whole tree instead of 7 independent `useAuth()` instances (login-stuck bug fixed). jest 31/31.
- **One-terminal launcher `run_all.bat`/`run_all.ps1`**: database → backend → web → mobile (**last**, foreground so the Expo QR + `a/w/r/q` keys render); colour-labelled job streaming; `-NoDb` / `-TimeLimitSec N` options; Ctrl+C stops all.
- **`run_all.ps1` Postgres path fixed**: waits for `pg_isready` then applies `alembic upgrade head` from the repo root (fresh Docker Postgres no longer 500s). Verified end-to-end on 2026-09-08 (10 tables incl. `push_tokens`).
- **Config hygiene**: `.gitignore` (+`.ruff_cache/`, coverage dirs, dedupe `web-build/`), `.gitattributes` (+`*.pptx binary`, `*.svg text eol=lf`), `.dockerignore` (+`presentation/`, `Completed Milestones/`, `.idea/`, `.expo/`, junk files).
- **Package-lock / migration HEAD updates**: README migration head → `992b0ec03dba`.

### Changed
- Full doc sync to current state: `README.md` (module %, Known Issues, Vitest (18), SRS v1.4, mobile env override note, docs table), `SRS.md` (header v1.4/2026-09-08 + revision row), `plan.md` (EXECUTED marker, smoke_m2 25/25), `context.md` (continuity rows). All `smoke_m2.py` references normalized to **25/25** (was misreported as 28/28).
- **Docs consistency sweep (2026-09-08)**: `context.md` tech-matrix refreshed (pytest **32**, git HEAD `230a83e`, GitHub Actions row ✅, FCM row → token registration wired, Android Alarm Manager → backlog, Level 15 CI scope → +web test/build + mobile jest); `push_tokens` + `alarm_roles` added to schema lists + ER diagram; `PRD`/`SRS` table count → 9 ORM (incl. `push_tokens` + `alarm_roles`); `README`/`backend/.env.example` SQLite filename normalized to `cerebrokognit.db`; `HRP` Level 3 status → DONE (bootstrap + Docker entrypoint).
- **Demo account zeroed (2026-09-08)**: removed all fake demo data (alarm + alarm_roles, 23 challenge attempts, 4 habit-score rows) and extra test users (`docker_user@test.com`, `p4@test.com`); `.gitignore`d root `cerebrokognit.db` stale file deleted. Demo is now one account with zero data; 3 roles + 7×5 static challenge grid retained.
- **Seeds no longer fabricate activity**: `bootstrap.py`/`init_db.py` no longer create a sample "Morning Boost" alarm or challenge for the demo user — fresh DBs start with zero activity.
- **Honest zero-data scoring**: `habit_scoring_service.get_or_compute_habit_score` returns `overall=0` (and writes no `habit_scores` row) when a user has no alarms and no attempts, instead of fabricating 70/50/70/60 defaults (overall 63). `/habits/score/history` keeps honest `null` gaps for inactive days.
- **CI dependency pins**: `backend/requirements.txt` + `requirements-runtime.txt` pin `fastapi==0.141.1` + `starlette==1.6.0` and add `httpx==0.28.1` (testing only). Fixes fresh-CI `RuntimeError: The starlette.testclient module requires the httpx2 package` caused by unpinned `fastapi>=0.109.0` resolving a starlette whose `TestClient` requires `httpx2`.

### Planned (backlog — unchanged)
- Broader flow-level test coverage (alarm-dismiss flow components).
- FCM/APNs delivery provider + local alarm scheduling on-device (needs Expo **dev build**; Expo Go disables push).
- Real cloud deployment + monitoring/alerting.

---

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