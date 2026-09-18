# Repository and Architecture — Q&A

> Implementation audit of the **CerebroKognit: Intelligent Cognitive Alarm Platform**.
> Evidence base: static source analysis of the repo at HEAD (no runtime/DB verifications run during this audit — anything runtime-only is marked *Unverified*).

**Overall status: ~75% implemented.** Backend is the strongest layer (auth, RBAC, challenge engine, dismiss flow, habit scoring, analytics, reports, sync, feedback, push-token registry — all wired + 34 pytest tests). Web dashboard is live-wired to real APIs. Mobile has real alarm→challenge→dismiss + offline cache + push-token registration. **Critical gaps:** push *delivery* (FCM/APNs) is a `NoopProvider` that raises `NotImplementedError`; on-device local alarm scheduling is absent; Wellness Coach dashboard is missing; anomaly/performance AI engines are planned stubs.

---

## Q1. Complete project folder analysis

### 1.1 Full directory tree (excluding `node_modules`, `.venv`, build artifacts, caches)

```
CerebroKognit/
├── .github/workflows/ci.yml            # CI: ruff + pytest + smoke_m1 + smoke_m2 (backend), vitest + build (web), jest (mobile)
├── .dockerignore, .gitattributes, .gitignore
├── alembic.ini                         # Alembic migration config (backend/database.py reads alembic by env)
├── assets/                             # Favicons + brand logos (web shared assets)
│   ├── favicons/*.ico                  # 8 favicon sizes
│   ├── floating/(1)..(14).webp         # Floating decorative screenshots
│   └── logos/                          # CerebroKognit-Light/Dark, JustLogo, WideLight/WideDark (png+webp)
├── backend/                            # ── BACKEND (FastAPI) ──
│   ├── .env, .env.example              # DB URL, JWT secret, CORS origins (gitignored except example)
│   ├── app/                            # Application package
│   │   ├── main.py                     # FastAPI v1.0.0: lifespan(bootstrap), CORS, gateway, routers, error handlers
│   │   ├── Models.py                   # All SQLAlchemy models: Role, User, UserRole, Alarm, Challenge,
│   │   │                               #   ChallengeAttempt, HabitScore, PushToken, Feedback
│   │   ├── database.py                 # SQLite default + DATABASE_URL override; Base, engine, session
│   │   ├── api/                        # Route handlers (thin) — auth, users, alarms, challenges, habits,
│   │   │                               #   analytics, dashboard, sync, notifications, feedback, deps (RBAC)
│   │   ├── services/                   # Business logic (11 domain modules + facades)
│   │   │   ├── user_service.py         # AuthService: bcrypt, JWT, role assignment
│   │   │   ├── alarm_service.py        # CRUD, tz-aware _compute_next_trigger, snooze cap, dismiss gate
│   │   │   ├── challenge_service.py    # 7 types × 5 levels, server-side attempt, authoritative verify
│   │   │   ├── habit_scoring_service.py# 35/25/20/20 weighted composite from real data
│   │   │   ├── behavior_analytics_service.py  # sleep estimate from alarm gaps, trends, activity
│   │   │   ├── analytics_service.py    # Facade re-exporting the above
│   │   │   ├── recommendation_service.py     # FR-RE-001..004 rule-based (4 categories)
│   │   │   ├── verification_service.py # Dismiss gate: check finished + all-correct attempt
│   │   │   ├── notification_service.py # PushToken CRUD (register/deregister/list)
│   │   │   ├── report_service.py       # Record builders for habit/wake-up/challenge reports
│   │   │   ├── report_export.py        # CSV / JSON / PDF (reportlab) / Excel (openpyxl) streaming
│   │   │   ├── admin_service.py        # Platform-wide user + analytics queries (admin)
│   │   │   ├── feedback_service.py     # Feedback CRUD (+ staff flag)
│   │   │   ├── bootstrap.py            # SQLite-only auto-create + seed (roles, 7×5 challenges, demo user)
│   │   │   ├── auth.py                 # Facade shim → user_service (back-compat)
│   │   │   ├── ml_inference.py         # Torch-tolerant facade → ai_engine/difficulty
│   │   │   ├── adaptive_difficulty_service.py  # Difficulty selection (ML + rule-based)
│   │   │   └── cache.py                # Optional Redis cache (no-op unless REDIS_URL set)
│   │   ├── ai_engine/                  # ── AI/ML ENGINE ──
│   │   │   ├── interfaces.py           # Protocol definitions + ENGINE_REGISTRY (implemented/scaffold/planned legend)
│   │   │   ├── difficulty.py           # DifficultyPredictor (PyTorch 4→16→5 net) + rule-based fallback
│   │   │   ├── challenge_generation.py # Adapter → challenge_service (no answer leak)
│   │   │   ├── behavior_analysis.py    # Adapter → behavior_analytics_service
│   │   │   ├── recommendations.py      # Adapter → recommendation_service
│   │   │   ├── anomaly.py              # ⚠️ PLANNED STUB — raises NotImplementedError
│   │   │   └── performance_prediction.py# ⚠️ PLANNED STUB — raises NotImplementedError
│   │   ├── gateway/                    # ── API GATEWAY/MIDDLEWARE ──
│   │   │   ├── middleware.py           # X-Request-ID, rate limit (429 ERR_RATE_LIMIT), structured logging
│   │   │   ├── rate_limit.py           # Thread-safe sliding-window limiter (global 300/min, auth 60/min)
│   │   │   └── logging.py              # Logging config helpers
│   │   ├── integrations/               # ── EXTERNAL SERVICES ──
│   │   │   └── messaging.py            # ⚠️ NoopProvider — FCM/APNs send() raises NotImplementedError
│   │   ├── workers/                    # Background jobs
│   │   │   └── job_queue.py            # In-process job registry for async reports (Celery/RQ planned)
│   │   └── schemas/                    # Pydantic v2 schemas
│   │       ├── auth.py                 # ACTIVE auth schemas (EmailStr, difficulty_preference on register)
│   │       ├── __init__.py             # Most endpoint schemas (AlarmCreateReq, ChallengeSubmitReq, ...)
│   │       └── all.py                  # ⚠️ DEAD CODE — zero imports anywhere
│   ├── tests/                          # 34 pytest tests
│   │   ├── conftest.py                 # In-memory SQLite, TestClient, fixtures (user/admin headers, solved attempt)
│   │   ├── test_auth.py / test_alarms.py / test_challenges.py /
│   │   ├── test_analytics.py / test_notifications.py / test_feedback.py
│   ├── scripts/                        # Dev/ops tooling
│   │   ├── init_db.py                  # Fresh DB reset + seed
│   │   ├── smoke_m1.py                 # 22-check phase-1 regression smoke
│   │   ├── smoke_m2.py                 # 25-check phase-2 E2E (migration + full dismiss flow)
│   │   └── train_difficulty_model.py   # Trains backend/ml_models/difficulty_model.pt (synthetic data)
│   ├── ml_models/difficulty_model.pt   # Trained PyTorch difficulty model (exists on disk; loaded when torch present)
│   ├── cerebrokognit.db                # Local SQLite dev DB (gitignored)
│   ├── Dockerfile                      # python:3.11-slim; installs requirements-runtime.txt (no torch)
│   ├── docker-entrypoint.sh            # Runs `alembic upgrade head` then uvicorn
│   ├── requirements.txt                # Full dev/test deps (incl. torch + unused ML libs)
│   ├── requirements-runtime.txt        # Lean runtime deps (no ML stack → rule-based fallback in Docker)
│   ├── pyproject.toml                  # Ruff config (select E/F/W), pytest config
│   └── pytest.ini                      # testpaths/markers
├── web/                               # ── FRONTEND (React 18 + Vite, custom CSS) ──
│   ├── package.json                    # vite, react, chart.js, react-chartjs-2, react-router-dom, vitest
│   ├── vite.config.js                  # Vite + Vitest config; jsdom via src/test/setup.js
│   ├── index.html
│   ├── public/                         # Static: favicon/, floating/ screenshots, login-bg.svg, logos/
│   └── src/
│       ├── main.jsx, App.jsx           # Shell: sidebar nav (Track/Plan/Insights/Account/Administration), routing
│       ├── index.css                   # ~88 KB custom design system (Tailwind NOT used)
│       ├── theme.js                    # data-theme + localStorage['ck-theme'] + cross-tab sync
│       ├── navSections.js              # IA v2 nav group definitions
│       ├── styles.jsx, test/setup.js
│       ├── utils/                      # api.js (fetch+JWT+401 redirect), chartUtils, timeFormat, timezones
│       ├── components/
│       │   ├── layout/Sidebar.jsx      # 248px sidebar, collapsible, logo crossfade
│       │   ├── ui/                     # Design system: Badge, Icons, Toggle, Skeleton, EmptyState,
│       │   │                           #   ErrorState, LiveClock, TimeInput, TimezonePicker, ProgressBar, ...
│       │   ├── auth/                   # AuthLayout, AuthVisual, theme toggle, form fields, icons
│       │   └── landing/                # Landing page sections (Hero, Features, HowItWorks, FAQ, ...)
│       └── pages/
│           ├── Landing.jsx / Auth.jsx  # Logged-out entry + login/register
│           ├── Home.jsx                # Command center: score ring, next alarm, stat strip, timeline
│           ├── Dashboard.jsx           # Analytics summary + charts + recommendations
│           ├── AlarmManagement.jsx     # Alarm CRUD + snooze
│           ├── ChallengeGenerator.jsx  # Challenge list + start (→ /challenges/next)
│           ├── Reports.jsx             # CSV/JSON/PDF/Excel exports
│           ├── Admin.jsx               # RBAC-gated admin (users, platform analytics)
│           ├── Settings.jsx / Profile.jsx
│           └── *.test.jsx              # Vitest component tests
├── mobile/                            # ── MOBILE (React Native + Expo SDK 57) ──
│   ├── App.js                          # Root navigator; AuthProvider wraps all navigation
│   ├── app.json, tsconfig.json, index.js, jest.setup.js
│   ├── .env                            # API URL override (blanked; uses Expo hostUri probe)
│   ├── package.json                    # expo ~57.0.22, RN 0.86.3, jest-expo, async-storage, notifications,
│   │                                  #   @react-navigation, netinfo (overrides pin @react-native/jest-preset 0.86.0)
│   └── src/
│       ├── theme/                      # ThemeContext, tokens.js (brand palette), fonts.js
│       ├── context/AuthContext.jsx     # Shared auth state for entire tree
│       ├── hooks/                      # useAuth, useChallenge, useHabitScore (+ tests)
│       ├── utils/api.js                # Host probing, JWT headers, 401 event bus
│       ├── notifications/registerPush.js# Expo-token acquisition + POST /notifications/register (Expo-Go guard)
│       ├── sync/                       # offlineStore (AsyncStorage), syncEngine (push/pull idempotent),
│       │                               #   syncRequest, useSync (+ tests)
│       ├── schemas/offline-cache-schemas.ts
│       ├── components/
│       │   ├── MainTabs.jsx            # Custom bottom nav (HOME/ALARMS/INSIGHTS/PROFILE)
│       │   ├── layout/HeaderActions.jsx
│       │   └── ui/                     # BrandMark, ChipRow, ConnectRow, ScoreRing, SectionHeader, StatusPill, SysLabel
│       └── screens/
│           ├── LoginScreen / AlarmFormScreen / AlarmScreen / ChallengeScreen /
│           ├── FeedbackScreen / ProfileScreen / SettingsScreen / AboutScreen
│           └── tabs/HomeTab | AlarmsTab | InsightsTab | ProfileTab
├── migrations/                         # Alembic (for Postgres)
│   ├── env.py, script.py.mako, README
│   └── versions/
│       ├── 732e5cb49bcf_initial_schema.py            # roles, users, alarms, challenges, attempts, habit_scores
│       ├── 1c584bd4a5b0_add_challenge_attempt_answer_data.py  # puzzle/expected/user answers
│       ├── 992b0ec03dba_add_push_tokens.py           # push_tokens + ix_users_email_lower
│       └── b3f2a1c9d807_add_feedback.py              # feedback table
├── docker-compose.yml                 # db (postgres:15-alpine, healthcheck) + api (build backend/Dockerfile) — web commented
├── dev.ps1                            # One-shot launcher: pinned venv python -m uvicorn :8000 + vite :5173 (+metro :8081)
├── run_all.bat / run_all.ps1          # Full stack launcher: db→backend→web→mobile (one console, QR visible)
├── PRD.md / SRS.md / README.md / style.md / context.md / Project Details.pdf
```

### 1.2 Purpose of important files

| File | Purpose |
|---|---|
| `backend/app/main.py` | App factory, CORS, gateway middleware, route registration, global error envelope (`{detail, error_code, timestamp, status_code}`) |
| `backend/app/Models.py` | Single source of truth for the 9 ORM tables (incl. JSON columns for puzzle payloads/answers) |
| `backend/app/api/deps.py` | `get_current_user` (OAuth2 bearer) + `require_roles("Administrator","Wellness Coach")` RBAC |
| `backend/app/services/challenge_service.py` | Server-authoritative challenge core — the most critical module (no answer leak, adaptive selection, authoritative verify) |
| `backend/app/gateway/middleware.py` | Request-ID, sliding-window rate limiting, structured logging |
| `web/src/index.css` | Entire design system (~88 KB, dark+light themes, retro-futuristic brand) |
| `mobile/src/context/AuthContext.jsx` | Shared login state (fixes the earlier 7-separate-`useAuth` bug) |
| `migrations/versions/*.py` | 4 Alembic revisions → migration chain HEAD is `b3f2a1c9d807` |
| `.github/workflows/ci.yml` | 3 jobs: backend (lint+test+2 smokes), web (vitest+build), mobile (jest) |

### 1.3 Unused / duplicate components

| Component | Type | Evidence |
|---|---|---|
| `backend/app/schemas/all.py` | **Dead code** | Zero `import` of `schemas.all` or `from schemas import *` anywhere in `backend/` |
| `backend/app/schemas/__init__.py` vs `schemas/auth.py` | **Schema duplication** | Two overlapping schema sets; `api/auth.py` uses `schemas.auth` (EmailStr + `difficulty_preference`), most other routers use `schemas/__init__.py` (plain `str` email) — drift risk |
| `scikit-learn` (`sklearn`) | **Unused dependency** | Declared in `requirements.txt:15`; no `import sklearn` anywhere (per spec audit + grep) |
| `xgboost` | **Unused dependency** | `requirements.txt:16`; no import usage |
| `pandas` | **Unused dependency** | `requirements.txt:17`; no app import (comment in runtime file confirms: "nothing in app/ imports pandas") |
| `numpy` | **Unused dependency (app code)** | Only used indirectly through torch; excluded from Docker runtime fine |
| `aioredis` | **Unused (optional)** | `redis.asyncio` only active when `REDIS_URL` set; default is in-memory |
| `torchvision` | **Unused dependency** | `requirements.txt:14`; only `torch` is imported in `ai_engine/difficulty.py` |
| `axios` (web) | **Unused dependency** | `web/package.json:14`; `web/src/utils/api.js` uses native `fetch` — zero axios imports |
| `react-query` (web) | **Unused dependency** | Declared `web/package.json:20`; zero `useQuery`/`QueryClient`/import usage |
| `date-fns` (web) | **Unused dependency** | Declared `web/package.json:16`; project uses its own `utils/timeFormat.js` |
| `tailwindcss` (web) | **Installed but unused** | `web/package.json:32` + deps; all CSS is custom in `index.css` (context.md confirms) |
| `expo-sqlite` (mobile) | **Unused (documented decision)** | Declared `mobile/package.json:24`; offline store uses AsyncStorage ("rather than expo-sqlite") |
| `@vitejs/plugin-react` | Misplaced in `dependencies` | Should be `devDependencies` |
| `assets/` (root) vs `web/public/` vs `mobile/assets/` | **Duplicated brand assets** | Logos exist in 3 copies (root `assets/logos/`, `web/public/logos/`, `mobile/assets/logos/`) — same files, 3 sources of truth |

---

## Q2. Actual architecture vs specification

### 2.1 The spec's architecture topology (context.md / ARCHITECTURE.md)

```
Mobile (Expo Go) ──HTTPS/JSON──▶ Backend (FastAPI) ──psycopg2──▶ PostgreSQL
                                   │
                                   ├── Redis (optional) ──▶ MongoDB (user sessions/telemetry)
                                   └── ML Model Cache (PyTorch/Joblib)
Web Dashboard (React) ──◀──────────┘
```

Additionally mentioned: **API gateway**, **backend services**, **AI engine**, **data layer**, **external services** (FCM/APNs push), **monitoring**.

### 2.2 Component-by-component comparison

| Spec component | Actual implementation | Status |
|---|---|---|
| **API gateway** | `backend/app/gateway/middleware.py` — request-ID/trace-ID, **in-memory sliding-window rate limiter** (`gateway/rate_limit.py`, 429 + `ERR_RATE_LIMIT` + `Retry-After`), structured logging on exception | ✅ **Implemented** (no external gateway like Kong/Traefik — it's an ASGI middleware layer) |
| **Frontend (web)** | `web/` — React 18 + Vite + Chart.js, custom CSS system, JWT via `utils/api.js`, RBAC-gated Admin page | ✅ **Implemented** — pages call live `/api/v1/*` endpoints |
| **Frontend (mobile)** | `mobile/` — Expo SDK 57 / RN 0.86, custom bottom nav, real alarm→challenge→dismiss flow, offline cache, push-token registration | ✅ **Implemented** (on-device E2E partially verified by user in prior sessions; not re-run here — *Unverified*) |
| **Backend services** | `backend/app/services/` — 11 domain modules: `user_service`, `alarm_service`, `verification_service`, `habit_scoring_service`, `behavior_analytics_service`, `analytics_service` (facade), `report_service`, `admin_service`, `notification_service`, `adaptive_difficulty_service`, `cache` | ✅ **Implemented** |
| **AI engine** | `backend/app/ai_engine/` — `difficulty.py` (PyTorch plus rule-based fallback), `challenge_generation.py`, `behavior_analysis.py`, `recommendations.py` concrete adapters; `interfaces.py` registry | ✅ **Adapted** (difficulty/challenge/behavior/recommendations) |
| **AI engine — anomaly detection** | `ai_engine/anomaly.py` — `AnomalyDetector` **raises `NotImplementedError("planned")`** | ⚠️ **Planned stub** |
| **AI engine — performance forecasting** | `ai_engine/performance_prediction.py` — `PerformanceForecaster` **raises `NotImplementedError("planned")`** | ⚠️ **Planned stub** |
| **Data layer — PostgreSQL** | `docker-compose.yml` `db` (postgres:15-alpine) + 4 Alembic migrations + `backend/Dockerfile` entrypoint runs `alembic upgrade head` | ✅ **Implemented** (Docker path; also works on local SQLite via `bootstrap.py`) |
| **Data layer — MongoDB** | **Not present anywhere** — no pymongo, no collections, no session/telemetry storage | ❌ **Missing** (spec 7.x architectural reference only; context.md: "referenced in architecture only") |
| **Data layer — Redis** | `services/cache.py` — Redis adapter active **only when `REDIS_URL` is set**; default is no-op in-memory; `aioredis` pinned but not installed in runtime image | ⚠️ **Inactive/optional** (implemented, disabled by default) |
| **External services — push delivery (FCM/APNs)** | `integrations/messaging.py` — `NoopProvider.send()` **raises `NotImplementedError`**; only token storage (`push_tokens` table + `/notifications/register`) works | ❌ **Missing** (registry implemented, delivery provider planned) |
| **Monitoring / observability** | `gateway/logging.py` + middleware structured logs; `analytics/ml-status` diagnostic; jobs/panic logging in `workers/job_queue.py` | ✅ **Implemented** (basic) — no Sentry/APM/Graphite dashboard (Level 16 backlog) |
| **Background workers** | `workers/job_queue.py` — in-process registry for async reports (`?async=1` + `/dashboard/reports/status/{id}`) | ✅ **Implemented** (Celery/RQ planned, not needed) |
| **Notification scheduling (on-device local alarms)** | Not present (no Android AlarmManager/UNUserNotificationCenter local scheduling) | ❌ **Missing** (Level 12/16 backlog) |
| **Wellness Coach dashboard** | Backend RBAC role exists + `staff_only` guard; **no coach cohort filtering UI** | ❌ **Missing** (FR-DD-002) |

**Summary**: Gateway ✅ · Frontend (web+mobile) ✅ · Backend services ✅ · AI engine core ✅ (anomaly/performance planned) · Data layer: Postgres ✅ / Redis 🔶 / MongoDB ❌ · External push 📣 registry only (no delivery) · Monitoring ✅ basic.

---

## Q3. Actual technology stack

### 3.1 Installed stack (verified from `requirements*.txt`, `package.json`)

| Layer | Technology | Version | Where |
|---|---|---|---|
| **Backend** | Python (FastAPI app targets 3.11; local venv drifted to 3.14) | 3.11(docker)/3.14(venv) | `backend/Dockerfile`, `backend/.venv` |
| | FastAPI | 0.141.1 (pinned) | `requirements.txt:4` |
| | Starlette | 1.6.0 (pinned) | `requirements.txt:5` |
| | Uvicorn | >=0.27 | `requirements.txt:6` |
| | SQLAlchemy 2.0 | >=2.0.0 | `requirements.txt:7` |
| | Pydantic v2 | >=2.5.0 | `requirements.txt:9` |
| | Alembic | >=1.13 | `requirements.txt:24` |
| | psycopg2-binary | >=2.9.9 | `requirements.txt:8` |
| | PyJWT + PyCrypto | >=2.8.0 | `requirements.txt:10` (`pyjwt[crypto]`) |
| | bcrypt | >=4.0 | `requirements.txt:12` |
| | python-dotenv, email-validator, python-multipart | — | `requirements.txt:11,22,21` |
| | reportlab (PDF) / openpyxl (XLSX) | >=4.0 / >=3.1 | `requirements.txt:19,20` |
| | **ML**: torch / torchvision / scikit-learn / xgboost / pandas / numpy | >=2.3/0.18/1.4/2.0/2.2/1.26 | `requirements.txt:13-18` |
| **Web** | React 18.3 + react-dom | 18.3.0 | `web/package.json` |
| | Vite 5.4 + @vitejs/plugin-react | ^5.4.10 / ^5.2.0 | `web/package.json` |
| | chart.js + react-chartjs-2 | ^4.4.7 / ^5.3.1 | `web/package.json` |
| | react-router-dom | ^6.28 | `web/package.json` |
| | Vitest + Testing Library + jsdom | ^2.1.9 | `web/package.json` (tests) |
| | **Tailwind 3.4 — declared but unused** | ^3.4.17 | `web/package.json` |
| **Mobile** | Expo SDK | ~57.0.22 | `mobile/package.json` |
| | React 19.2.3 / React Native 0.86.3 | 19.2.3 / 0.86.3 | `mobile/package.json` |
| | @react-navigation (native + native-stack) | ^7.x | `mobile/package.json` |
| | @react-native-async-storage/async-storage | 2.2.0 | `mobile/package.json` (offline cache) |
| | expo-notifications | ~57.0.18 | `mobile/package.json` (push token) |
| | expo-sqlite (unused), netinfo, safe-area-context, screens | — | `mobile/package.json` |
| | jest-expo + @testing-library/react-native | ~57 / ^13 | `mobile/package.json` (tests) |
| **Database** | PostgreSQL 15 (Docker) — primary | 15-alpine | `docker-compose.yml` |
| | SQLite (local dev default) | — | `backend/app/database.py` |
| | **MongoDB 7 — spec-reference only** | — | ❌ no implementation |
| **DevOps** | Docker Compose v2 (`db` + `api`) | — | `docker-compose.yml` |
| | GitHub Actions (3 jobs) | — | `.github/workflows/ci.yml` |
| | PowerShell launchers | — | `dev.ps1`, `run_all.ps1/.bat` |

### 3.2 Declared-but-unused / unnecessary dependencies

- **Backend**: `scikit-learn`, `xgboost`, `pandas`, `numpy`, `torchvision` — declared in `requirements.txt` but never imported in `app/` code (numpy rides along with torch; the ML fallback path uses pure Python). The Docker image deliberately drops the whole ML set (`requirements-runtime.txt`), confirming they are non-essential to runtime.
- **Web**: `axios` (app uses native `fetch`), `react-query` (no queries use it), `date-fns` (own `timeFormat.js`), `tailwindcss` + `postcss` + `autoprefixer` (all CSS custom; Tailwind never configured in any source file).
- **Mobile**: `expo-sqlite` (offline store documented as AsyncStorage-based).
- **Spec drift**: spec planned MongoDB + FCM/APNs delivery + Redis/Bull workers — none of these are live (all fall back or are planned).

---

## Q4. Real end-to-end workflow: opening the app → completing a wake-up challenge

Trace for the **mobile alarm-dismiss flow** (the product's core cognitive loop), with exact files/functions.

### Stage 1 — App start & session restore
1. `mobile/App.js` mounts → wraps navigator in `<AuthProvider>` (`mobile/src/context/AuthContext.jsx`).
2. `useAuth()` (`mobile/src/hooks/useAuth.jsx:24-56`) reads `cerebro_token`/`cerebro_user` from AsyncStorage and re-validates via `GET /api/v1/auth/me`. On 401 → clears storage; on network error → keeps session (offline-tolerant).
3. `api.js` (`mobile/src/utils/api.js`) determines the backend base URL — probes Expo `hostUri` (LAN IP) → `:8000`, relay `:8090` fallback, `.env` override — so a real phone reaches the FastAPI server.

### Stage 2 — Login (one time)
1. `LoginScreen` → `useAuth().login()` → `mobile/src/utils/api.js` `apiFetch('POST /api/v1/auth/login')`.
2. Router `POST /api/v1/auth/login` (`backend/app/api/auth.py:67`) → `AuthService.authenticate` (`backend/app/services/user_service.py`) — bcrypt verify + `jwt.encode` (HS256, 60-min access + refresh). Returns `access_token` + `user`.
3. `useAuth.login` stores token in AsyncStorage, sets shared state → whole tree logged in.
4. Optional: `registerForPushNotifications()` (`mobile/src/hooks/useAuth.jsx:130-155`) → `registerPush.js` → `POST /api/v1/notifications/register` (`backend/app/api/notifications.py`) → `notification_service.register_token` persists to `push_tokens`. (Expo-Go guard short-circuits; delivery provider noop anyway.)

### Stage 3 — Home tab loads alarm + habit data
1. `HomeTab` (`mobile/src/screens/tabs/HomeTab.jsx`) fetches `GET /api/v1/alarms` (+ caches into `offlineStore.js`, AsyncStorage table `ck_offline_alarms`).
2. Habit score loaded via `useHabitScore` → `GET /api/v1/habits/score` → `backend/app/api/habits.py` → `habit_scoring_service.compute_habit_score` → returns 35/25/20/20 weighted composite.

### Stage 4 — Open the arm challenge (AlarmScreen)
1. `AlarmScreen.jsx:23-47` `loadFlow()`: `GET /api/v1/alarms` → finds `is_enabled` alarm → `useChallenge.fetchChallenge({ challengeType, difficulty })`.
2. `useChallenge.jsx:8-31` calls `GET /api/v1/challenges/next?challenge_type=…&difficulty=…`.
3. Router `GET /api/v1/challenges/next` (`backend/app/api/challenges.py`) → `ChallengeService.get_adaptive_challenge` (`backend/app/services/challenge_service.py:352-389`):
   - difficulty anchors to user's last attempt, ML prediction adjusts (via `ai_engine/difficulty.py` `MLInferenceService.predict` — torch or rule-based), clamped +1/−1;
   - **creates a server-side pending `ChallengeAttempt`** storing `puzzle_payload` + hidden `expected_answers`;
   - `payload_for()` strips answers → client gets **prompts/options/timeout only** (no answer leak).

### Stage 5 — Solve + submit
1. User answers questions (`AlarmScreen.jsx:165-204`); timer counts down from `puzzle_payload.timeout_seconds`.
2. `handleDismiss` → `useChallenge.submitChallenge` → `POST /api/v1/challenges/submit` (`backend/app/api/challenges.py`) → `ChallengeService.submit_attempt` (`challenge_service.py:411-457`):
   - loads the attempt, **compares `user_answers` against stored `expected_answers`** (normalized);
   - marks `completed`, writes `correct_answers`/`total_questions`/`user_answers`/`time_taken_seconds`.
   - returns `{completed, correct, correct_answers, total_questions, challenge_attempt_id}`.

### Stage 6 — Dismiss alarm (gate)
1. If fully correct → `AlarmScreen.jsx:76-85` → `POST /api/v1/alarms/{id}/dismiss` with `challenge_attempt_id` + result metrics.
2. Router `POST /api/v1/alarms/{id}/dismiss` (`backend/app/api/alarms.py`) → `alarm_service.dismiss_alarm` (`backend/app/services/alarm_service.py:225-273`):
   - `verification_service.verify_finished_attempt` (`verification_service.py`) — rejects **404** unknown attempt / **400** incomplete or not-all-correct (the wake-up gate);
   - marks alarm disabled (`One-Time`) or re-arms with **timezone-aware** `_compute_next_trigger` (`Daily`/`Weekday`/`Weekend`),
   - `refresh_habit_score(db, user.id, today)` — updates wake-up consistency component.
3. If any answer wrong → 400-style "try again", `AlarmScreen` generates a fresh challenge (`loadFlow`).

### Stage 7 — Analytics & habit scoring (post-dismiss)
1. `habit_scoring_service` recomputes the 4 components + composite (`habit_scoring_service.py:194-198`).
2. Later, Home/Insights fetch `GET /api/v1/analytics/me` → `services/analytics_service.py` (facade) → `behavior_analytics_service.get_user_analytics_summary` — sleep estimate (overnight alarm gaps over 14 days), wake consistency trend (5-point band), snooze averages, per-type challenge accuracy — displayed in `InsightsTab`.
3. `GET /api/v1/analytics/recommendations` → `recommendation_service.py` (4 categories, priority-sorted) → shown in `HomeTab`/Insights.

### Supporting components touched along the way
- **Gateway**: every request passes `gateway/middleware.py` (X-Request-ID, rate-limit counters, error logging).
- **Offline**: if the request fails, `HomeScreen`/`AlarmScreen` fall back to `offlineStore.js` cache; `useSync`/`syncEngine.js` pushes pending rows to `POST /api/v1/sync/pending` (idempotent upsert) on reconnect.
- **DB**: on Docker this hits Postgres via Alembic-migrated schema; local dev uses SQLite auto-created by `bootstrap.py`.

### End-to-end flow diagram

```
Open app (App.js)
  → AuthContext/AuthProvider
  → useAuth: token from AsyncStorage → GET /auth/me (validated)
  → LoginScreen (POST /auth/login → AuthService: bcrypt + JWT)
  → POST /notifications/register (push token registry)

HomeTab
  → GET /alarms ──────────────────▶ api/alarms.py → alarm_service
  → GET /habits/score ────────────▶ api/habits.py → habit_scoring_service

AlarmScreen (loadFlow)
  → GET /challenges/next?type&diff ─▶ api/challenges.py
        └▶ challenge_service.get_adaptive_challenge
              └▶ ai_engine/difficulty.py (ML or rule-based)      [adaptive]
              └▶ ChallengeAttempt created (expected_answers hidden)
   → payload (questions only, no answers)

Submit & dismiss
  → POST /challenges/submit ──────▶ challenge_service.submit_attempt (authoritative compare)
  → POST /alarms/{id}/dismiss ────▶ alarm_service.dismiss_alarm
        └▶ verification_service.verify_finished_attempt (gate: all-correct)
        └▶ _compute_next_trigger (tz-aware next_trigger) + refresh_habit_score

Analytics (later)
  → GET /analytics/me / recommendations
        └▶ behavior_analytics_service (sleep, trends, activity)
        └▶ recommendation_service (sleep/wake/habit/challenge)
```

**Verification note**: file/function wiring above is from static source reading. Runtime confirmation (actual HTTP 200s, DB writes, on-device run) was performed by the team in prior sessions (documented in `context.md`) but **not re-executed during this audit** — marked *Unverified* here.

---

*Generated for the CerebroKognit repository audit. Remaining backlog rows: FCM/APNs delivery provider, on-device local alarm scheduling, Wellness Coach dashboard, MongoDB/session stores, anomaly + performance AI engines, Sentinel monitoring.*