# CerebroKognit — Hierarchical Remediation Plan

---

## Level 0: Repository Foundation
**Status: ✅ DONE (M1)** — `.gitignore`/`.gitattributes` in place, secrets/artifacts untracked, initial commit `bc31e9f`
> *Must be done first — everything else depends on a clean, version-controlled repo.*

```
0.1  Create .gitignore at repository root
     ├── 0.1.1  Add Python ignores (__pycache__, .venv, *.pyc, *.db, .env)
     ├── 0.1.2  Add Node ignores (node_modules, dist, .env.local)
     ├── 0.1.3  Add IDE ignores (.idea/, .vscode/)
     ├── 0.1.4  Add Expo ignores (.expo/, web-build/)
     └── 0.1.5  Add misc (ngrok.zip, *.log, .pytest_cache/)

0.2  Clean tracked secrets/artifacts
     ├── 0.2.1  Remove mobile/.env from git staging
     ├── 0.2.2  Remove backend/cerebrokognit.db from tracking
     ├── 0.2.3  Remove backend/test_sync.db (orphaned test artifact)
     ├── 0.2.4  Remove vite_*.log dev artifacts from web/
     └── 0.2.5  Remove .Copencode/ HTML artifacts

0.3  Make initial commit with clean state
     └── 0.3.1  git add -A && git commit -m "Initial project state"
```

---

## Level 1: Backend Security & Core Configuration
**Status: 🟡 PARTIAL (M1)** — 1.1 JWT secret from env ✅ · 1.2 CORS from env ✅ · 1.3 bcrypt rounds verified ✅ · **1.4 EmailStr validation ⏳ not yet applied**
> *Fix security-critical issues that affect every other component.*

```
1.1  Externalize JWT secret
     ├── 1.1.1  backend/app/services/auth.py:17 — replace hardcoded SECRET_KEY
     │           with os.getenv("SECRET_KEY") and fail-fast if missing
     ├── 1.1.2  Also read ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS from env
     └── 1.1.3  Update .env and .env.example with strong random default

1.2  Fix CORS configuration
     ├── 1.2.1  backend/app/main.py:21-27 — read CORS_ORIGINS from env variable
     ├── 1.2.2  Default to http://localhost:5173 for dev
     └── 1.2.3  Remove allow_credentials=True with wildcard origin

1.3  Fix password hashing defaults
     ├── 1.3.1  Verify bcrypt rounds >= 12 (already correct)
     └── 1.3.2  Ensure no plaintext passwords in logs

1.4  Add EmailStr validation
     ├── 1.4.1  Import EmailStr in schemas/__init__.py and schemas/auth.py
     ├── 1.4.2  Change User.email and AuthRegisterReq.email to EmailStr
     └── 1.4.3  Add case-insensitive email lookup (use func.lower())
```

---

## Level 2: Backend Schema Consolidation
**Status: ❌ NOT STARTED** — `schemas/all.py` + `schemas/auth.py` still duplicated (only 2.3.1 formatted consistently)
> *Resolve the tripled/broken schemas before fixing any endpoint.*

```
2.1  Delete dead schema file
     └── 2.1.1  Delete backend/app/schemas/all.py (broken import, never used)

2.2  Unify schema sources
     ├── 2.2.1  Merge schemas/auth.py into schemas/__init__.py
     │           (AuthRegisterReq with difficulty_preference, UserProfileRes with full_name)
     ├── 2.2.2  Update api/auth.py import to use schemas package
     ├── 2.2.3  Update services/auth.py import to use schemas package
     └── 2.2.4  Delete backend/app/schemas/auth.py

2.3  Fix schema inconsistencies
     ├── 2.3.1  Verify DismissRes.next_trigger is Optional[str] everywhere
     ├── 2.3.2  Add missing schema types: NotificationReq/Res, ReportExportReq/Res
     │           OR remove them if not needed
     └── 2.3.3  Verify all response_model annotations match actual return types
               (habits.py uses dict instead of HabitScoreRes, analytics.py uses dict)
```

---

## Level 3: Database & Migrations
**Status: 🟡 PARTIAL (M1)** — 3.1 import/env fixes ✅ · 3.2 migration regenerated (`732e5cb49bcf` initial + `1c584bd4a5b0` answer-data) + verified on fresh DB ✅ · 3.3 startup init ⏳ manual `init_db.py` only (Docker entrypoint not wired) · 3.4 seed script ✅ (roles + demo user + full 7×5 challenge grid)
> *Must be working before any feature can be reliably tested.*

```
3.1  Fix migration infrastructure
     ├── 3.1.1  migrations/env.py:28 — change "app.models" to "app.Models"
     │           (or rename Models.py to models.py for consistency)
     ├── 3.1.2  Fix alembic.ini — read sqlalchemy.url from env, not hardcoded
     ├── 3.1.3  Fix migrations/env.py to use config.get_main_option("sqlalchemy.url")
     │           with DATABASE_URL env fallback

3.2  Regenerate migration to match Models.py
     ├── 3.2.1  Add missing columns to users: full_name, timezone, difficulty_preference
     ├── 3.2.2  Add missing column to challenges: generated_at
     ├── 3.2.3  Add missing table: alarm_roles
     ├── 3.2.4  Add missing index: ix_users_email_lower
     ├── 3.2.5  Fix user_roles PK mismatch (composite vs standalone id)
     ├── 3.2.6  Add unique constraint: habit_scores(user_id, date)
     └── 3.2.7  alembic revision --autogenerate -m "sync_with_models"

3.3  Add startup DB initialization
     ├── 3.3.1  Add Base.metadata.create_all() fallback in backend/app/main.py
     │           (startup event that checks if tables exist)
     └── 3.3.2  OR add alembic upgrade head to Docker entrypoint script

3.4  Add seed data script
     ├── 3.4.1  Create backend/seed_db.py
     ├── 3.4.2  Seed default roles: User, Wellness Coach, Administrator
     ├── 3.4.3  Seed demo user: demo@cerebro.com
     └── 3.4.4  Seed sample challenges (all 7 types x 5 difficulties)
```

---

## Level 4: Backend RBAC & Authorization
**Status: ✅ DONE (M1)** — `app/api/deps.py` `require_roles()`; role auto-assign on registration; dashboard staff/admin enforced (403 smoke-verified)
> *Fix the admin bypass before any dashboard work.*

```
4.1  Implement real _require_admin()
     ├── 4.1.1  backend/app/api/dashboard.py:22-26
     ├── 4.1.2  Query UserRole table for current_user.id + role "Administrator"
     ├── 4.1.3  Return True only if role exists, else raise 403
     └── 4.1.4  Add get_current_admin_user dependency function

4.2  Implement role assignment on registration
     ├── 4.2.1  backend/app/api/auth.py:62-105
     ├── 4.2.2  After creating User, create UserRole with role_id for "User"
     └── 4.2.3  Optionally: add admin endpoint to assign roles

4.3  Add middleware-based role checks
     ├── 4.3.1  Create backend/app/api/deps.py with require_role() dependency
     └── 4.3.2  Apply to dashboard routes (admin-only) and any future coach routes
```

---

## Level 5: Backend Challenge Engine Fixes
**Status: ✅ DONE (M2 2026-09-06)** — 5.1 no answer leak · 5.2 deterministic templates · 5.3 `/challenges/submit` live · single-question/multi-step/timeouts · `smoke_m2.py` no-leak + wrong/right answer checks pass
> *Implemented server-authoritative design: `/next` persists `puzzle_payload` + `expected_answers` on a pending `ChallengeAttempt`; `/submit` verifies and marks complete; adaptive difficulty preserved.*

```
5.1  Stop leaking answers in puzzle payload
     ├── 5.1.1  backend/app/services/challenge_service.py:91-95
     ├── 5.1.2  Remove "answer" key from _generate_payload return
     └── 5.1.3  Keep answer stored server-side (in ChallengeAttempt or session)

5.2  Fix challenge template random-mismatch bugs
     ├── 5.2.1  Logic template (:31) — question and answer must use same random.sample
     ├── 5.2.2  Word template (:45) — question and answer must use same random.choice
     └── 5.2.3  Pattern template (:56) — question and answer must use same pattern

5.3  Add challenge answer verification endpoint
     ├── 5.3.1  Create POST /api/v1/challenges/submit
     ├── 5.3.2  Accept: challenge_id, user_answer, time_taken_seconds
     ├── 5.3.3  Store server-side answer in ChallengeAttempt
     ├── 5.3.4  Return: correct, correct_answer, challenge_attempt_id
     └── 5.3.5  This endpoint is called BEFORE alarm dismiss
```

---

## Level 6: Backend Alarm Dismiss Flow Fix
**Status: ✅ DONE (M1 + M2 2026-09-06)** — 6.1 create_alarm challenge fields ✅ · 6.2 dismiss verified end-to-end via `/next`→`/submit`→`/dismiss` (400/404 paths smoke-tested) ✅ · 6.3 tz handling (`timezone.utc` snooze + user-tz) ✅ · 6.4 `/users/profile` endpoints ✅
> *The core product feature — must work end-to-end.*

```
6.1  Fix create_alarm to use challenge fields
     ├── 6.1.1  backend/app/api/alarms.py:40-47
     ├── 6.1.2  Read challenge_type, difficulty from AlarmCreateReq
     └── 6.1.3  Store or link to challenge preferences on the alarm

6.2  Fix dismiss flow to validate via ChallengeAttempt
     ├── 6.2.1  backend/app/api/alarms.py:126-200
     ├── 6.2.2  Verify challenge_attempt_id references a real attempt
     ├── 6.2.3  Verify attempt.completed == True
     ├── 6.2.4  Verify correct_answers >= total_questions
     ├── 6.2.5  On success: update alarm next_trigger, increment habit_score data
     └── 6.2.6  On failure: return detailed error (not just 400)

6.3  Fix timezone handling
     ├── 6.3.1  Replace datetime.utcnow() with datetime.now(timezone.utc) throughout
     ├── 6.3.2  Use User.timezone for next_trigger computation
     └── 6.3.3  Remove hardcoded 07:00 default (use alarm's stored time or user pref)

6.4  Add missing user profile endpoints (for mobile)
     ├── 6.4.1  Create PUT /api/v1/users/profile — update full_name, timezone, difficulty_preference
     └── 6.4.2  Create GET /api/v1/users/profile — return current user (alias for /auth/me if needed)
```

---

## Level 7: Backend Analytics & Reporting Fixes
**Status: 🟡 PARTIAL (M2)** — 7.1.1 `sleep_duration_avg` still hardcoded ❌ (M3) · 7.1.2 `recent_activity` real ✅ · 7.1.3 trend static ❌ (M3) · **challenge analytics real per-type (accuracy, attempts, avg solve time) ✅ (M2)** · uptime placeholder (M3) · PDF/Excel (M4)
> *Replace remaining hardcoded placeholders with real computation (M3 scope).*

```
7.1  Fix analytics endpoint
     ├── 7.1.1  backend/app/api/analytics.py:46 — compute real sleep_duration_avg from alarm data
     ├── 7.1.2  analytics.py:50-53 — compute real recent_activity from attempts/alarms
     ├── 7.1.3  analytics.py:60 — compute real wake_up_consistency_trend from habit_scores
     └── 7.1.4  Return AnalyticsRes schema, not dict

7.2  Fix dashboard analytics
     └── 7.2.1  dashboard.py:112 — remove system_uptime_placeholder (or compute real uptime)

7.3  Add PDF/Excel export (SRS FR-REP-005)
     ├── 7.3.1  Add reportlab or openpyxl to requirements.txt
     ├── 7.3.2  Add /dashboard/reports/habits/pdf endpoint
     ├── 7.3.3  Add /dashboard/reports/habits/excel endpoint
     └── 7.3.4  Repeat for wake-up and challenges reports
```

---

## Level 8: Backend Error Handling Standardization
**Status: ❌ NOT STARTED** — still `{"detail": ...}` only; no `error_code`/`timestamp` envelope
> *SRS requires {detail, error_code, timestamp} envelope.*

```
8.1  Create global exception handler
     ├── 8.1.1  backend/app/main.py — add app.exception_handler(Exception)
     ├── 8.1.2  Return {"detail": str, "error_code": "ERR_XXX", "timestamp": "ISO8601"}
     └── 8.1.3  Register for HTTPException and generic Exception

8.2  Add application-level logging
     ├── 8.2.1  Add logging.basicConfig() in main.py
     ├── 8.2.2  Add structured JSON logging for production
     ├── 8.2.3  Add request/response logging middleware
     └── 8.2.4  Add error logging in all except blocks
```

---

## Level 9: Docker & Infrastructure
**Status: 🟡 PARTIAL (M1)** — 9.1.1 CMD fixed ✅ · 9.2 `load_dotenv` override fixed ✅ · 9.3 `.dockerignore` ✅ · 9.1.2/9.1.3 entrypoint+non-root ❌ · 9.4 compose config valid but `version:` key + healthchecks ⏳ · 9.5 web Dockerfile ❌. Full `docker compose up` test pending.
> *Make it deployable.*

```
9.1  Fix Dockerfile
     ├── 9.1.1  Change CMD to ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
     ├── 9.1.2  Add ENTRYPOINT script that runs alembic upgrade head first
     ├── 9.1.3  Add non-root USER directive
     └── 9.1.4  Add EXPOSE 8000

9.2  Fix load_dotenv override issue
     ├── 9.2.1  backend/app/database.py:11 — remove override=True
     │           OR check if running in Docker (ENV ENVIRONMENT=production)
     │           and skip load_dotenv entirely
     └── 9.2.2  Verify DATABASE_URL is read from env, not .env file in Docker

9.3  Create .dockerignore
     ├── 9.3.1  Exclude .venv/, __pycache__/, *.db, .env, .pytest_cache/
     └── 9.3.2  Exclude node_modules/, .git/, *.log

9.4  Fix docker-compose.yml
     ├── 9.4.1  Add healthcheck to api service
     ├── 9.4.2  Add healthcheck condition to web service dependency
     ├── 9.4.3  Uncomment and fix web service definition
     ├── 9.4.4  Remove deprecated version key
     ├── 9.4.5  Remove exposed PostgreSQL port (5432:5432 -> 5432)
     ├── 9.4.6  Add resource limits (memory, cpu)
     └── 9.4.7  Use env_file instead of hardcoded passwords

9.5  Add web Dockerfile
     ├── 9.5.1  Multi-stage build: node build -> nginx serve
     ├── 9.5.2  Configure nginx to proxy /api to backend service
     └── 9.5.3  Add to docker-compose.yml web service
```

---

## Level 10: Web Dashboard Fixes
**Status: 🟡 PARTIAL (M1)** — 10.3 alarm form (time picker, recurrence, challenge, difficulty) ✅ · 10.5.1 settings→profile persistence ✅ · 10.2 Dashboard wired to `/habits/score/history` ✅ but Home still mock · 10.1 fallback scores remain · 10.4/10.5.2/10.6 ❌
> *Fix existing pages before adding new ones.*

```
10.1  Remove mock/fallback data
      ├── 10.1.1  Home.jsx:22-28 — remove hardcoded fallback scores, show error state
      ├── 10.1.2  Dashboard.jsx:23-29 — same
      ├── 10.1.3  Reports.jsx:20-26 — same
      └── 10.1.4  chartUtils.js:8-37 — delete entire file (all hardcoded data)

10.2  Wire charts to real data
      ├── 10.2.1  Call GET /api/v1/habits/score/history in Home.jsx and Dashboard.jsx
      ├── 10.2.2  Replace hardcoded chart series with history data
      └── 10.2.3  Add proper date labels (not hardcoded Mon-Sun)

10.3  Fix alarm management
      ├── 10.3.1  Add time-of-day picker to create alarm form
      ├── 10.3.2  Add recurrence selector (Daily/Weekday/One-Time)
      ├── 10.3.3  Add challenge type selector
      ├── 10.3.4  Add enable/disable toggle
      └── 10.3.5  Send all fields to POST /api/v1/alarms

10.4  Fix auth flow
      ├── 10.4.1  Remove hardcoded demo credentials (demo@cerebro.com / password123)
      ├── 10.4.2  Add token validation on app load (call /auth/me, not just check localStorage)
      └── 10.4.3  Add logout functionality (clear token, redirect)

10.5  Add missing pages
      ├── 10.5.1  Settings page — persist toggles to user profile via API
      ├── 10.5.2  Admin dashboard — user list + platform analytics
      └── 10.5.3  404 page

10.6  Add mobile responsiveness
      ├── 10.6.1  Add hamburger menu for small screens (7 nav links overflow)
      └── 10.6.2  Test all pages at 375px, 768px, 1024px breakpoints
```

---

## Level 11: Mobile App — Core Flow Fixes
**Status: 🟡 PARTIAL (M1+M2)** — 11.1 API layer ✅ (authHeaders + parseApiError) · 11.2 dismiss E2E ✅ (next→solve→submit→dismiss, server challenge, no auto-answer, success/failure UI) · 11.3 useChallenge server-authoritative ✅ · 11.4.3 habit PUT removed ✅ · 11.4.4 `overist_score` typo fixed ✅ · 11.5.3 Home nav to Challenge/Profile/Settings ✅ · 11.5.1 registration + 11.5.2 alarm-creation screens ❌ (out of M2 scope)
> *Core flow (the app's primary purpose) now works server-authoritatively; remaining mobile items are screen additions, not blocked by the backend.*

```
11.1  Fix API integration layer
      ├── 11.1.1  mobile/src/utils/api.js — add token refresh handling
      ├── 11.1.2  Add proper error response parsing (not just console.error)
      └── 11.1.3  Add request timeout handling

11.2  Fix alarm dismiss flow (end-to-end)
      ├── 11.2.1  AlarmScreen.jsx — call GET /challenges/next to get server challenge
      ├── 11.2.2  User solves challenge, submit to POST /challenges/submit
      ├── 11.2.3  Receive challenge_attempt_id from server
      ├── 11.2.4  Call POST /alarms/{id}/dismiss with correct payload:
      │           {challenge_attempt_id, correct_answers, total_questions, time_taken_seconds}
      ├── 11.2.5  Remove auto-filled answer (AlarmScreen.jsx:78)
      └── 11.2.6  Add proper success/failure UI feedback

11.3  Fix mobile challenge flow
      ├── 11.3.1  useChallenge.jsx — replace client-side generation with API call to /challenges/next
      ├── 11.3.2  Fix case mismatch: 'math' -> 'Math' (match server casing)
      └── 11.3.3  Add time tracking for challenge attempts

11.4  Fix broken API calls
      ├── 11.4.1  ProfileScreen.jsx — call PUT /users/profile (once backend endpoint exists at Level 6.4)
      ├── 11.4.2  SettingsScreen.jsx — call PUT /users/profile (not /users/{key})
      ├── 11.4.3  useHabitScore.jsx:33 — remove PUT call (read-only, no update endpoint needed)
      └── 11.4.4  HomeScreen.jsx:69 — fix overist_score -> overall_score typo

11.5  Add missing mobile screens
      ├── 11.5.1  Registration screen (call POST /auth/register)
      ├── 11.5.2  Alarm creation screen (call POST /alarms)
      └── 11.5.3  Navigation to Profile/Settings from HomeScreen
```

---

## Level 12: Mobile — Alarm Scheduling & Notifications
**Status: ❌ NOT STARTED (M4)** — no local scheduling, no push registration, `mobile/assets/` missing (app.json references nonexistent files)
> *The "alarm" part of "Intelligent Cognitive Alarm Platform."*

```
12.1  Implement local notification scheduling
      ├── 12.1.1  Use expo-notifications scheduleNotificationAsync
      ├── 12.1.2  Schedule at alarm's next_trigger time
      ├── 12.1.3  Handle notification tap -> navigate to AlarmScreen
      └── 12.1.4  Cancel notification on alarm delete/disable

12.2  Implement background alarm check
      ├── 12.2.1  Use expo-task-manager for background fetch
      ├── 12.2.2  Periodically sync alarm schedule from server
      └── 12.2.3  Update local notifications if server schedule changed

12.3  Register push notification token with backend
      ├── 12.3.1  POST token to new endpoint: POST /api/v1/notifications/register
      ├── 12.3.2  Backend stores token in user record
      └── 12.3.3  Backend can send push for missed alarms (future)

12.4  Add app assets
      ├── 12.4.1  Create mobile/assets/ directory
      ├── 12.4.2  Add icon.png, splash.png, adaptive-icon.png, favicon.png
      └── 12.4.3  Verify app.json references resolve
```

---

## Level 13: Mobile — Offline Sync
**Status: ❌ NOT STARTED (M4)** — `offline-cache-schemas.ts` defines types only; mobile never calls `/sync/*`
> *Offline-first is a core design principle per SRS.*

```
13.1  Implement local cache layer
      ├── 13.1.1  Create mobile/src/services/storage.js using expo-sqlite
      ├── 13.1.2  Implement CRUD for alarms, challenges, habit_scores tables
      ├── 13.1.3  Use offline-cache-schemas.ts as type definitions
      └── 13.1.4  Cache API responses on successful fetch

13.2  Implement sync engine
      ├── 13.2.1  Track local changes with timestamps (pending_sync flag)
      ├── 13.2.2  On network reconnect, call POST /sync/pending with local changes
      ├── 13.2.3  Call GET /sync/pull to get server changes since last sync
      ├── 13.2.4  Apply server changes to local cache (idempotent)
      └── 13.2.5  Use @react-native-community/netinfo for connectivity detection

13.3  Wire sync to all data screens
      ├── 13.3.1  HomeScreen — show cached alarms when offline
      ├── 13.3.2  AlarmScreen — queue dismiss attempt if offline
      ├── 13.3.3  ChallengeScreen — cache next challenges for offline use
      └── 13.3.4  Show sync status indicator in UI
```

---

## Level 14: Testing
**Status: ❌ NOT STARTED (M4)** — zero test files; only manual `scripts/smoke_m1.py` (22 checks) + `scripts/smoke_m2.py` (28 checks, incl. alembic-on-fresh-DB and no-answer-leak), both in-process via TestClient
> *Add comprehensive test coverage.*

```
14.1  Backend tests
      ├── 14.1.1  Add pytest + httpx to requirements.txt (dev dependencies)
      ├── 14.1.2  Create backend/tests/conftest.py (TestClient fixture, test DB setup)
      ├── 14.1.3  Create backend/tests/test_auth.py
      │           ├── test_register_success
      │           ├── test_register_duplicate_email
      │           ├── test_login_success
      │           ├── test_login_wrong_password
      │           └── test_me_with_valid_token
      ├── 14.1.4  Create backend/tests/test_alarms.py
      │           ├── test_create_alarm
      │           ├── test_list_alarms
      │           ├── test_snooze_alarm
      │           ├── test_dismiss_alarm_success
      │           └── test_dismiss_alarm_wrong_answer
      ├── 14.1.5  Create backend/tests/test_challenges.py
      │           ├── test_list_challenges
      │           ├── test_get_next_challenge
      │           └── test_submit_challenge_answer
      ├── 14.1.6  Create backend/tests/test_habits.py
      │           ├── test_get_habit_score
      │           └── test_habit_score_history
      ├── 14.1.7  Create backend/tests/test_sync.py
      │           ├── test_sync_pending_idempotent
      │           └── test_sync_pull_incremental
      └── 14.1.8  Target: 70%+ coverage

14.2  Web tests
      ├── 14.2.1  Add vitest + @testing-library/react to web/package.json
      ├── 14.2.2  Create web/src/__tests__/Auth.test.jsx
      ├── 14.2.3  Create web/src/__tests__/Dashboard.test.jsx
      └── 14.2.4  Create web/src/__tests__/AlarmManagement.test.jsx

14.3  Mobile tests
      ├── 14.3.1  Add jest-expo to mobile/package.json
      ├── 14.3.2  Create mobile/src/__tests__/useAuth.test.jsx
      ├── 14.3.3  Create mobile/src/__tests__/AlarmScreen.test.jsx
      └── 14.3.4  Create mobile/src/__tests__/ChallengeScreen.test.jsx
```

---

## Level 15: Linting, Type Checking & CI/CD
**Status: ❌ NOT STARTED (M4)** — no ruff/eslint/mypy config; no `.github/workflows`
> *Automated quality gates.*

```
15.1  Add linting
      ├── 15.1.1  Backend: add ruff to requirements.txt, create pyproject.toml [tool.ruff]
      ├── 15.1.2  Web: create .eslintrc.json with React rules
      └── 15.1.3  Mobile: extend Expo's default ESLint config

15.2  Add type checking
      ├── 15.2.1  Backend: add mypy.ini, fix type annotations
      ├── 15.2.2  Web: add tsconfig.json (strict mode), convert .jsx -> .tsx incrementally
      └── 15.2.3  Mobile: tighten tsconfig.json strict options

15.3  Add CI/CD pipeline
      ├── 15.3.1  Create .github/workflows/ci.yml
      ├── 15.3.2  Steps: checkout -> setup-python -> pip install -> pytest
      ├── 15.3.3  Steps: checkout -> setup-node -> npm ci -> npm run lint -> npm run test
      ├── 15.3.4  Steps: docker build -> docker-compose up -> smoke test
      └── 15.3.5  Add branch protection rules

15.4  Add pre-commit hooks
      ├── 15.4.1  Install pre-commit framework
      ├── 15.4.2  Add ruff, eslint, mypy hooks
      └── 15.4.3  Add secrets detection hook (detect-secrets or gitleaks)
```

---

## Level 16: Monitoring, Logging & Production Hardening
**Status: ❌ NOT STARTED** — no structured logs, rate limiting, Sentry, or perf work
> *Make it observable and resilient.*

```
16.1  Structured logging
      ├── 16.1.1  Add python-json-logger for structured JSON output
      ├── 16.1.2  Add request ID middleware (X-Request-ID)
      └── 16.1.3  Add request/response logging middleware

16.2  Health checks
      ├── 16.2.1  /health — check DB connectivity (not just static "healthy")
      ├── 16.2.2  /health — check Redis connectivity (when added)
      └── 16.2.3  Docker HEALTHCHECK using /health

16.3  Rate limiting
      ├── 16.3.1  Add slowapi or custom middleware
      ├── 16.3.2  Rate limit /auth/login: 5/min per IP
      └── 16.3.3  Rate limit /auth/register: 3/min per IP

16.4  Error tracking
      ├── 16.4.1  Add Sentry SDK (or equivalent)
      └── 16.4.2  Configure DSN via environment variable

16.5  Performance
      ├── 16.5.1  Fix N+1 query in dashboard.py:99 (Challenge lookup in loop)
      ├── 16.5.2  Add query pagination for list endpoints
      └── 16.5.3  Add database connection pooling verification
```

---

## Visual Dependency Graph

```
LEVEL 0 (Repo Foundation)
    |
    v
LEVEL 1 (Security & Config) --> LEVEL 2 (Schema Consolidation)
                                      |
                                      v
                                LEVEL 3 (Database & Migrations)
                                      |
                    +-----------------+-----------------+
                    v                 v                  v
              LEVEL 4 (RBAC)   LEVEL 5 (Challenges)  LEVEL 8 (Error Handling)
                    |                 |
                    v                 v
              LEVEL 6 (Alarm Dismiss Flow) <---- LEVEL 7 (Analytics)
                    |
         +----------+----------+
         v          v          v
    LEVEL 9      LEVEL 10    LEVEL 11
  (Docker)      (Web UI)    (Mobile Fixes)
                              |
                    +---------+---------+
                    v         v         v
               LEVEL 12   LEVEL 13   LEVEL 14
            (Notifs)    (Offline)   (Testing)
                              |
                              v
                        LEVEL 15 (Linting/CI)
                              |
                              v
                        LEVEL 16 (Production)
```

---

## Summary: Effort Estimates per Level

| Level | Description | Est. Time | Status | Depends On |
|-------|-------------|-----------|--------|------------|
| 0 | Repository Foundation | 30 min | ✅ Done (M1) | -- |
| 1 | Backend Security & Config | 2 hours | 🟡 Partial (1.4 EmailStr left) | Level 0 |
| 2 | Schema Consolidation | 1.5 hours | ❌ Not started | Level 1 |
| 3 | Database & Migrations | 2 hours | 🟡 Partial (3.3 startup init) | Level 2 |
| 4 | RBAC & Authorization | 2 hours | ✅ Done (M1) | Level 3 |
| 5 | Challenge Engine Fixes | 3 hours | ✅ Done (M2) | Level 2 |
| 6 | Alarm Dismiss Flow | 4 hours | ✅ Done (M1+M2) | Levels 4, 5 |
| 7 | Analytics & Reporting | 3 hours | 🟡 Partial (challenge analytics real in M2; PDF/Excel + ML model pending M3/M4) | Level 3 |
| 8 | Error Handling | 2 hours | ❌ Not started | Level 2 |
| 9 | Docker & Infrastructure | 3 hours | 🟡 Partial (up-test pending) | Levels 1, 3 |
| 10 | Web Dashboard Fixes | 6 hours | 🟡 Partial (Home/admin/mocks left) | Levels 6, 7 |
| 11 | Mobile Core Flow Fixes | 8 hours | 🟡 Partial (dismiss E2E done; registration/alarm-creation screens left) | Levels 5, 6 |
| 12 | Alarm Scheduling & Notifications | 6 hours | ❌ Not started (M4) | Level 11 |
| 13 | Offline Sync | 8 hours | ❌ Not started (M4) | Level 11 |
| 14 | Testing | 10 hours | ❌ Not started (M4) | Levels 6-13 |
| 15 | Linting & CI/CD | 4 hours | ❌ Not started (M4) | Level 14 |
| 16 | Production Hardening | 6 hours | ❌ Not started | Level 15 |
| | **TOTAL remaining** | **~60 hours** | | |
