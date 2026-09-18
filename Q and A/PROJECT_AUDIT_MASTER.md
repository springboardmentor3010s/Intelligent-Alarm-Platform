# PROJECT_AUDIT_MASTER — CerebroKognit (Intelligent Cognitive Alarm Platform)

Single source of truth consolidating all project reports, verified against
the live repository. Every status below was checked against source code on
the audit date; report-only claims that code does not support are
downgraded per the audit rules. No application source code was modified to
produce this document.

- Audit date: 2026-09-17 (UTC)
- Branch: `main` @ `082c9a9` ("feat: Phase 2 — authentication & security completion (backend)")
- Remote: `https://github.com/PawanSimha/CerebroKognit-InfosysInternship-B3.git` (`origin/main` identical — in sync)
- Working tree: **92 changed paths, uncommitted** (Phases 3–9 work-in-progress on top of HEAD); no stashes
- Audit type: static code inspection + executed runtime tests (see §13, §18)

---

# 1. Project Identity

| Item | Value |
|---|---|
| Project name | CerebroKognit |
| Purpose | Intelligent Cognitive Alarm Platform — alarms that require solving a cognitive challenge before dismissal, building consistent wake-up habits |
| Problem solved | Oversleeping, snooze abuse, and inconsistent mornings; generic alarms are dismissed unconsciously |
| Target users | End users (mobile + web), Wellness Coaches (cohort supervision), Administrators (platform oversight) |
| Main workflow | Register → login → create alarm → alarm triggers → solve challenge → verify server-side → dismiss → habit score recomputed → analytics/recommendations/reports update |
| Version / branch | `main` @ `082c9a9`; app version `1.0.0` (`mobile/package.json`, `backend/app/main.py`); SRS v1.13 |
| Repository status | Clean history, remote in sync; large uncommitted change set (see §18) |

---

# 2. Executive Summary

**Working (runtime-verified today):** registration/login/JWT lifecycle, RBAC
(User/Coach/Admin), profile/settings, alarm CRUD + recurring + snooze cap +
server-authoritative challenge verify + single-use dismissal, 35/25/20/20
habit scoring, analytics, explained recommendations, coach cohort scoping,
manual productivity tracking + gated correlation, CSV/JSON/PDF/Excel reports,
offline sync protocol, rate limiting, security headers, measured
uptime/health, Docker builds + local prod-like deployment (migrate, E2E flow,
restart recovery, backup/restore all executed).

**Partially working:** push pipeline (server + provider + on-device code
complete, real-device delivery never observed); anomaly/forecast (gated
statistical baselines, not trained models); error tracking (Sentry hook
present, no DSN ever set); monitoring (health endpoints real, no external
monitor configured); web PWA-style installability not assessed.

**Missing:** public-cloud deployment (deferred by constraint — no cloud
files, registry, or URL exist); browser-driven E2E harness; dependency
vulnerability scanning; `last_login` tracking (field exists, always null);
server-side logout endpoint (client discards tokens); direct FCM integration
(`FCM_SERVER_KEY` documented but unused in code); face/voice/image/QR
verification (no requirement in SRS/PRD and no code — not applicable).

**Broken:** nothing confirmed broken. All executed suites pass.

**Main risks:** (1) 92 uncommitted paths across six phases — loss/regression
risk until committed phase-by-phase; (2) difficulty-model weights file is
gitignored and absent from fresh clones (by design — rule fallback covers
it — but CI never exercises the torch path); (3) production secrets exist
only as local env/`.env` (untracked); (4) real-device alarm/notification
behavior is the largest unverified surface.

**Most important next actions:** commit the backlog in phase-separated
commits; run the real-device checklist (`mobile/REAL_DEVICE_CHECKLIST.md`);
select a cloud target and perform the deferred rollout using
`DEPLOYMENT_GUIDE.md`; set `SENTRY_DSN`; add dependency scanning to CI.

---

# 3. Original Project Requirements

Sources: `SRS.md` (v1.13), `PRD.md`, `Project Details.pdf` (1.8 MB, original
spec — see §20 for parse limitation), `README.md`, `Q and A/*.md` audits.

| Requirement | Source doc | Wording / essence |
|---|---|---|
| Authentication and user profiles | SRS FR-AUTH-*, FR-UP-001; PRD | bcrypt registration, JWT login HS256, RBAC User/Coach/Admin, profile with timezone/difficulty |
| Alarm creation and scheduling | SRS FR-AS-* | One-time/Daily/Weekday alarms, `next_trigger` computation, recurrence |
| Challenge generation | SRS FR-CE-* | 7 types (Math/Logic/Memory/Word/Pattern/Riddle/QuickQuiz) × 5 difficulties, adaptive selection |
| Face/voice/image/QR verification | — | **No such requirement found in SRS.md/PRD.md**; listed here only because audit scope asked |
| Alarm dismissal | SRS (dismissal flow) | Dismissal gated on completed all-correct server-verified attempt |
| Habit tracking | SRS FR-UP-002 | Daily 35/25/20/20 composite in `habit_scores` |
| Cognitive/wellness scoring | SRS FR-CE-003/FR-DA-001 | Performance-based difficulty adaptation |
| Adaptive difficulty | SRS FR-CE-003 | ML prediction clamped to ±1 band + rule fallback |
| AI recommendations | SRS FR-RE-001..004 | Sleep/wake/habit/challenge, priority-sorted, explained |
| User dashboard | SRS FR-DD-001 | Score ring, pillars, trend charts |
| Wellness Coach dashboard | SRS FR-DD-002 | Cohort roster + per-user detail, scoped |
| Admin dashboard | SRS FR-DD-003 | Platform telemetry, user directory, role management |
| Notifications | SRS §2.9 | Push-token registry, Expo relay (FCM/APNs), on-device scheduling |
| Reports and exports | SRS FR-REP-* | Habit/wake/challenge/productivity in CSV/JSON/PDF/Excel |
| Productivity correlation | SRS FR-BA-003, FR-REP-004 (Low, optional) | User-logged productivity correlated with wake consistency |
| Offline support | SRS FR-OFF-* | AsyncStorage cache + idempotent sync up/down |
| Security | SRS NF-SEC-*, §9 | Env secrets, validation, CORS, headers, rate limits, audit log |
| Testing | SRS §10 matrices | pytest/Vitest/jest + smokes + CI |
| Docker and deployment | SRS §10 infrastructure | Images, compose, migrations entrypoint, healthchecks |
| Monitoring and logging | OPERATIONS_GUIDE.md | `/health`, measured uptime, structured logs, Sentry hook |

---

# 4. Technology Stack

| Layer | Technology | Version | Actual usage | Evidence | Status |
|---|---|---|---|---|---|
| Backend | Python / FastAPI / Uvicorn | 3.14 venv (3.11-slim image) / 0.141.1 / 0.52.4 | Entire API | `backend/app`, `Dockerfile` | Implemented |
| Backend DB ORM | SQLAlchemy | 2.0.52 | All models/sessions | `Models.py`, `database.py` | Implemented |
| Database | PostgreSQL 15 (prod) / SQLite (dev/test) | `postgres:15-alpine` | 14 tables via 8 linear migrations | `docker-compose.yml`, `migrations/versions/` | Implemented |
| Auth | PyJWT HS256 + bcrypt | 2.13.0 / 5.0.0 | JWT lifecycle, `gensalt()` default rounds (12) | `services/user_service.py:8,37-43`, `:26,46-71` | Implemented |
| AI/ML | PyTorch | 2.13.0+cpu (dev only) | Difficulty net only, guarded import | `ai_engine/difficulty.py` | Implemented (synthetic-trained, advisory) |
| AI/ML | torchvision / scikit-learn / XGBoost / pandas / numpy | declared | **Zero imports in `backend/app`** | grep: no matches | Planned (unused deps) |
| Computer vision | — | — | None; no face/image code anywhere | grep `face\|voice\|biometric` → only CSS "surface" matches | Not applicable |
| Notifications | Expo Push Service relay + `expo-notifications` | SDK ~57 | Provider + on-device scheduling code; Android perms in manifest | `integrations/messaging.py:58-`, `mobile/app.json:21-26,37` | Partially implemented (no device proof) |
| Notifications | Direct FCM | — | `FCM_SERVER_KEY` in `.env.example` but **zero code references** | grep: no matches | Not implemented |
| Cache | Redis | declared (`aioredis`) | `services/cache.py` exists, **zero callers**, active only if `REDIS_URL` set | grep: no callers | Planned (scaffold) |
| Testing backend | pytest + pytest-cov | 9.1.1 | 12 files, 187 tests executed | `backend/tests/`, §13 | Implemented |
| Testing web | Vitest + Testing Library | Vitest 2 | 14 files, 56 tests executed | `web/src/**/*.test.*` | Implemented |
| Testing mobile | jest-expo | ~57 | 13 suites, 75 tests executed | `mobile/src/**/*.test.*` | Implemented |
| Containerization | Docker + Compose v5.3.1 | client/server 29.6.2 | api+web images build; local prod validation executed | `backend/Dockerfile`, `web/Dockerfile`, `FINAL_VALIDATION_REPORT.md` | Implemented (local) |
| CI/CD | GitHub Actions | — | backend/web/mobile jobs (lint+tests+smokes+build) | `.github/workflows/ci.yml` | Partially implemented (remote runs never observed here) |
| CI/CD | Security scanning / registry / deploy | — | Absent from workflow | `ci.yml` (92 lines, no scan/push/deploy) | Planned |
| Cloud deployment | — | — | No cloud files, no URL, explicitly deferred | repo-wide grep: none | Planned |
| Monitoring | `/health`, `system_status`, admin analytics | — | Measured uptime/DB/success-ratio, live | `main.py:health_check`, `services/system_status.py` | Partially implemented (no external monitor) |
| Logging | stdlib structured + gateway request lines | — | Request id/duration/status; alarm/notify lifecycle | `gateway/logging.py`, `middleware.py` | Implemented |
| Error tracking | Sentry SDK hook | 2.41.0 (runtime pin) | Initialized only if `SENTRY_DSN` set (never set in repo) | `main.py:61-70` | Partially implemented (opt-in, unverified live) |
| Security scanning | — | — | None in repo or CI | — | Planned |

---

# 5. Repository and Architecture

**Top level:** `backend/` (FastAPI app, tests, scripts, Dockerfile),
`web/` (React 18 + Vite 5 + Chart.js, Dockerfile + nginx), `mobile/`
(Expo SDK 57, React Native 0.86), `migrations/` (8 Alembic revisions),
`docker-compose.yml` + `docker-compose.prod.yml`, `Q and A/` (5 prior
audits), root docs (SRS/PRD/README/context/TEST_STATUS/guides/reports).

**Backend** (`backend/app/`): `api/` (12 routers: `alarms`, `analytics`,
`auth`, `challenges`, `dashboard`, `deps`, `feedback`, `habits`,
`notifications`, `productivity`, `sync`, `users`); `services/` (22 modules:
alarm, challenge, verification, habit_scoring, behavior_analytics,
recommendation, report/export, admin, coach, productivity, notification,
adaptive_difficulty, system_status, token, audit, user, auth, bootstrap,
cache, ml_inference facade, feedback); `ai_engine/` (8 modules);
`core/config.py` (env + fail-fasts); `gateway/` (request-id/rate-limit
middleware, security headers, logging); `integrations/` (messaging
providers, email sender); `workers/` (report job queue); `Models.py`
(14 tables); `schemas/` (Pydantic v2 + dead `all.py`).

**Frontend** (`web/src/`): `pages/` (Home, Dashboard, AlarmManagement,
ChallengeGenerator, Reports, Profile, Settings, Admin, Auth, Landing),
`components/` (ui design system, auth, landing, layout), `utils/`
(`api.js`, `chartUtils.js`, `timeFormat.js`, `timezones.js`), `theme.js`,
`navSections.js` (Track/Plan/Insights/Account/Administration).

**Mobile** (`mobile/src/`): `screens/` (Login, Home/Alam/Challenge/Profile/
Settings, AlarmForm, Feedback + `tabs/` Home/Alarms/Insights/Profile),
`hooks/` (`useAuth`, `useChallenge`, `useHabitScore`, `useAlarmScheduler`,
`useSync`), `notifications/` (scheduleAlarm pure planner, expoNotifier
native wrapper, registerPush), `sync/` (offlineStore, syncEngine),
`context/AuthContext`, `theme/`, `components/` incl. MainTabs + ui set.

**AI/ML** (`backend/app/ai_engine/`): `difficulty.py` (v1.0.0 net + 6-signal
`rule_based_v2` + explanations + versioned status + PII-free logging),
`features.py` (frozen 4-feature contract + clamping), `recommendations.py`,
`challenge_generation.py`, `behavior_analysis.py` (adapters over tested
services), `anomaly.py` + `performance_prediction.py` (gated statistical
baselines), `interfaces.py` (ENGINE_REGISTRY: 4× implemented, 2×
implemented-baseline). Weights: `backend/ml_models/difficulty_model.pt`
(gitignored, synthetic-trained) + tracked `difficulty_model.meta.json`
provenance record.

**Database** (`Models.py`, 14 tables): `users`, `roles`, `user_roles`,
`alarms`, `challenges`, `challenge_attempts` (+`expires_at`, `consumed_at`,
`answer_meta`), `habit_scores`, `push_tokens`, `alarm_roles`,
`coach_assignments`, `auth_tokens`, `audit_logs`, `feedback`,
`productivity_logs`. Key indexes: `ix_users_email_lower`,
`ix_alarms_user_id/next_trigger`, `ix_challenges_type_difficulty`,
`ix_attempts_user_challenge/expires_at`, `ix_habit_scores_user_date`,
`uq_push_tokens_token`, `uq_coach_assignments_coach_user`,
`uq_productivity_logs_user_date`, `uq_auth_tokens_token_hash`.
Migration chain is linear, 8 revisions, head `f2b1d8e4a903`.

**Config:** `backend/.env.example` (59 lines, all envs documented);
`DATABASE_URL`, `SECRET_KEY` (prod fail-fast on placeholder),
`CORS_ORIGINS` (explicit allowlist, never `*`; prod fail-fast on empty),
`PUSH_PROVIDER=noop|expo` (default noop strict-raise), `ENVIRONMENT`,
`SENTRY_DSN` (optional). Compose secret guards (`${VAR:?msg}`) abort
without real secrets.

**API structure:** ~52 endpoints under `/api/v1` (full inventory §8) +
`GET /health` (measured) + `/docs`, `/openapi.json`.

**Flows:**
- Auth: register (bcrypt) → login (access 60 min + refresh 30 d, SHA-256 stored, single-use rotation) → `get_current_user` → RBAC `require_roles`.
- Alarm: create (tz-aware `next_trigger`) → stored → list/sync → trigger (server notify + on-device schedule) → snooze (cap 5) or challenge gate.
- Challenge: `/next` creates pending expiring snapshot (answers server-only) → client submits → `submit_attempt` verifies once → 200/400/404/409/410.
- Verification: ownership + completed + all-correct + unconsumed checks in `verification_service`.
- Dismissal: `dismiss_alarm` verifies, disables one-time (reschedules Daily/Weekday), stamps `consumed_at` (replay-proof), refreshes habit score.
- Scoring: 35/25/20/20 composite in `habit_scoring_service` (single source; zeros for no-activity accounts; honest `None` history gaps).
- Analytics: `/analytics/me` derivations; recommendations (10 threshold rules, each with `reason` + `source_metric`); gated anomaly/forecast baselines.
- Deployment: images → prod overlay → entrypoint migrates → health-gated startup (see §14).

---

# 6. Feature Implementation Matrix

| Feature | Requirement | Implementation Location | Current Status | Evidence | Missing Work | Risk |
|---|---|---|---|---|---|---|
| User registration | FR-AUTH-001 | `api/auth.py:42`, `services/user_service.py` | Implemented | pytest `test_auth.py` (8), smoke register | — | Low |
| Login | FR-AUTH-002 | `api/auth.py:98` | Implemented | pytest + smoke login | — | Low |
| Logout | implied | none (client discards token; `users/deactivate` revokes refresh) | Partially implemented | No `/logout` route in inventory | Server logout endpoint (low value) | Low |
| Password hashing | NF-SEC-001 | `services/user_service.py:37-43` (bcrypt `gensalt`, 12 rounds) | Implemented | `test_auth.py` | — | Low |
| Token handling | FR-AUTH-002/004 | `services/auth.py` (HS256, 60m/30d), `token_service.py` (hashed, single-use) | Implemented | `test_security.py` refresh/rotation/reuse (49) | — | Low |
| User profile | FR-UP-001 | `api/users.py`, `web/.../Profile.jsx`, mobile ProfileScreen/Tab | Implemented | API + Vitest + jest | — | Low |
| Alarm creation | FR-AS-* | `api/alarms.py:24`, `AlarmFormScreen.jsx`, `AlarmManagement.jsx` | Implemented | pytest, jest, Vitest, E2E W04 | — | Low |
| Alarm editing | FR-AS-* | `api/alarms.py:34` (+ mobile form, web form) | Implemented | API tests | — | Low |
| Alarm deletion | FR-AS-* | `api/alarms.py:45` (+ UI confirms) | Implemented | API tests | — | Low |
| One-time alarms | FR-AS-002 | `alarm_service` (stays disabled after dismiss) | Implemented | E2E W04/W11 | — | Low |
| Recurring alarms | FR-AS-002 | Daily/Weekday auto `next_trigger` | Implemented | E2E W05 | — | Low |
| Time-zone handling | FR-UP-004 | IANA tz stored, tz-aware datetimes, picker + 12/24h UI | Implemented | `timezones.test.js`, tz tests | — | Low |
| Local device alarm scheduling | §2.9 | `mobile/src/notifications/{scheduleAlarm,expoNotifier}.js`, `useAlarmScheduler`, Android exact-alarm perms | Partially implemented | jest (scheduleAlarm tests); **no device execution** | Real-device pass | High (core promise) |
| Push notification delivery | §2.9 | `ExpoPushProvider` + dedupe + pruning + `/notify` | Partially implemented | 21 pytest w/ mocked transport; **no live delivery observed** | Credentials + device test | High |
| FCM/APNs integration | §2.9 | Via Expo relay only; `FCM_SERVER_KEY` unused in code | Partially implemented | `messaging.py:58-`; zero FCM refs | Direct FCM (not required) | Medium |
| Challenge generation | FR-CE-001/002 | `challenge_service` generators (7×5), `/challenges/next` | Implemented | 23 hardening tests (35-combo matrix) | — | Low |
| Challenge validation | FR-CE-004/WV-001 | `submit_attempt` + `results_for` (no leak) | Implemented | Hardening + E2E W07–W10 | — | Low |
| Face verification | — (no SRS/req) | none | Not applicable | grep: no code (only CSS "surface") | — | None |
| Voice verification | — (no SRS/req) | none | Not applicable | grep: no code | — | None |
| Image verification | — (no SRS/req) | none | Not applicable | grep: no code | — | None |
| QR verification | — (no SRS/req) | none | Not applicable | grep: no code | — | None |
| Retry handling | FR-WV | Single-submit 409, expiry 410, consumed-at 409 | Implemented | Hardening tests | — | Low |
| Alarm dismissal | dismissal flow | `alarm_service.dismiss_alarm`, mobile AlarmScreen | Implemented | E2E W11, smoke_m2 | — | Low |
| Habit score | FR-UP-002 | `habit_scoring_service` (documented formula) | Implemented | Formula + consistency tests, E2E W12 | — | Low |
| Wake-up score | FR-UP-002 (component) | `wake_up_consistency` pillar (no standalone endpoint) | Partially implemented | Same tests; component-level only | Standalone metric (not required) | Low |
| Cognitive score | FR-CE (component) | `challenge_completion` pillar (no standalone endpoint) | Partially implemented | Same tests; component-level only | Standalone metric (not required) | Low |
| Adaptive difficulty | FR-CE-003 | v1.0.0 net (synthetic) + 6-signal rules, ±1 clamp | Implemented | 17 AI tests + eval 0.935 held-out | Real-data retraining (future) | Medium (expectation mgmt) |
| AI recommendations | FR-RE-001..004 | 10 threshold rules, reason+source_metric | Implemented | Rec/endpoint tests, E2E W14 | Learned ranker (future) | Low |
| Wellness Coach | FR-DD-002 | `coach_assignments` + scoped endpoints + web coach mode | Implemented | Cohort ACL tests, `Admin.test.jsx` | Mobile coach UI (coaches use web; documented) | Low |
| Productivity correlation | FR-BA-003 | User-entered logs + gated Pearson (association-only) | Implemented | 9 productivity tests | — | Low |
| User analytics | FR-BA-*/DD-001 | `/analytics/me`, Dashboard, InsightsTab | Implemented | E2E W13, Vitest, jest | — | Low |
| Admin analytics | FR-DD-003 | `/dashboard/analytics` (measured uptime), Admin.jsx | Implemented | Uptime tests | — | Low |
| Reports | FR-REP-* | 4 report types, JSON/CSV/PDF/Excel, async jobs | Implemented | Export tests, E2E W15 | — | Low |
| PDF export | FR-REP-001/002/005 | `report_export._build_pdf` (reportlab) | Implemented | `%PDF` assertions | — | Low |
| Excel export | FR-REP-005 | `report_export._build_xlsx` (openpyxl) | Implemented | `PK` assertions | — | Low |
| Offline support | FR-OFF-* | AsyncStorage cache + offline banners/fallbacks | Implemented | `offlineStore.test.js`, screen fallbacks | Device E2E | Medium |
| Synchronization | FR-OFF-003/007 | `/sync/pending` idempotent upsert + `/sync/pull` | Implemented | `syncEngine.test.js`, sync tests | — | Low |
| Error handling | NF-FT-003 | Global envelope `{detail, error_code, timestamp, status_code}` | Implemented | All suites assert through it | — | Low |
| Audit logging | Phase 2 | `audit_logs` + `log_event` on auth/role events | Implemented | `test_security.py` audit class | Broader event coverage | Low |
| Security headers | Phase 2 | `gateway/security_headers.py` (nosniff/DENY/CSP/referrer/HSTS-prod) | Implemented | Header tests | — | Low |
| CORS | NF-SEC-005 | Explicit allowlist, prod fail-fast, never `*` | Implemented | Config tests | — | Low |
| Rate limiting | gateway | 60/60s auth, 300/60s global, sliding window + 429 | Implemented | `reset_limiters` test isolation; 429 body verified | — | Low |
| Password reset | Phase 2 | Hashed single-use 30-min tokens, generic replies | Implemented | Reset tests (request/confirm/reuse/expired) | Email delivery (NoopSender) | Medium (needs SMTP) |
| Email verification | Phase 2 | Hashed single-use 24h tokens | Implemented | Verify tests | Email delivery (NoopSender) | Medium (needs SMTP) |
| Docker | §10 | api+web Dockerfiles, non-root, pinned | Implemented | Images built; local prod run executed | — | Low |
| Docker Compose | §10 | dev + prod overlay, healthchecks, volumes | Implemented | Full validation run executed | — | Low |
| CI/CD | §10 | `ci.yml` (ruff+pytest+smokes / vitest+build / jest) | Partially implemented | Config present; remote runs not observed here | Observe a green run; add scan | Medium |
| Security scanning | — | none in repo or CI | Planned | Absent | Add pip-audit/npm audit | Medium |
| Cloud deployment | deferred | none (no files/URL) | Planned | Explicit decision record | Platform selection | Medium |
| Monitoring | OPERATIONS_GUIDE | Measured `/health` + uptime metric + logs + Sentry hook | Partially implemented | Live `/health` observed; no external monitor/DSN | Monitor + DSN | Medium |
| Logging | OPERATIONS_GUIDE | Structured gateway lines, lifecycle logs | Implemented | Observed in container logs | — | Low |

---

# 7. End-to-End Workflow Audit

Traced live on 2026-09-17 against production containers
(register→`9-5`→dismiss→habit 73) and via `test_e2e_workflows.py` (9 tests,
all passing). Statuses: steps 1–5,7–17 server paths Implemented and
executed; step 6 device leg Partially implemented (code + unit tests, no
device observation).

| # | Step | Endpoint / component / function | In → Out → DB | Ext. deps | Status | Failure points |
|---|---|---|---|---|---|---|
| 1 | Registration | `POST /auth/register` → `user_service` | email/pw → `AuthRes` + `users`/`user_roles` rows | none | Implemented | dup email 400 (tested) |
| 2 | Login | `POST /auth/login` | credentials → token pair; failed attempts audited | none | Implemented | 401 wrong pw (tested); brute force only rate-limited |
| 3 | Create alarm | `POST /alarms` → `alarm_service.create_alarm` | title/time/type → `AlarmRes` + `alarms` row, tz-aware trigger | none | Implemented | invalid time → 422 (tested) |
| 4 | Stored | `alarms` table (+ `/sync` offline mirror) | row + idempotent upsert | Postgres/SQLite | Implemented | volume loss → backups (procedure tested) |
| 5 | Scheduled | `next_trigger` compute; recurring auto-advance | schedule fields | none (server); device clock (mobile) | Implemented (server) | TZ edge cases at DST (not tested) |
| 6 | Triggered | `POST /alarms/{id}/notify` + on-device `expo-notifications` schedule | alarm id → provider fan-out / local fire | Expo relay / OS alarms | Partially implemented | No device proof; Expo Go can't receive pushes |
| 7 | Open alarm | `AlarmScreen.jsx` (+ tap routing) | notification data → challenge gate | — | Implemented (code) | Unverified on device |
| 8 | Generated | `GET /challenges/next` → `get_adaptive_challenge` | prefs → pending attempt (answers server-only) | ML weights or rules | Implemented | None observed |
| 9 | Completed | `ChallengeScreen.jsx` / simulator | answers → POST `/submit` | — | Implemented | Timer text-size a11y acceptable |
| 10 | Verified | `ChallengeService.submit_attempt` | answers vs snapshot → per-question results | none | Implemented | Replay/expired/cross-user rejected (tested) |
| 11 | Dismissed | `POST /alarms/{id}/dismiss` | attempt id → disabled/rescheduled + `consumed_at` | none | Implemented | Double-dismiss 409 (tested) |
| 12 | Recorded | `refresh_habit_score`, attempt rows | dismissal → `habit_scores` upsert | none | Implemented | Concurrent upsert guarded (IntegrityError path) |
| 13 | Scored | `compute_habit_composite` 35/25/20/20 | components → 0–100 int | none | Implemented | Formula asserted in tests |
| 14 | Dashboard | Home/Dashboard/InsightsTab | score/history APIs → rings/charts | none | Implemented | Gap rendering tested |
| 15 | Recommended | `generate_recommendations` (10 rules) | analytics → 6 max, reason+metric | none | Implemented | Empty-data → zero recs (tested) |
| 16 | Analytics | `/analytics/me`, anomalies, forecast | rows → summary + gated baselines | none | Implemented | Gates return `available:false` (tested) |
| 17 | Exported | `/dashboard/reports/*` (?async supported) | rows → csv/json/pdf/excel | none | Implemented | Byte-signature assertions |

---

# 8. Backend Audit

**Routes:** ~52 endpoints across 12 routers + `/health` (full inventory verified
by grep, §7 table; no undocumented routes found beyond `/docs`/`/openapi.json`).
**Schemas:** Pydantic v2 throughout; `schemas/all.py` is dead code (0%
coverage, zero imports) — retained, flagged for deletion.
**AuthN/Z:** `get_current_user` on all protected routes; `require_roles`
staff/admin gates; ownership checks per resource (404/403 matrix tested).
**Models/indexes:** 14 tables (§5); unique constraints on tokens, cohort
pairs, log dates, token hashes; FK cascades to users.
**Validation:** Pydantic + explicit 422s (score ranges, date formats, future
dates, `days` 1..365); answer coercion validators.
**Errors:** global envelope handlers; challenge codes 400/404/409/410.
**Background tasks:** `workers/job_queue` + `?async=1` report jobs with
status endpoint (implemented; thin coverage).
**Providers:** `NoopProvider.send` raises `NotImplementedError` by design
(default); `ExpoPushProvider` posts to Expo relay, prunes
`DeviceNotRegistered`/`MismatchSenderId`, dedupes in-process.
**Services:** alarm/challenge/verification/scoring/analytics/admin/coach/
productivity/notification/adaptive-difficulty/system-status/token/audit/user/
report — all exercised by tests; `cache.py` has zero callers (Redis unwired).
**Logging:** structlog-style stdlib config + gateway lines; **no secret/token/
password values are logged** (verified by grep of log statements; auth
failures log emails/outcomes only).
**Config/env:** 20+ documented vars; prod fail-fasts for SECRET_KEY, CORS,
PUSH_PROVIDER; boot-time guard in lifespan (tested + container-verified).
**Hard-coded/fallback audit:** former `99.9` uptime removed (measured);
sleep default 7.5h and trend `"stable"` are documented no-data defaults, not
fabrications; `last_login` always null (TODO placeholder); dev CORS/secret
defaults exist but are refused in production (fail-fast tested).
**Unreachable/dead:** `schemas/all.py`, `services/cache.py` (uncalled),
`FCM_SERVER_KEY` (documented, zero code refs), `MODEL_DIR`/`DEVICE` envs
(documented, unused by loader).

---

# 9. Frontend and Mobile Audit

**Web (React 18.3, Vite 5.4, Chart.js 4.4, custom CSS — Tailwind installed
but unused):** 10 pages, all API-connected (no mock-data pages remain):
Home (score ring, next-alarm countdown, pillars, trend), Dashboard
(telemetry, 4 pillar charts, recommendations), AlarmManagement (CRUD + form),
ChallengeGenerator (catalog, tuner, practice simulator, wake-gate),
Reports (score, trajectory, wake timeline, productivity log+trend+
correlation, 4 export tiles), Profile, Settings, Admin (admin telemetry +
coach cohort mode + user detail), Auth, Landing. States: skeletons,
ErrorState+retry, honest empty states, 404-gated (`require`d roles surface
as Access Restricted). 14 test files / 56 tests, all passing.
**Mobile (Expo 57, RN 0.86, 14 screens):** AuthContext session with
401-expiry handling; tab nav (Home/Alarms/Insights/Profile); alarm
CRUD + offline cache/fallback + on-device schedule sync; challenge flow with
per-question feedback, countdown, numeric keyboards, 409/410 recovery;
Insights (pillars, tracks incl. productivity read-only); sync engine
(push/pull, idempotent); push-token registration on login; tap-to-open
routing. 13 suites / 75 tests, all passing. **Platform limits (verified in
manifest/code):** Expo Go cannot receive push tokens (dev build required);
exact-alarm/schedule permissions declared; background firing and delivery
are code-complete but have zero device observations.

---

# 10. AI and Machine Learning Audit

| Feature | Class | Evidence |
|---|---|---|
| Difficulty prediction (net) | **Real model inference** (narrow) | `DifficultyPredictor` 4→16→5 torch net, `difficulty_model.pt` loads when torch present; `ml-status model_loaded=true` observed |
| Training data | **Synthetic, rule-generated** (seed 42, 20k rows) | `scripts/train_difficulty_model.py:30-57`; tracked `difficulty_model.meta.json` provenance record |
| Model evaluation | Measured: 0.935 held-out synthetic accuracy (fresh seed), monotonic sweep, extreme sanity | `scripts/evaluate_difficulty_model.py` → PASS (re-ran in Phase 6) |
| Difficulty fallback | **Rule-based logic** (6 transparent signals, explained) | `rule_based_v2`, neutrality/monotonicity tests; runs exclusively in lean Docker image |
| Difficulty serving guard | Heuristic clamp ±1 band | `challenge_service` band clamp (tested) |
| Recommendations (10 rules) | **Rule-based logic** | Thresholds in `recommendation_service.py`; reason+metric tests |
| Challenge generation | **Deterministic templates** (seeded), not ML | 35-combo solve matrix |
| Behavior analytics | **Closed-form derivations** | Consistency tests (report ≡ dashboard) |
| Anomaly detection | **Heuristic baseline** (gated statistics) | Gate + spike tests; labeled `baseline`, not a model |
| Performance forecast | **Heuristic baseline** (least-squares trend) | Gate + slope-math tests; labeled `baseline-linear` |
| Face embeddings / similarity / CV | **Not implemented** | Zero code; torchvision unused |
| Online learning / retraining pipeline | **Not implemented** | Documented as future in `AI_FEATURES.md` |
| Explainability | Rule votes + rec reasons + difficulty explanations | Tested strings |
| Privacy | No user data in training; inference logs method+transition only; no PII in AI logs | Code review of log statements |

Nothing in docs reviewed describes rules as advanced AI (`AI_FEATURES.md`
limitations §1–6; Q&A audit states rule-based plainly).

---

# 11. Database and Data Integrity Audit

- **Technology:** PostgreSQL 15-alpine (prod compose) / SQLite file (dev) / SQLite memory (tests). No MongoDB anywhere (architecture-diagram-only reference).
- **Tables/fields/relations/indexes:** §5; FK cascades from users; composite uniques prevent duplicate push tokens, cohort pairs, daily logs/scores, token hashes.
- **Duplicate prevention:** idempotent `/sync/pending` upserts (tested); same-day productivity upsert; single-submit + `consumed_at` replay guard.
- **Validation:** Pydantic at edge; DB constraints as second layer; naive datetimes coerced to UTC-aware on read paths.
- **Migrations:** linear 8-revision Alembic chain, head `f2b1d8e4a903`; entrypoint auto-applies on Postgres; fresh-DB upgrade verified in-container.
- **Seed data:** `bootstrap.py` (SQLite only) seeds roles + 35 challenges + demo user (`demo@cerebro.com` / documented dev password); `scripts/init_db.py` for manual seeding.
- **Synthetic data:** ML training set only (20k rows, generator in repo); no synthetic user/behavior data in app flows.
- **Retention:** no retention/purge policy found — flagged (ID-14).
- **Backup/recovery:** named volume + validated `pg_dump`/`pg_restore` round-trip (0→1 alarm) in `FINAL_VALIDATION_REPORT.md`; schedule documented in `OPERATIONS_GUIDE.md`.
- **Privacy-sensitive data:** emails, password hashes (bcrypt), push tokens, notes, answers. Hashed tokens stored (SHA-256); raw tokens never persisted (tested). No encryption-at-rest beyond platform defaults (flagged ID-13).

---

# 12. Security Audit

**Audit type: static code inspection + runtime test execution
(`test_security.py`, 49 tests, all passing). No dependency scan, no
penetration test, no dynamic fuzzing were performed.**

| ID | Issue | Severity | Evidence | Impact | Recommended fix |
|---|---|---|---|---|---|
| S-01 | No dependency vulnerability scanning | Medium | `ci.yml` has no audit step; `pip-audit`/`npm audit` never run | Known-CVE deps could ship unseen | Add `pip-audit` + `npm audit` to CI |
| S-02 | Email delivery is a no-op stub | Medium | `NoopSender` raises; reset/verify tokens only test-observable | Password-reset/verify unusable in prod without SMTP | Configure SMTP provider before any prod user rollout |
| S-03 | Brute force = rate limits only (60/min/IP auth) | Low | `gateway/rate_limit.py:44-45`; no lockout/backoff | Credential stuffing at low rate possible | Account lockout or CAPTCHA at rollout |
| S-04 | Demo credentials in bootstrap (`demo@cerebro.com`) | Low | `services/bootstrap.py:27-28`; SQLite-dev only | Trivial login on dev DBs | Gate demo seed behind explicit flag |
| S-05 | `last_login=None` placeholder field | Informational | `admin_service.py:56` TODO | Admin sees blank column | Implement or remove field |
| S-06 | No data retention/purge policy | Low | No purge code found | Unbounded PII growth | Define retention windows |
| S-07 | No encryption-at-rest beyond platform | Low | No pgcrypto/app-level encryption | DB-file theft exposes hashes/tokens | Cloud KMS/volume encryption at rollout |
| S-08 | Mobile token storage | Low | AsyncStorage (verified in `offlineStore.js`) — not keychain | Token extraction on rooted devices | Migrate secrets to SecureStore |
| S-09 | CSRF | Informational | N/A — Bearer tokens, no cookies/sessions | None | None |
| S-10 | Injection | Low | ORM everywhere; sole raw SQL is `text("SELECT 1")` healthcheck | Minimal | Keep ORM-only rule in review checklist |

**Confirmed controls (with evidence):** bcrypt hashing (`user_service.py`);
HS256 JWT 60m/30d with hashed single-use refresh rotation; prod fail-fast on
placeholder SECRET_KEY at boot (container-verified crash-loop) and empty
CORS (tested); explicit CORS allowlist, never wildcard; security headers incl.
prod-only HSTS; 400/404/409/410 verification codes with no answer leakage
(tested); per-resource ownership fencing (tested matrix); audit log on
auth/role events; structured error envelope without stack leaks; non-root
container user; compose secret guards; no secrets/tokens in logs (grep of
log statements); `.env`/DB files gitignored and untracked-only.

---

# 13. Testing Audit

| Suite | Framework | Files | Cases (executed) | Result (audit date) |
|---|---|---|---|---|
| Backend | pytest + pytest-cov | 12 test files + conftest | **187 passed** (source defs 177; +10 from 2 parametrized tests) | PASS in 63.52s |
| — auth/security/alarms/challenges/hardening | pytest | `test_auth(8)`, `test_security(49)`, `test_alarms(6)`, `test_challenges(10)`, `test_challenge_hardening(23)` | 96 | PASS |
| — analytics/AI/phase suites | pytest | `test_analytics(6)`, `test_ai_engine(17)`, `test_phase5_analytics(11)`, `test_productivity(9)`, `test_e2e_workflows(9)`, `test_feedback(8)`, `test_notifications(21)` | 91 | PASS |
| Web | Vitest + Testing Library | 14 files | **56 passed** | PASS |
| Mobile | jest-expo | 13 suites | **75 passed** | PASS |
| Smoke | scripts (TestClient) | `smoke_m1.py`, `smoke_m2.py` | 22/22, 25/25 | ALL PASS |
| Lint | ruff | `app tests scripts` | 0 issues | PASS |
| Web build | Vite | `npm run build` | clean (1.51s) | PASS |
| Model eval | script | `evaluate_difficulty_model.py` | held-out 0.935, monotonic, sane | PASS |
| Phase-6 verify | script | `verify_phase6.py` | 13/13 | PASS |

**Commands executed (exact):** `python -m pytest -q -p no:cacheprovider`
(backend), `python -m pytest -q -o addopts=""` (187-count confirmation),
`ruff check app tests scripts`, `npm run test -- --run` + `npm run build`
(web), `npx jest` (mobile), `python scripts/smoke_m1.py`,
`python scripts/smoke_m2.py`, `python scripts/evaluate_difficulty_model.py`.
**Failures/skips/errors today:** 0 / 0 / 0. **Warnings:** pre-existing
jsdom "navigation" noise in web tests; DeprecationWarnings eliminated in
touched files. **Environment limitation:** suites run on Windows PowerShell
against SQLite-memory; CI runs ubuntu/Python 3.11 (remote runs not observed).

**Count reconciliation:** docs stating "187" report runtime collection;
source-level `def test_` count is 177 — both true (parametrization). Any doc
still saying 107/151/168/177-total reflects an older phase, not an error in
the suite.

---

# 14. Docker, CI/CD, and Deployment Audit

| Item | State | Evidence |
|---|---|---|
| `backend/Dockerfile` | Build verified (10.5s) | Image `cerebrokognit-api:latest` present; non-root `appuser` observed via exec |
| `web/Dockerfile` + `nginx.conf` | Build verified; serves `/` 200 + SPA fallback 200 | Image `cerebrokognit-web:latest` present; live curl |
| `docker-compose.yml` / `.prod.yml` | Config present; `:?` guards proven (compose aborts without secrets) | Aborted-build output observed |
| Start commands | `up -d --build` executed on fresh volumes | Containers reached healthy |
| Health checks | db (`pg_isready`), api (`/health`), web (spider `/`) | All reported healthy |
| Volumes/networks | `pg_data` named volume; default network; restart verified | Data survived `restart db api` |
| Migrations in deploy | `alembic upgrade head` at entrypoint; head `f2b1d8e4a903`, 15 tables | DB query observed |
| Env configuration | All secrets via env; `.env.example` documents all 20+ vars | Files + exec env observed (values redacted) |
| CI workflow | Present, three jobs, pinned actions | `ci.yml` read; **remote execution not observed** |
| Security scanning | Absent | Not in workflow |
| Image tagging/registry | `latest` only, local daemon; no registry pushes | `docker images` observed |
| Cloud deployment | **Not performed** (constraint) — no files, no URL | Repo-wide: none |
| Reverse proxy / HTTPS | Documented pattern only (edge TLS + HSTS-prod in code) | No live TLS endpoint |
| Monitoring | Measured health + uptime metric live; no external monitor | `/health` observed; no monitor configured |
| Logging | Container logs observed (startup, fallback notice, requests) | `docker compose logs` output |
| Backup/recovery | `pg_dump`→destroy→`pg_restore` round-trip executed (0→1 alarm) | Command outputs observed |

Distinction: configuration present for everything above; **build verified,
container-run verified, deployment verified (local)**; production
monitoring and cloud deployment are **not verified** (planned).

---

# 15. Requirements-to-Implementation Traceability

| Original Requirement | Source Document | Code Location | Evidence | Status | Gap |
|---|---|---|---|---|---|
| bcrypt registration / JWT login / RBAC | SRS FR-AUTH-001..004 | `api/auth.py`, `services/user_service.py`, `api/deps.py` | 8 auth + 49 security tests pass | Implemented | — |
| Profile w/ timezone/difficulty | SRS FR-UP-001 | `api/users.py`, Profile pages | API + UI tests | Implemented | Wake-time attr is alarm-centric (noted in Q&A) |
| Alarm types/recurrence/triggers | SRS FR-AS-* | `services/alarm_service.py`, `api/alarms.py` | E2E W04–W06 | Implemented | — |
| 7 challenge types × 5 levels | SRS FR-CE-001/002 | `services/challenge_service.py` generators | 35-combo matrix | Implemented | — |
| Server-verified dismissal gate | SRS dismissal flow | `verification_service.py`, `dismiss_alarm` | W07–W11, replay 409 | Implemented | — |
| 35/25/20/20 habit scores | SRS FR-UP-002 | `habit_scoring_service.py` | Formula + equality tests | Implemented | — |
| Adaptive difficulty | SRS FR-CE-003 | `ai_engine/difficulty.py` + band clamp | 17 AI tests, eval 0.935 | Implemented | Real-data retraining |
| Explained recommendations | SRS FR-RE-001..004 | `recommendation_service.py` (10 rules) | Reason/metric tests | Implemented | Learned ranker |
| User dashboard | SRS FR-DD-001 | Home/Dashboard/InsightsTab | Vitest/jest/API tests | Implemented | — |
| Coach dashboard (scoped) | SRS FR-DD-002 | `coach_service.py`, coach endpoints, Admin coach mode | ACL + UI tests | Implemented | Mobile coach UI |
| Admin dashboard | SRS FR-DD-003 | `admin_service.py`, Admin.jsx | Uptime + telemetry tests | Implemented | `last_login` TODO |
| Push + local alarms | SRS §2.9 | `messaging.py`, `expoNotifier/scheduleAlarm`, permissions | 21 + jest tests; no device run | Partially implemented | Device proof |
| Reports + PDF/Excel | SRS FR-REP-* | `report_service/export.py`, 4 types, async jobs | Byte-signature + equality tests | Implemented | — |
| Productivity correlation | SRS FR-BA-003/REP-004 | `productivity_service.py`, log UI | 9 tests + UI tests | Implemented | — |
| Offline sync | SRS FR-OFF-* | `/sync/*`, offlineStore/engine | Sync tests | Implemented | Device E2E |
| Security controls | SRS NF-SEC-*/§9 | config, gateway, token/audit services | 49 tests + container secret refusal | Implemented | SMTP, lockout, scans |
| Test/CI gates | SRS §10 | 12+14+13 test files, `ci.yml`, smokes | 339 green today | Implemented | Remote CI observation |
| Docker/prod deploy | SRS §10 | Dockerfiles, compose pair, entrypoint | Local validation report | Implemented (local) | Cloud rollout |
| Monitoring/logging | OPERATIONS_GUIDE | `/health`, system_status, Sentry hook | Live observed | Partially implemented | External monitor, DSN |

---

# 16. Known Issues and Risk Register

| ID | Issue | Area | Severity | Evidence | Impact | Recommended Action | Priority |
|---|---|---|---|---|---|---|---|
| R-01 | 92 uncommitted paths across 6 phases | Repo | High | `git status` (audit date) | Loss/regression risk | Phase-separated commits immediately | P0 |
| R-02 | Real-device alarm/notification never observed | Mobile/notify | High | No device logs; checklist pending | Core promise unverified | Run `REAL_DEVICE_CHECKLIST.md` on hardware | P0 |
| R-03 | Difficulty weights absent from fresh clones (gitignored) | AI/ops | Medium | `.gitignore` + COPY guard (`.gitkeep`) | CI runs rule-path only | Documented; optionally publish weights artifact | P1 |
| R-04 | No dependency scanning | Security/CI | Medium | `ci.yml` content | Silent CVEs | Add pip-audit/npm audit | P1 |
| R-05 | Email delivery stubbed (NoopSender) | Security/UX | Medium | `integrations/email_sender.py:33-39` | Reset/verify unusable in prod | Configure SMTP pre-rollout | P1 |
| R-06 | No cloud deployment exists | Deployment | Medium | No cloud files/URL | Zero prod users possible | Platform selection + rollout | P1 |
| R-07 | `schemas/all.py` dead code (0% cov) | Backend | Low | Zero imports | Drift risk | Delete file | P2 |
| R-08 | `services/cache.py` unwired | Backend | Low | Zero callers | Dead surface | Wire or remove | P2 |
| R-09 | `FCM_SERVER_KEY` documented, unused | Config | Low | Zero code refs | Operator confusion | Remove or implement direct FCM | P2 |
| R-10 | `last_login` always null | Admin | Low | TODO + service default | Blank admin column | Implement or drop field | P2 |
| R-11 | No retention/purge policy | Data | Low | No purge code | Unbounded PII | Define windows | P2 |
| R-12 | AsyncStorage holds tokens (not keychain) | Mobile sec | Low | `offlineStore.js` | Rooted-device extraction | SecureStore migration | P2 |
| R-13 | No brute-force lockout (rate limits only) | Security | Low | `rate_limit.py` | Slow credential stuffing | Lockout/CAPTCHA at rollout | P2 |
| R-14 | Tailwind installed but unused | Web | Informational | `package.json` vs custom CSS | Bloat | Remove dep | P3 |
| R-15 | Unused ML/data deps in requirements | Deps | Informational | Zero imports (torchvision/sklearn/xgboost/pandas) | Install weight, confusion | Trim to used set | P3 |
| R-16 | MongoDB referenced in arch docs only | Docs/arch | Informational | Zero code refs | Misleading diagram | Clarify as future/planned | P3 |
| R-17 | Demo credentials seeded on SQLite dev | Security | Low | `bootstrap.py:27-28` | Trivial dev login | Flag-gate seeding | P2 |
| R-18 | DST edge cases in scheduling untested | Alarms | Low | No DST tests found | One-hour-off triggers 2×/yr | Add DST unit tests | P2 |

---

# 17. Recommended Implementation Order

| # | Task | Reason | Dependencies | Files/modules | Acceptance | Verification | Risk if postponed |
|---|---|---|---|---|---|---|---|
| 1 | Commit backlog phase-separated (3→9) | R-01; rule 17 | None | git history | One commit per phase, tree still green | `git log`, rerun suites | Loss of work traceability |
| 2 | Re-run full suites as Phase-1-style gate | Baseline lock | 1 | all test dirs | 339 green | pytest/vitest/jest/smokes | Drift unnoticed |
| 3 | SMTP provider + lockout + dep scans | S-02/S-01/R-13 | 1 | `email_sender.py`, CI, rate limiter | Reset email received; scans in CI | Manual + CI logs | Prod auth gaps |
| 4 | Real-device alarm/notification pass | R-02 | 3 | mobile app, checklist | Firing + tap routing observed | Device logs/screenshots | Core claim unverified |
| 5 | Delete dead code (`all.py`, wire/drop cache, FCM key) | R-07..09 | 1 | listed files | Ruff + suite green, docs updated | pytest | Confusion/dead surface |
| 6 | Challenge hardening already done — regression only | Sustain | 2 | `challenge_service.py` | Hardening suite green | `test_challenge_hardening.py` | Recall regressions |
| 7 | DST scheduling tests + retention policy | R-18/R-11 | 2 | `alarm_service.py`, ops docs | New tests green, policy doc'd | pytest | Seasonal bugs, PII growth |
| 8 | Mobile coach read-only view (optional) | Gap | Coach API (done) | mobile screens | Scoped roster renders | jest | Coaches phone-blind |
| 9 | Real-data difficulty retraining pipeline | AI future | Usage data | `train_*`, `AI_FEATURES.md` | Eval gate passes on real split | `evaluate_*` | Model stays synthetic |
| 10 | Web/mobile completion polish | UX | 2 | pages/screens | Vitest/jest green | suites | Minor UX debt |
| 11 | E2E report refresh each release | Quality | 2 | `E2E_TEST_REPORT.md` | All W PASS | e2e suite | Silent regressions |
| 12 | Cloud rollout per guides | R-06 | 3,4 | deploy docs, secrets | URL live, TLS, backups | `FINAL_VALIDATION` update | No users |
| 13 | External monitoring + Sentry DSN + SecureStore | R-12/ops | 12 | monitor, app config | Alerts fire; DSN events | Monitor dashboard | Blind ops |

---

# 18. Evidence Appendix

- Branch: `main`; commit: `082c9a9`; remote in sync; 92 changed paths, uncommitted, no stashes.
- Tree: `backend/` (app 9 groups, 12 API routers, 22 services, 8-engine `ai_engine`, 12 test files), `web/` (10 pages, 14 test files), `mobile/` (14 screens, 9 hooks, 13 test suites), `migrations/` (8 revisions, linear), `.github/workflows/ci.yml`, Dockerfiles + compose pair, 30 `.md` docs, 5 `Q and A` audits.
- Tests executed today with results: `pytest -q` → **187 passed** (63.52s); `ruff check` → clean; `npm run test -- --run` → **56 passed**; `npm run build` → clean (1.51s); `npx jest` → **75 passed / 13 suites**; `smoke_m1.py` → ALL PASS; `smoke_m2.py` → ALL PASS; `evaluate_difficulty_model.py` → PASS (0.935/monotonic/sane).
- Builds/startups: `cerebrokognit-api:latest`, `cerebrokognit-web:latest`, `postgres:15-alpine` images present; prod-overlay stack reached healthy; alembic head `f2b1d8e4a903`; container E2E (register→dismiss→habit 73); restart/backup/restore verified (see `FINAL_VALIDATION_REPORT.md`).
- Config sensitivity: `backend/.env` exists locally — Sensitive configuration detected. Values intentionally omitted. Compose `:?` guards and boot-time secret refusal verified by negative test.
- Unresolved errors: none in executed suites. Pre-existing noise: jsdom "navigation" messages in web tests; CISCO-free.
- Environment limitations: Windows PowerShell + Python 3.14 venv (CI uses ubuntu/3.11); no PDF parser lib; no mobile device; no cloud credentials; no SMTP; no Sentry DSN; no Expo credentials; dev database contains local-only rows.

---

# 19. Final Audit Classification

| Area | Classification | Evidence |
|---|---|---|
| Auth, RBAC, profile/settings | Confirmed working | 57 tests + smokes + container E2E |
| Alarms (CRUD, recurring, snooze) | Confirmed working | API/jest/Vitest + E2E W04–W06 |
| Challenge engine + verification + dismissal | Confirmed working | 33 challenge tests + W07–W11 + no-leak matrix |
| Habit scoring + analytics + recommendations | Confirmed working | Formula/consistency tests + W12–W14 |
| Coach + admin dashboards | Confirmed working | ACL tests + UI tests + scoped endpoints |
| Productivity tracking + correlation | Confirmed working | 9 tests + UI tests + honest-empty exports |
| Reports (4 types × 4 formats) | Confirmed working | Byte-signature + equality tests + W15 |
| Offline sync | Confirmed working | Protocol tests (device E2E pending) |
| Security controls | Confirmed working | 49 tests + container secret refusal (static+runtime; no pentest/scan) |
| Difficulty AI (net + rules) | Confirmed working | Eval 0.935 + 17 tests (synthetic-trained, advisory) |
| Anomaly/forecast | Partially working | Gated statistical baselines, tested (not trained models) |
| Push pipeline (server) | Confirmed working | 21 tests incl. prune/dedupe/ownership |
| Push delivery + on-device firing | Not verified | Code complete, zero device observations |
| Docker/prod-local deploy | Confirmed working | Builds, migration, E2E, restart, backup/restore observed |
| CI configuration | Partially working | Workflow present; remote runs not observed |
| Cloud deployment | Planned | Explicitly deferred; no artifacts |
| Face/voice/image/QR verification | Not applicable | No requirement, no code |
| Computer vision | Not applicable | No code, unused dep only |
| MongoDB / Redis / direct-FCM / sklearn stack | Planned (or scaffold) | Declared only; zero functional use |

---

# 20. Audit Limitations

1. `Project Details.pdf` (1.8 MB) could not be machine-parsed — no PDF library in the environment; its requirements were taken from SRS/PRD/README which cite it.
2. No mobile device — on-device alarm firing, background delivery, tap routing, and Expo push receipt unverified.
3. No cloud credentials — deployment validated locally only; TLS, managed DB, and registry pushes unverified.
4. No SMTP service — password-reset/email-verification delivery paths untested beyond token logic.
5. No Sentry DSN / Expo credentials — both integrations verified as no-op/fallback only.
6. No notification credentials — Expo relay code paths tested with mocked transport only.
7. Model weights file (`difficulty_model.pt`) present locally and evaluated; fresh-clone absence covered by design (rule fallback) but CI's torch path unobserved.
8. Dependency vulnerability scan not run (no scanner installed); CI remote runs not observed.
9. Dev-only `.env`/SQLite database contents never inspected for secrets (by rule); production secrets exist only as local env.
10. No browser-automation E2E (no Playwright/Cypress in repo); web covered by component/integration tests.
