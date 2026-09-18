# Testing, Security, Deployment, and Remaining Work

> Evidence-based audit of the Intelligent Cognitive Alarm Platform ("CerebroKognit").
> All claims are either statically verified from source files or explicitly marked Unverified. No test was executed during this audit.

---

## Q19. Automated tests — inventory and results

### 19.1 Backend pytest suite

**Location:** `backend/tests/` (7 files: `conftest.py` + 6 test modules)

| File | Test functions | Domain covered |
|---|---|---|
| `test_auth.py` | 8 | Registration, login, me, profile update, settings, role assignment, duplicate email |
| `test_alarms.py` | 6 | CRUD, snooze cap, timezone-aware next_trigger, snooze postponement |
| `test_challenges.py` | 10 | Adaptive /next, no-answer-leak payload, wrong/correct submit, multi-step, dismiss gate (400/404), dismiss after full completion |
| `test_analytics.py` | 6 | /analytics/me (real values), /recommendations, /ml-status, report CSV/PDF/Excel, report status |
| `test_notifications.py` | 9 | Token register/deregister/list, idempotent reassign, ownership scope, empty-token 400 |
| `test_feedback.py` | 8 | Submit + validation (blank message 422, invalid category 422, out-of-range rating 422), storage |
| **TOTAL** | **47** | |

**Fixtures** (`conftest.py`):
- In-memory SQLite engine (`sqlite://`) with `StaticPool`
- `SECRET_KEY="test_secret_key_that_is_long_enough"` injected before app import
- `DATABASE_URL=sqlite://` set at module level
- `db` fixture: `create_all` → session → `drop_all` (function-scoped isolation)
- `client` fixture: TestClient wired via `dependency_overrides[get_db]`
- `_reset_rate_limiters`: autouse fixture calls `reset_limiters()` before every test (deterministic rate-limit state)
- `user_headers`: registers a random user, returns `Authorization: Bearer <token>`
- `solved_math_attempt`: pre-completes a single-question Math attempt (shared fixture)

**Command:** `python -m pytest tests/ -q` (from `backend/`)
**Reported result (CONTEXT.md, last gate run):** 34 passed (note: the static `def test_` count shows 47, which may include tests added after the last documented gate run; the discrepancy is flagged for verification).
**Coverage:** No coverage tool configured (`pytest-cov` not installed, no `.coveragerc`, no `[tool.coverage]` in `pyproject.toml`). Coverage is **0% measured**.

**CI invocation** (`ci.yml:37-38`):
```yaml
- name: Run unit test suite
  run: python -m pytest tests/ -q
  env:
    SECRET_KEY: ci_test_secret_key_that_is_long_enough
    DATABASE_URL: sqlite://
```

### 19.2 Smoke tests (HTTP-level integration)

| Script | Checks | What it tests | Command |
|---|---|---|---|
| `smoke_m1.py` | 22 | health, register, login, me, profile update, settings, role assignment, alarm CRUD, snooze, recurrence, timezone, RBAC 403s, habit score + history | `python scripts/smoke_m1.py` |
| `smoke_m2.py` | 25 | health, register, login, `/challenges/next` (no-leak verify), wrong/correct submit, multi-step, alarm dismiss with valid/incomplete/unknown attempt, analytics real data, habit score | `python scripts/smoke_m2.py` |

Both scripts use `httpx.Client` against a live `localhost:8000` server. They print PASS/FAIL per check and a final summary line (`SMOKE TEST RESULT: ALL PASS` or `N FAILURE(S)`). They require the backend to be running; they are **not** run in CI against an ephemeral server — the CI `smoke_m1.py`/`smoke_m2.py` steps assume the server is already started (CI runs them after pytest; they are functional because `conftest.py` starts an in-memory DB but smoke scripts need an HTTP server — this is a **CI smoke gap** unless the test environment provides one).

**Reported result:** smoke_m1 22/22 pass, smoke_m2 25/25 pass (CONTEXT.md; runtime execution unverified in this audit).

### 19.3 Web frontend tests (Vitest)

**Location:** `web/src/` — 11 test files

| File | Tests | Domain |
|---|---|---|
| `App.test.jsx` | 5 | Shell nav sections, landing page, auth page default, sidebar, data render |
| `Auth.test.jsx` | 8 | Login/register tabs, form submission, email validation, demo button, password min-length, accessibility, theme toggle, back link |
| `Dashboard.test.jsx` | 1 | Loads real payload: overall_score, trend, per-type, recommendations |
| `Landing.test.jsx` | 6 | Hero, features, pill sections, CTA, footer links, scroll |
| `Profile.test.jsx` | 3 | Full name display, timezone, difficulty |
| `chartUtils.test.js` | 5 | All four series, snake_case data keys, label fallback, empty input |
| `timeFormat.test.js` | 6 | 12/24 formatting, date, weekday, parse, empty |
| `timezones.test.js` | 3 | UTC guaranteed, Kolkata guaranteed, lookup by ID |
| `LiveClock.test.jsx` | 2 | Renders, ticks |
| `TimeInput.test.jsx` | 4 | 12h/24h modes, onChange |
| `TimezonePicker.test.jsx` | 6 | Open, search, select, keyboard, country alias, close |
| **TOTAL** | **49** | |

**Command:** `npm test` (from `web/`) → `vitest run`
**Config:** `vite.config.js:21-25` — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.js']`
**Reported result:** 49/49 pass (CONTEXT.md last gate)
**Coverage:** Not configured (no coverage option in vite.config, no @vitest/coverage).

### 19.4 Mobile frontend tests (Jest/Expo)

**Location:** `mobile/src/` — 10 test files

| File | Tests | Domain |
|---|---|---|
| `api.test.js` | 11 | Base URL probe, candidate fallback, auth-expired event, parseApiError, describeFetchError |
| `MainTabs.test.jsx` | 4 | Tab renders, active state, navigation |
| `ChipRow.test.jsx` | 2 | Renders chips, selection |
| `ConnectRow.test.jsx` | 2 | Connectivity row renders |
| `useHabitScore.test.jsx` | 3 | Loads score, handles error, history |
| `registerPush.test.js` | 5 | Token acquisition, expo-go guard, registration skip |
| `FeedbackScreen.test.jsx` | 6 | Renders, submit, validation |
| `offlineStore.test.js` | 5 | Set/get/list/delete AsyncStorage-backed store |
| `syncEngine.test.js` | 7 | pushPending, pullServer, runSync, sync marking |
| `ThemeContext.test.jsx` | 2 | Provider renders, toggle |
| **TOTAL** | **47** | |

**Command:** `npm test -- --ci` (from `mobile/`) → `jest`
**Config:** `jest.preset: "jest-expo"`, `setupFiles: ["./jest.setup.js"]` (AsyncStorage mock + vector-icons mock)
**Reported result:** 47/47 pass (CONTEXT.md last gate)
**Coverage:** Not configured.

### 19.5 AI/ML tests

**No dedicated ML test suite.** The ML model is verified indirectly:
- `smoke_m2.py` check 24: `analytics challenge_accuracy > 0` (confirms challenge attempts flow through ML pipeline)
- `test_analytics.py::test_ml_status` (check existence of `model_loaded` key)
- `train_difficulty_model.py` is a training script, not a test
- The PyTorch `DifficultyPredictor` class has no unit tests (no test for forward pass, feature normalization, label decoding)

**Docker runtime note:** `requirements-runtime.txt` excludes `torch`, so `ml_inference.py` falls back to rule-based difficulty. This fallback is untested in isolation.

### 19.6 End-to-end tests

**None.** There are no Playwright, Cypress, Detox, Appium, or any E2E test scripts. The smoke scripts come closest (HTTP-level integration) but don't cover mobile flows, browser rendering, or push notification delivery.

### 19.7 Linting

| Tool | Config | Result |
|---|---|---|
| **Ruff** | `backend/pyproject.toml` (E/F/W pragmatic select) | `ruff check app tests scripts` — 0 issues (CONTEXT.md) |
| **ESLint** | Not installed in web or mobile | N/A |
| **mypy** | Not installed | N/A |
| **TypeScript** | `tsc --noEmit` never run in CI | N/A |

### 19.8 CI pipeline (`ci.yml`)

Three parallel jobs on `ubuntu-latest`:

```
backend → python 3.11 → pip install → ruff check → pytest → smoke_m1 → smoke_m2
web     → node 20    → npm ci     → vitest run  → vite build
mobile  → node 20    → npm ci     → jest --ci
```

**Missing from CI:** Docker build + up-test (was verified manually per CONTEXT.md but not in the YAML), smoke scripts need a running server (CI gap if backend isn't started), no coverage reporting, no artifact upload, no deployment step.

### 19.9 Test summary

| Layer | Framework | Count | Pass | Coverage | Gaps |
|---|---|---|---|---|---|
| Backend unit/API | pytest | 47 | claimed 34 | 0% | No coverage, no ML unit tests |
| Backend integration | smoke scripts | 47 checks | claimed 47/47 | N/A | Requires running server; not in CI isolated env |
| Web frontend | Vitest | 49 | claimed 49/49 | 0% | No coverage, no E2E |
| Mobile frontend | Jest-Expo | 47 | claimed 47/47 | 0% | No coverage, no E2E |
| E2E (full stack) | none | 0 | — | — | Complete absence |
| ML/AI | none | 0 | — | — | No model inference tests |
| **TOTAL** | | **143** | **130 claimed** | **0%** | |

---

## Q20. Security vulnerabilities and missing controls

### 20.1 Authentication and JWT

| Control | Status | File:line | Risk |
|---|---|---|---|
| **Password hashing** | ✅ bcrypt, 12 rounds (default) | `user_service.py:35-36` | LOW |
| **JWT signing** | ✅ HS256 | `user_service.py:29,54` | LOW (symmetric — fine for single-service) |
| **SECRET_KEY from env** | ⚠️ Fallback to dev value | `user_service.py:26-28` | **HIGH** — if `SECRET_KEY` env not set, anyone can forge valid JWTs using the known default string |
| **Token expiry** | ✅ 60 min access, 30 day refresh | `user_service.py:30-31` | LOW |
| **Refresh token flow** | ❌ Issued but never consumed | `user_service.py:58-63`, no `/auth/refresh` endpoint | **MEDIUM** — dead token; users must re-login after 60 min; refresh token is dead weight in every `AuthRes` |
| **Password policy** | ⚠️ Min 8 chars only | `schemas/__init__.py:15` | MEDIUM — no complexity, no breach-list check, no rotation |
| **Account lockout** | ❌ None | — | MEDIUM — brute-force possible (mitigated partially by rate limiter) |
| **Email verification** | ❌ `is_verified` defaults False, never set True | `Models.py:37`, never mutated | MEDIUM — field exists in schema but is always `false` |
| **Password reset** | ❌ Not implemented | — | HIGH — no recovery path if password is forgotten |

### 20.2 Authorization (RBAC)

| Control | Status | File:line | Risk |
|---|---|---|---|
| **Role-based guard** | ✅ `require_roles()` | `deps.py:69-93` | LOW |
| **Admin-only endpoints** | ✅ `admin_only` on `/dashboard/analytics` | `dashboard.py:70-76` | LOW |
| **Staff-only endpoints** | ✅ `staff_only` on `/dashboard/users` | `dashboard.py:61-67` | LOW |
| **User isolation** | ✅ All queries filter `user_id` | All services | LOW |
| **Self-escalation** | ❌ No guard preventing role assignment via API | `user_service.py:149` (settings keys whitelist) | LOW — roles assigned only server-side at registration |

### 20.3 Secrets management

| Finding | Severity | Location |
|---|---|---|
| SECRET_KEY fallback is a known string | **HIGH** | `user_service.py:27-28` |
| DB password `change_me` in docker-compose.yml | **MEDIUM** | `docker-compose.yml:11` |
| SECRET_KEY placeholder in docker-compose.yml | **MEDIUM** | `docker-compose.yml:34` |
| `.env` excluded from git (`.gitignore` includes `backend/.env`) | ✅ OK | `.gitignore` |
| `.env` excluded from Docker image (`.dockerignore` includes `backend/.env`) | ✅ OK | `.dockerignore` |
| `.env.example` has placeholder values | ✅ OK (documented) | `backend/.env.example` |
| Demo credentials `demo@cerebro.com / password123` hardcoded | **MEDIUM** | `bootstrap.py:27-28` |
| `DEBUG: True` in docker-compose.yml | **LOW** (dev only) | `docker-compose.yml:39` |

### 20.4 CORS configuration

```python
# main.py:46-57
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,...")
allow_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],  # ← DANGER: empty env → wildcard
    allow_credentials=True,                 # ← with wildcard = violates CORS spec
    allow_methods=["*"],
    allow_headers=["*"],
)
```

| Finding | Severity |
|---|---|
| Empty `CORS_ORIGINS` → `["*"]` + `credentials=True` | **HIGH** — browsers block this combo, but it signals misconfiguration; if origins are explicitly set to include attacker-controlled domains, credential theft is possible |
| `allow_methods=["*"]` + `allow_headers=["*"]` | LOW — overly permissive but functional |
| No `expose_headers` or `max_age` set | LOW — minor |

### 20.5 Rate limiting

**Implementation:** In-memory sliding window (`gateway/rate_limit.py`)
- Global: 300 requests/minute per IP
- Auth endpoints (`/register`, `/login`): 60 requests/minute per IP

| Finding | Severity |
|---|---|
| In-memory — resets on server restart | MEDIUM |
| Per-IP only — behind reverse proxy, all users share the same IP | **HIGH** in production |
| Not distributed — multiple uvicorn workers each have their own limiter | MEDIUM |
| No per-user authenticated rate limiting | LOW |
| No CAPTCHA or progressive delay | LOW |

### 20.6 API validation

| Control | Status | Risk |
|---|---|---|
| Pydantic v2 request schemas | ✅ All endpoints | LOW |
| `field_validator` on feedback message (non-blank) | ✅ `schemas/__init__.py:339-345` | LOW |
| `pattern` regex on format/category fields | ✅ dashboard reports, feedback | LOW |
| `ge`/`le`/`gt`/`min_length`/`max_length` on numeric/string fields | ✅ Throughout schemas | LOW |
| SQL injection | ✅ SQLAlchemy ORM parameterized queries | LOW |
| `datetime.fromisoformat()` in sync.py — no injection vector | ✅ | LOW |
| **No request body size limit** at middleware level | ⚠️ | LOW (FastAPI default ~1MB) |
| **No auth on `/health`** | ✅ Intentional (diagnostic) | NONE |

### 20.7 Sensitive data exposure

| Finding | Severity | Location |
|---|---|---|
| Push tokens returned in full in `GET /tokens` | LOW | `notification_service.py:64-71` |
| Full user list returned to staff (`/dashboard/users`) including `is_verified` | LOW | `admin_service.py` |
| JWT access token in localStorage (XSS risk in SPA) | **MEDIUM** | `web/src/utils/api.js:24` |
| JWT in AsyncStorage (mobile) | LOW — Expo Go only | `mobile/src/hooks/useAuth.jsx` |
| Error envelope exposes `error_code` + `status_code` | LOW | `main.py:84-90` |
| `system_uptime_percentage` is hard-coded 99.9 | LOW (cosmetic) | `admin_service.py:86` |

### 20.8 Infrastructure security

| Finding | Severity |
|---|---|
| No HTTPS/TLS termination in code | **HIGH** for production (ok for local dev) |
| No security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | **MEDIUM** |
| No CORS `expose_headers` for auth headers | LOW |
| No CSRF protection (SPA + localStorage pattern) | LOW (stateless JWT mitigates) |
| No audit logging for security events (failed logins, role changes) | **MEDIUM** |
| No encryption at rest (NF-SEC-007 gap — no pgcrypto) | MEDIUM |
| `alembic_version` table not migrated from base schema (managed by alembic) | NONE |

### 20.9 Security summary

| Category | Score | Critical findings |
|---|---|---|
| Authentication | ⚠️ 6/10 | SECRET_KEY fallback, no refresh flow, no password reset, no account lockout |
| Authorization | ✅ 8/10 | RBAC functional, user isolation correct |
| Secrets | ⚠️ 6/10 | Hardcoded dev defaults, demo credentials, DEBUG=True |
| CORS | ⚠️ 6/10 | Wildcard fallback risk, overly permissive methods/headers |
| Rate limiting | ⚠️ 5/10 | In-memory, not distributed, per-IP only |
| Validation | ✅ 8/10 | Pydantic comprehensive, no injection vectors |
| Data protection | ⚠️ 5/10 | No HTTPS, no encryption at rest, no audit logging, localStorage JWT |
| **Overall** | **⚠️ ~6.5/10** | Functional for demo/portfolio; not production-ready |

---

## Q21. Containerized and deployable?

### 21.1 Docker Compose (`docker-compose.yml`)

```yaml
services:
  db:
    image: postgres:15-alpine
    volumes: [pg_data]
    healthcheck: pg_isready
    ports: 5432:5432

  api:
    build: { context: ., dockerfile: backend/Dockerfile }
    depends_on: db (service_healthy)
    environment: DATABASE_URL, SECRET_KEY, CORS_ORIGINS, DEBUG, etc.
    ports: 8000:8000
    healthcheck: python urllib GET /health

  # web: commented out (no Dockerfile for web)
  # mobile: commented out (Expo, not containerized)
```

### 21.2 Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim
COPY backend/requirements-runtime.txt → pip install
COPY backend/app /app/app
COPY backend/ml_models /app/ml_models
COPY migrations /app/migrations
COPY alembic.ini /app/alembic.ini
COPY backend/docker-entrypoint.sh → chmod +x
EXPOSE 8000
CMD ["sh", "/app/docker-entrypoint.sh"]
```

**`requirements-runtime.txt`** (20 lines): deliberately excludes `torch`, `scikit-learn`, `xgboost`, `pandas`, `numpy`, `aioredis`. ML inference falls back to rule-based path. Image stays lean.

### 21.3 Entrypoint (`docker-entrypoint.sh`)

```sh
#!/bin/sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 21.4 What works

| Component | Status | Notes |
|---|---|---|
| `docker compose up -d db` | ✅ | Postgres 15 starts, health check passes |
| `docker compose up -d api` | ✅ | Builds image, runs migrations, starts uvicorn |
| API health check | ✅ | `GET /health` → 200 |
| Register → Login → Challenge → Dismiss → Habit Score E2E | ✅ | Verified manually in CONTEXT.md |
| PDF export (`application/pdf` content-type) | ✅ | reportlab |
| Excel export (`PK` content-type) | ✅ | openpyxl |
| `.dockerignore` excludes `.env`, `.env.local`, `node_modules`, `presentation/` | ✅ | |

### 21.5 What's missing or broken

| Finding | Severity |
|---|---|
| **No web Dockerfile** — web runs only via `npm run dev` locally | MEDIUM |
| **No nginx reverse proxy** for production | HIGH |
| **No SSL/TLS termination** | HIGH for production |
| **No multi-stage build** — dev dependencies would bloat production image (not currently an issue since web isn't containerized) | LOW |
| **docker-compose secrets** are hardcoded `change_me` placeholders | MEDIUM |
| **No volume for SQLite** (dev fallback) — data lost on container restart | LOW (SQLite is dev-only) |
| **Web/mobile are manually started** (`run_all.bat` or individually) | LOW (portfolio project) |

### 21.6 How to run the full stack locally

```powershell
# Option A: one-shot launcher (all 4 services)
.\run_all.bat          # DB (docker) → backend → web → mobile (Metro foreground)

# Option B: manual
docker compose up -d db                    # Postgres on :5432
cd backend && .venv\Scripts\activate       # or use dev.ps1 for pinned venv
alembic upgrade head
uvicorn app.main:app --port 8000           # API on :8000
cd ../web && npm run dev                   # Vite on :5173 (proxies /api → :8000)
cd ../mobile && npx expo start             # Metro on :8081

# Option C: zero-Docker local mode (SQLite auto-seeds)
cd backend && uvicorn app.main:app         # No DB needed; bootstrap.py creates tables + demo user
```

---

## Q22. Deployment status

### 22.1 CI/CD (GitHub Actions)

**File:** `.github/workflows/ci.yml`

| Job | Steps | Trigger |
|---|---|---|
| `backend` | checkout → python 3.11 → pip install → `ruff check` → `pytest -q` → `smoke_m1.py` → `smoke_m2.py` | push/PR to `main` |
| `web` | checkout → node 20 → `npm ci` → `vitest run` → `vite build` | push/PR to `main` |
| `mobile` | checkout → node 20 → `npm ci` → `jest --ci` | push/PR to `main` |

**What's missing from CI:**
- Smoke scripts need a running HTTP server (they use `httpx` against `localhost:8000`); CI doesn't start uvicorn → smoke steps would fail unless the runner has a pre-started server (context.md says they pass, but the YAML doesn't start uvicorn — this is a gap in the CI definition)
- No Docker build + compose up-test in CI
- No coverage upload (Codecov, Coveralls)
- No deployment step (no `deploy` job, no artifact upload)
- No environment-specific configuration (staging/production)
- No secret scanning or SAST

### 22.2 Cloud deployment

| Question | Answer | Evidence |
|---|---|---|
| Is there a deployed instance? | **NO** | PRD.md: "cloud deployment pending"; README: "No real cloud deployment yet — Docker compose works locally" |
| AWS/Azure/GCP config? | **NONE** | No Terraform, CloudFormation, ARM templates, serverless.yml, Procfile, render.yaml, or fly.toml found |
| Is there a live URL? | **NO** | No domain, no load balancer, no SSL cert configured |
| Monitoring/APM? | **NONE** | No Sentry, Datadog, New Relic, Prometheus, or CloudWatch configured |
| Logging aggregation? | **NONE** | Python `logging` to stdout only (via `gateway/logging.py`); no log sink |
| Backup strategy? | **NONE** | Postgres has a named volume (`pg_data`) but no backup cron, no pg_dump script |
| Database migrations in production? | **MANUAL** | `docker-entrypoint.sh` runs `alembic upgrade head` on container start |

### 22.3 GitHub repository

| Property | Value |
|---|---|
| Remote | `origin` → `https://github.com/PawanSimha/CerebroKognit-InfosysInternship-B3.git` |
| Branch | `main` |
| HEAD commit | `24bd45a` (2026-09-13, web: analytics page heading renamed) |
| Uncommitted working tree | 12 modified files + 1 untracked (`web/src/utils/api.js`) |

**Critical working-tree note:** `web/src/utils/api.js` is **untracked and not in git**. Eight web pages (Admin, AlarmManagement, ChallengeGenerator, Dashboard, Home, Profile, Reports, Settings) import `apiFetch` from `../utils/api` in the working tree — but the committed HEAD versions of these pages do **not** import this file. This means there is ~1957 lines of uncommitted web refactoring in progress. A fresh clone of the repo would build successfully (the committed pages don't depend on the untracked file), but the working tree would not.

---

## Q23. Complete API endpoint inventory

All routes prefixed with `/api/v1` (defined in `main.py:66-75`). Request/response schemas from `schemas/__init__.py` unless noted.

### 23.1 Authentication (`/api/v1/auth`)

| Method | Path | Auth | Role | Request | Response | DB ops |
|---|---|---|---|---|---|---|
| POST | `/register` | None | — | `AuthRegisterReq` {email, password(min 8), full_name?, timezone} | `AuthRes` {access_token, refresh_token, token_type, expires_in, user: UserProfileRes} | INSERT User, INSERT UserRole("User") |
| POST | `/login` | None | — | `AuthLoginReq` {email, password} | `AuthRes` (same) | SELECT User |
| GET | `/me` | Bearer | any | — | `UserProfileRes` {id, email, full_name?, timezone, is_active, is_verified, created_at} | SELECT User |

**Status codes:** 200 (success), 400 (duplicate email), 401 (bad credentials), 422 (validation error)

### 23.2 Users (`/api/v1/users`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| GET | `/profile` | Bearer | — | `UserProfileRes` | SELECT User |
| PUT | `/profile` | Bearer | `UserProfileUpdateReq` {full_name?, timezone?, difficulty_preference?} | `UserProfileRes` | UPDATE User |
| GET | `/settings` | Bearer | — | `Dict[str, object]` {notifications, auto_dismiss, vibrate, time_format} | SELECT User |
| PUT | `/{key}` | Bearer | `SettingsUpdateReq` {notifications?, auto_dismiss?, vibrate?, time_format?} | `Dict[str, object]` | UPDATE User.settings JSON |

**Status codes:** 200, 400 (unknown setting key / invalid value), 404 (user not found), 422

### 23.3 Alarms (`/api/v1/alarms`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| GET | `` | Bearer | — | `List[AlarmRes]` | SELECT Alarms WHERE user_id |
| POST | `` | Bearer | `AlarmCreateReq` {title, type, time?, recurrence?, challenge_type?, difficulty?, question_count?, next_trigger?} | `AlarmRes` {id, user_id, title, alarm_type, next_trigger, is_enabled, challenge_id, challenge_type, difficulty, recurrence, time, times_snoozed, created_at} | INSERT Alarm, INSERT ChallengeAttempt (pending) |
| PUT | `/{alarm_id}` | Bearer | `AlarmCreateReq` | `AlarmRes` | UPDATE Alarm |
| DELETE | `/{alarm_id}` | Bearer | — | `{"deleted": true}` | DELETE Alarm |
| POST | `/{alarm_id}/snooze` | Bearer | — | `AlarmRes` | UPDATE Alarm (times_snoozed++, next_trigger += 5min) |
| POST | `/{alarm_id}/dismiss` | Bearer | `AlarmDismissReq` {challenge_attempt_id, correct_answers, total_questions, time_taken_seconds} | `DismissRes` {alarm_id, successfully_dismissed, new_habit_score_update, next_trigger?} | UPDATE Alarm (is_enabled=false), INSERT/UPDATE HabitScore, recomputing next_trigger if recurring |

**Status codes:** 200, 400 (already dismissed / max snooze / incomplete attempt), 404 (alarm/attempt not found)

### 23.4 Challenges (`/api/v1/challenges`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| GET | `` | Bearer | Query: difficulty?, challenge_type? | `List[ChallengeListRes]` {id, title, challenge_type, difficulty, is_active} | SELECT Challenges WHERE is_active |
| GET | `/next` | Bearer | Query: challenge_type?, difficulty?, question_count? | `ChallengeRes` {id, title, description, challenge_type, difficulty, generated_at, challenge_attempt_id, puzzle_payload} | SELECT Challenge, INSERT ChallengeAttempt (pending with expected_answers) |
| POST | `/submit` | Bearer | `ChallengeSubmitReq` {challenge_id, challenge_attempt_id, user_answer?, user_answers?, time_taken_seconds} | `ChallengeSubmitRes` {challenge_id, challenge_attempt_id, correct, completed, correct_answers, total_questions} | SELECT ChallengeAttempt, UPDATE (correct_answers, completed, end_time, user_answers) |

**Note:** `puzzle_payload` contains prompts/options/timeout but **never** answers. Answer verification is server-authoritative.

### 23.5 Habits (`/api/v1/habits`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| GET | `/score` | Bearer | Query: date? | `Dict` {date, wake_up_consistency, challenge_completion, snooze_reduction, sleep_schedule_adherence, overall_score} | SELECT/INSERT HabitScore |
| GET | `/score/history` | Bearer | Query: days (default 7) | `List[Dict]` (same shape, one per day, `None` on missing days) | SELECT HabitScores WHERE date >= today-N |

### 23.6 Analytics (`/api/v1/analytics`)

| Method | Path | Auth | Response | DB ops |
|---|---|---|---|---|
| GET | `/me` | Bearer | `Dict` {total_alarms, total_dismissals, average_snooze_count, wake_up_consistency_trend, challenge_accuracy, sleep_duration_avg, recent_activity} | SELECT Alarms, ChallengeAttempts (aggregated) |
| GET | `/recommendations` | Bearer | `List[RecommendationRes]` {id, category, priority, title, message, suggested_action?, metrics} | SELECT Alarms, ChallengeAttempts, HabitScores (threshold-based rules) |
| GET | `/ml-status` | Bearer | `Dict` {model_loaded: bool, ...} | In-memory model state check |

### 23.7 Dashboard (`/api/v1/dashboard`)

| Method | Path | Auth | Role | Request | Response | DB ops |
|---|---|---|---|---|---|---|
| GET | `/users` | Bearer | Administrator / Wellness Coach | — | `List[AdminUserRes]` {id, email, is_active, is_verified, created_at, last_login?, role} | SELECT Users + Roles |
| GET | `/analytics` | Bearer | Administrator | — | `AdminAnalyticsRes` {total_users, active_users_today, new_users_this_week, alarm_dismissal_success_rate, platform_habit_score_avg, top_challenge_types, system_uptime_percentage} | SELECT Users, Alarms, HabitScores, ChallengeAttempts (aggregated) |
| GET | `/reports/habits` | Bearer | any | Query: days, format (csv/json/pdf/excel), async? | StreamingResponse (file) or `{job_id, status, endpoint}` | SELECT HabitScores |
| GET | `/reports/wake-up` | Bearer | any | Query: days, format, async? | StreamingResponse or job status | SELECT Alarms |
| GET | `/reports/challenges` | Bearer | any | Query: days, format, async? | StreamingResponse or job status | SELECT ChallengeAttempts |
| GET | `/reports/status/{job_id}` | Bearer | any | — | `{status: "queued"\|"running"\|"completed"\|"failed", result?}` | In-memory job store |

### 23.8 Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| POST | `/register` | Bearer | `PushRegisterReq` {token(min 1, max 512), platform (android/ios/web)} | `{id, token, platform, registered: true}` | INSERT/UPDATE PushToken |
| DELETE | `/register` | Bearer | `PushRegisterReq` | `{token, deregistered: bool}` | DELETE PushToken |
| GET | `/tokens` | Bearer | — | `List[{id, token, platform, created_at}]` | SELECT PushTokens |

### 23.9 Sync (`/api/v1/sync`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| POST | `/pending` | Bearer | `SyncPendingReq` {records: [{table_name, record_id, operation, payload, local_timestamp}]} | `SyncRes` {synced_count, failed_count, failed_record_ids} | UPSERT Alarms/ChallengeAttempts/HabitScores (idempotent, timestamp-based conflict resolution) |
| GET | `/pull` | Bearer | Query: since? (ISO 8601) | `{alarms: [...], challenge_attempts: [...], habit_scores: [...], server_timestamp}` | SELECT Alarms/ChallengeAttempts/HabitScores WHERE updated_at >= since |

### 23.10 Feedback (`/api/v1/feedback`)

| Method | Path | Auth | Request | Response | DB ops |
|---|---|---|---|---|---|
| POST | `` | Bearer | `FeedbackSubmitReq` {category (suggestion/bug_report/compliment/other), rating? (1-5), message (1-2000 chars), contact_email?} | `FeedbackRes` {id, user_id, category, rating?, message, contact_email?, status, created_at} | INSERT Feedback |

### 23.11 Utility

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/` | None | `{message: "Intelligent Cognitive Alarm Platform API is running"}` |
| GET | `/health` | None | `{status: "healthy"}` |

### 23.12 Endpoint summary

| Category | Count | Notes |
|---|---|---|
| Auth | 3 | register, login, me |
| Users | 4 | profile CRUD, settings CRUD |
| Alarms | 6 | CRUD + snooze + dismiss |
| Challenges | 3 | list, next (adaptive), submit |
| Habits | 2 | score, history |
| Analytics | 3 | summary, recommendations, ml-status |
| Dashboard | 6 | users, analytics, 3 reports, job status |
| Notifications | 3 | register, deregister, tokens |
| Sync | 2 | push pending, pull |
| Feedback | 1 | submit |
| Utility | 2 | root, health |
| **TOTAL** | **35** | |

**Duplicate routes:** None (all paths are unique within their router prefix).
**Undocumented routes:** The `schemas/all.py` contains schemas that duplicate `schemas/__init__.py` but are never imported by any router (dead code).

---

## Q24. Broken, mocked, unused, or partially implemented features

### 24.1 Confirmed broken / dead code

| Finding | Location | Impact |
|---|---|---|
| **`web/src/utils/api.js` is untracked** (not in git) — 8 web pages import `apiFetch` from it in the working tree | `git status`: `?? web/src/utils/api.js` | If the uncommitted web changes are committed without this file, the web build breaks. Currently the committed pages don't import it. |
| **`schemas/all.py` is dead code** — zero imports anywhere in the codebase | `backend/app/schemas/all.py` | None (dead weight, should be deleted) |
| **`core/config.py` doesn't exist** — referenced in earlier context but was refactored out | N/A | None (config is inline in each service) |
| **Refresh token issued but never consumed** — no `/auth/refresh` endpoint | `user_service.py:58-63`, `schemas/__init__.py:42` | Users must re-login after 60 min; refresh token is dead weight in every AuthRes |
| **`is_verified` always False** — never set to True anywhere | `Models.py:37`, no mutation in any service | Dead field; email verification never implemented |
| **Push notification delivery = NoopProvider** | `integrations/messaging.py:20-27` | `NotificationService.send()` raises `NotImplementedError`; no notification can be delivered |
| **`system_uptime_percentage` = 99.9 hardcoded** | `admin_service.py:86` | Misleading metric in Admin dashboard |

### 24.2 Partially implemented

| Feature | What exists | What's missing |
|---|---|---|
| **Push notifications** | Token registration API ✅, mobile Expo token capture on login ✅ | Delivery provider (FCM/APNs), local notification scheduling, alarm-trigger push, bedtime/wake reminders |
| **Email verification** | `is_verified` column in User model ✅ | No verification flow, no email sending, no token generation |
| **Password reset** | Nothing | No endpoint, no email, no token |
| **Coach dashboard** | RBAC role exists ✅, `staff_only` guard works ✅ | No cohort filtering UI, no per-user drill-down, no coach-specific analytics |
| **Wellness goals/preferences** | `difficulty_preference` stored ✅ | No sleep goal, wake-up goal, bedtime goal fields in User model |
| **Alarm history timeline** | `GET /alarms` lists current alarms ✅ | No historical/archived alarm view, no timeline page |
| **Productivity tracking** | Nothing | No productivity model, no correlation analytics |

### 24.3 Unused dependencies

| Package | Installed | Imported | Notes |
|---|---|---|---|
| `scikit-learn` | `requirements.txt` | Never in `app/` | Dead dependency |
| `xgboost` | `requirements.txt` | Never in `app/` | Dead dependency |
| `pandas` | `requirements.txt` | Never in `app/` | Dead dependency |
| `numpy` | `requirements.txt` | Never in `app/` | Dead dependency (implicit via torch) |
| `aioredis` | `requirements.txt` | Referenced in `cache.py` but not in `requirements.txt` | Optional; `cache.py` imports conditionally |
| `react-query` | `web/package.json` | Not used in any component | Dead dev dependency |
| `tailwindcss` | `web/package.json` | Installed but all CSS is custom | Dead dev dependency |
| `typescript` | `web/package.json` + `mobile/package.json` | No `.ts`/`.tsx` files in the project | Dead dev dependency |

### 24.4 TODOs and placeholders

| Location | Content |
|---|---|
| `integrations/messaging.py:26-27` | `raise NotImplementedError("FCM/APNs provider is planned...")` |
| `admin_service.py:86` | `system_uptime_percentage=99.9` (hardcoded placeholder) |
| `ai_engine/anomaly.py`, `ai_engine/performance_prediction.py` | Empty stubs (documented as planned) |
| `bootstrap.py:84` | `AUTO_INIT=0` env var disables auto-seed (documented) |
| `docker-compose.yml:50-80` | Web/mobile services commented out |
| `requirements-runtime.txt:1-4` | Comment: "Deliberately excludes the ML/data stack" |

### 24.5 Schema duplication

`AuthRegisterReq`, `AuthLoginReq`, `AuthRes`, `UserProfileRes` are defined in **both**:
- `backend/app/schemas/auth.py` (used by `api/auth.py` and `services/user_service.py`)
- `backend/app/schemas/__init__.py` (used by `api/users.py` and everywhere else)

Both define the same fields but `schemas/auth.py` uses `EmailStr` (email-validator) while `schemas/__init__.py` uses plain `str`. This creates a subtle inconsistency: registration validates email format; other endpoints that accept email-like strings don't.

---

## Q25. Completion estimate and remaining work

### 25.1 Module-by-module status

| # | Specification module | Status | Completion | Evidence |
|---|---|---|---|---|
| 1 | Authentication & Authorization | ✅ Functional | 90% | Register, login, JWT, RBAC all working; missing: refresh flow, email verification, password reset |
| 2 | User Profile & Settings | ✅ Functional | 85% | Profile CRUD, settings persistence, timezone, difficulty pref; missing: sleep/wake goals |
| 3 | Alarm Scheduling | ✅ Functional | 90% | CRUD, snooze, dismiss, recurring, timezone-aware; missing: on-device local scheduling |
| 4 | Cognitive Challenge Engine | ✅ Functional | 95% | 7 types, 5 difficulties, server-authoritative submit, no-answer-leak next, multi-step; missing: question bank variety |
| 5 | Adaptive Difficulty (ML) | ✅ Functional | 80% | PyTorch model trained, rule-based fallback, ml-status endpoint; missing: online learning, model retraining pipeline |
| 6 | Habit Scoring | ✅ Functional | 95% | 35/25/20/20 weighted composite, streak, history, real data |
| 7 | Behavioral Analytics | ✅ Functional | 85% | Sleep estimate, wake trend, per-type breakdown, recommendations; missing: productivity correlation |
| 8 | Recommendations | ✅ Functional | 85% | 4-category rule-based engine; missing: ML-powered recommendations |
| 9 | Web Dashboard | ✅ Functional | 92% | Admin, analytics, charts, reports, sidebar, theme; missing: coach dashboard, alarm history page |
| 10 | Mobile App | ⚠️ Mostly functional | 85% | Tabs, auth, challenges, offline sync, push token; missing: push delivery, local alarm scheduling |
| 11 | Offline Sync | ⚠️ Partially implemented | 70% | Server endpoints work, mobile offline store works; missing: conflict UI, sync indicator, background sync |
| 12 | Notifications & Reminders | ❌ Registry only | 25% | Token registration works; delivery is NoopProvider; no local scheduling |
| 13 | Reports & Export | ✅ Functional | 90% | CSV/PDF/Excel/JSON via 3 report endpoints; async jobs; missing: report history, scheduled reports |
| 14 | Testing | ⚠️ Partial | 65% | 143 unit tests across 3 layers; missing: E2E, ML tests, coverage, integration tests |
| 15 | Security | ⚠️ Adequate for demo | 60% | JWT, bcrypt, RBAC, Pydantic, rate limiting; missing: HTTPS, encryption at rest, audit logging, refresh flow |
| 16 | Deployment & DevOps | ⚠️ Local only | 50% | Docker Compose works locally, CI runs tests; missing: cloud deployment, monitoring, backups, SSL |
| 17 | Documentation | ✅ Comprehensive | 85% | SRS, PRD, README, context, CHANGELOG, style guide; missing: API auto-generated docs (Swagger works but no dedicated API doc) |

### 25.2 Overall completion estimate

**Weighted average: ~82%**

| Weight | Module group | Avg completion | Contribution |
|---|---|---|---|
| 30% | Core backend (auth, alarms, challenges, scoring, analytics) | 90% | 27.0% |
| 20% | Frontend (web dashboard + mobile app) | 88% | 17.6% |
| 15% | Infrastructure (Docker, CI, deployment) | 55% | 8.3% |
| 15% | Testing (unit, integration, E2E) | 65% | 9.8% |
| 10% | Security | 60% | 6.0% |
| 10% | Notifications + offline sync | 48% | 4.8% |
| **100%** | | | **~83%** |

### 25.3 Critical blockers (must-fix before submission)

| Priority | Blocker | Effort | Impact |
|---|---|---|---|
| P0 | Commit `web/src/utils/api.js` and the 12 modified web files — working tree divergence from git HEAD | 15 min | If uncommitted changes are lost, web pages break on fresh clone (if they now depend on api.js) |
| P0 | Fix CI smoke scripts: they need a running server but CI doesn't start uvicorn | 1 hour | CI smoke steps fail silently or produce misleading results |
| P1 | Replace SECRET_KEY fallback with startup failure (refuse to start without env var in production) | 30 min | Security: anyone can forge JWTs |
| P1 | Fix CORS wildcard fallback (`["*"]` + `credentials=True`) — either reject empty CORS_ORIGINS or don't fallback to wildcard | 30 min | Security: CORS bypass |
| P1 | Run full gate suite and record actual results (pytest, vitest, jest, smoke) | 30 min | Verification: claimed pass counts may be stale |

### 25.4 Remaining development tasks

| Priority | Task | Effort | Modules |
|---|---|---|---|
| P1 | Push notification delivery (FCM for Android, Expo push for iOS) | 2-3 days | Notifications, Mobile |
| P1 | On-device local alarm scheduling (AlarmManager Android, Expo Notifications) | 2 days | Mobile, Alarms |
| P1 | Password reset flow (email token) | 1 day | Auth |
| P2 | Coach dashboard (cohort filtering, per-user analytics) | 2 days | Web, Dashboard |
| P2 | Cloud deployment (Render/Fly.io/AWS ECS) | 2-3 days | DevOps |
| P2 | SSL/HTTPS + security headers middleware | 1 day | Security, Gateway |
| P2 | Coverage tooling (pytest-cov, vitest coverage, jest --coverage) | 0.5 day | Testing |
| P3 | E2E test suite (Playwright or Cypress) | 3-5 days | Testing |
| P3 | Audit logging (failed logins, role changes) | 1 day | Security |
| P3 | Email verification flow | 1 day | Auth |
| P3 | Refresh token endpoint (`POST /auth/refresh`) | 0.5 day | Auth |
| P4 | ML unit tests (model inference, feature normalization) | 1 day | Testing, ML |
| P4 | Prompt variety (randomized challenge templates per type) | 1 day | Challenges |
| P4 | Alarm history timeline page | 1 day | Web |
| P4 | Cleanup dead code (`schemas/all.py`, unused deps) | 0.5 day | Code quality |

### 25.5 Recommended finishing sequence

```
Week 1 (validation):
  1. Commit all uncommitted working tree changes (P0)
  2. Fix CI smoke script server dependency (P0)
  3. Run full gate suite, record actual results (P1)
  4. Fix SECRET_KEY fallback + CORS wildcard (P1)
  5. Add pytest-cov + vitest coverage (P2)

Week 2 (polish):
  6. Password reset flow (P1)
  7. Push notification delivery — FCM (P1)
  8. On-device alarm scheduling (P1)
  9. SSL/HTTPS + security headers (P2)

Week 3 (deployment):
  10. Cloud deployment (P2)
  11. Coach dashboard (P2)
  12. Audit logging (P2)

Week 4 (hardening — optional):
  13. E2E tests (P3)
  14. ML unit tests (P4)
  15. Dead code cleanup (P4)
  16. Refresh token endpoint (P3)
```

### 25.6 Final assessment

The CerebroKognit platform is **functionally complete for a portfolio/demo submission** at ~83% completion. The core alarm→challenge→dismiss→score loop works end-to-end across backend, web, and mobile. What remains is primarily **production hardening** (security fixes, cloud deployment, monitoring) and **feature completeness** (push delivery, coach dashboard, password reset). For an academic internship deliverable (Infosys B3), the current state — with working E2E flows, comprehensive documentation, and automated testing — is **sufficient for presentation**. For production deployment, the P0/P1 blockers identified above must be addressed first.

---

*Backlog carry-over from prior Q&A files: FCM/APNs delivery, on-device local alarm scheduling, coach dashboard, productivity module, email verification, password reset, refresh token flow.*
