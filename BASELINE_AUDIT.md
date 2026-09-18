# BASELINE_AUDIT.md

**Project:** CerebroKognit - Intelligent Cognitive Alarm Platform
**Audit type:** Read-only repository baseline
**Date:** 2026-09-16
**Auditor:** opencode (automated baseline pass)
**HEAD:** `24bd45a9ee80027da373b0845f7e5d9b11a5b5ad` (2026-09-13 23:21:35 +0530) - "web: analytics page heading renamed Dashboard to Analytics"

> No application code, config, or tracked file was modified, deleted, or renamed during this audit. The only file created is this report.

---

## 1. Repository Structure

```
CerebroKognit/
|-- .git/
|-- .github/
|   `-- workflows/ci.yml              # GitHub Actions: backend + web + mobile jobs
|-- .ruff_cache/                      # tool cache (ignored)
|-- assets/                           # favicons, floating, logos (image assets)
|-- backend/                          # FastAPI application (Python)
|   |-- .venv/                        # local virtualenv (Python 3.14.7)
|   |-- .env                          # local secrets (gitignored)
|   |-- .env.example                  # tracked template
|   |-- app/
|   |   |-- api/                      # routers: auth, alarms, challenges, habits, sync,
|   |   |                             #          dashboard, analytics, users, notifications, feedback, deps
|   |   |-- ai_engine/                # interfaces, difficulty, recommendation, behavior,
|   |   |                             #          challenge_generation, anomaly, performance_prediction
|   |   |-- gateway/                  # logging, middleware, rate_limit
|   |   |-- integrations/             # messaging (push provider protocol + Noop)
|   |   |-- schemas/                  # Pydantic v2 (auth.py, all.py [dead])
|   |   |-- services/                 # 18 domain services + facade shims
|   |   |-- workers/                  # job_queue interface
|   |   |-- database.py
|   |   |-- main.py                   # FastAPI app entry (lifespan -> bootstrap_local_db)
|   |   `-- Models.py                 # SQLAlchemy 2.0 models
|   |-- ml_models/difficulty_model.pt # trained PyTorch difficulty model
|   |-- scripts/                      # init_db.py, smoke_m1.py, smoke_m2.py, train_difficulty_model.py
|   |-- tests/                        # conftest + 6 test modules
|   |-- cerebrokognit.db              # local SQLite dev DB (gitignored)
|   |-- Dockerfile                    # python:3.11-slim runtime
|   |-- docker-entrypoint.sh          # alembic upgrade head -> uvicorn
|   |-- pyproject.toml                # ruff config
|   |-- pytest.ini
|   |-- requirements.txt              # full dev deps (incl. torch, sklearn, xgboost, pandas)
|   `-- requirements-runtime.txt      # lean Docker deps (ML stack excluded)
|-- migrations/                       # Alembic (repo root, not under backend/)
|   |-- env.py
|   |-- script.py.mako
|   `-- versions/
|       |-- 732e5cb49bcf_initial_schema.py
|       |-- 1c584bd4a5b0_add_challenge_attempt_answer_data.py
|       |-- 992b0ec03dba_add_push_tokens.py
|       `-- b3f2a1c9d807_add_feedback.py        # current head
|-- mobile/                           # Expo / React Native app
|   |-- .env                          # EXPO_PUBLIC_API_URL= (empty = auto-derive LAN)
|   |-- App.js, index.js, app.json, jest.setup.js, tsconfig.json
|   `-- src/
|       |-- components/               # MainTabs, layout, ui primitives
|       |-- context/                  # AuthContext
|       |-- hooks/                    # useAuth, useChallenge, useHabitScore
|       |-- notifications/            # registerPush
|       |-- schemas/
|       |-- screens/                  # tabs (Home/Alarms/Insights/Profile) + Alarm/Challenge/Feedback/Login/Profile/Settings/About
|       |-- sync/                     # offlineStore, syncEngine, useSync, syncRequest
|       |-- theme/                    # tokens, fonts, ThemeContext
|       `-- utils/                    # api.js
|-- web/                              # React 18 + Vite 5 dashboard
|   |-- public/                       # login-bg.svg, favicon, floating, logos
|   |-- src/
|   |   |-- components/               # auth, landing, layout (Sidebar), ui
|   |   |-- pages/                    # Admin, AlarmManagement, Auth, ChallengeGenerator,
|   |   |                             #   Dashboard, Home, Landing, Profile, Reports, Settings
|   |   |-- test/setup.js
|   |   |-- utils/                    # api.js (UNTRACKED), chartUtils, timeFormat, timezones
|   |   |-- App.jsx, index.css, main.jsx, navSections.js, styles.jsx, theme.js
|   |   `-- *.test.jsx
|   |-- index.html, package.json, vite.config.js
|   `-- dist/                         # production build output (ignored)
|-- Q and A/                          # audit Q&A docs (UNTRACKED)
|-- alembic.ini                       # points script_location -> migrations, default Postgres URL
|-- context.md                        # system memory / state anchor
|-- dev.ps1                           # backend + web (+ optional mobile) launcher
|-- run_all.bat / run_all.ps1         # full-stack one-terminal launcher
|-- docker-compose.yml                # db (postgres:15) + api
|-- README.md, PRD.md, SRS.md, style.md
|-- .dockerignore, .gitignore, .gitattributes
`-- Project Details.pdf
```

**Layer identification (requested):**

| Layer | Location | Present |
|---|---|---|
| Backend | `backend/` | Yes (FastAPI) |
| Web frontend | `web/` | Yes (React + Vite) |
| Mobile application | `mobile/` | Yes (Expo / RN) |
| Database | `backend/cerebrokognit.db` (SQLite, dev); Postgres via `docker-compose.yml` | Yes |
| AI engine | `backend/app/ai_engine/` + `backend/ml_models/` | Yes |
| Integrations | `backend/app/integrations/` (messaging/push) | Yes (Noop provider) |
| Tests | `backend/tests/`, `web/src/**/*.test.*`, `mobile/src/**/*.test.*` | Yes |
| Docker | `docker-compose.yml`, `backend/Dockerfile` | Yes (no web/mobile Dockerfile) |
| CI/CD | `.github/workflows/ci.yml` | Yes |
| Documentation | `README.md`, `PRD.md`, `SRS.md`, `style.md`, `context.md`, `Q and A/` | Yes |

---

## 2. Git State

### `git status`
```
On branch main
Your branch is ahead of 'origin/main' by 1 commit.

Changes not staged for commit:
	modified:   web/src/components/ui/LiveChallengeSimulator.jsx
	modified:   web/src/components/ui/TimeInput.jsx
	modified:   web/src/index.css
	modified:   web/src/pages/Admin.jsx
	modified:   web/src/pages/AlarmManagement.jsx
	modified:   web/src/pages/ChallengeGenerator.jsx
	modified:   web/src/pages/Dashboard.jsx
	modified:   web/src/pages/Home.jsx
	modified:   web/src/pages/Profile.jsx
	modified:   web/src/pages/Reports.jsx
	modified:   web/src/pages/Settings.jsx

Untracked files:
	Q and A/
	web/src/utils/api.js
```

### `git branch -a`
```
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
```

### `git log -5 --oneline`
```
24bd45a web: analytics page heading renamed Dashboard to Analytics
4ecb4dc web: simulator chip colors theme-aware (mint dark / purple light), solid purple randomize button; revert collapsed sidebar redistribution
239c3b3 web: simulator header restructured to fixed rows - separate type/difficulty chips, top-right timer, full-width randomize, overflow-safe text
9bb34dd web: bento overview/analytics grid, practice simulator randomize, themed scrollbars
d8521df web: floating rounded sidebar + header panels, detached from page edges
```

- Remote: `https://github.com/PawanSimha/CerebroKognit-InfosysInternship-B3.git`
- Tracking: `main...origin/main [ahead 1]` (1 unpushed commit)
- Tracked files: **303**
- No `.env` files are tracked (only `backend/.env.example`). `.env` files are gitignored.

---

## 3. Environment Files

| File | Tracked | Purpose | Key values |
|---|---|---|---|
| `backend/.env` | No (gitignored) | Local backend config | `DATABASE_URL=sqlite:///./cerebrokognit.db`, `DEBUG=True`, `SECRET_KEY=change_this_...`, `CORS_ORIGINS=http://localhost:3000,...,http://localhost:5173`, `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` |
| `backend/.env.example` | Yes | Template | Same keys, `DATABASE_URL=` empty, includes Docker override note |
| `mobile/.env` | No (gitignored) | Mobile API base | `EXPO_PUBLIC_API_URL=` (empty = auto-derive from Expo bundle host LAN IP) |
| `docker-compose.yml` (env block) | Yes | Container env | `DATABASE_URL=postgresql://cerebro_user:change_me@db:5432/cerebro_kognit`, `SECRET_KEY=change_this_...`, `DEBUG=True`, `CORS_ORIGINS=http://localhost:5173,...` |
| `.github/workflows/ci.yml` (test env) | Yes | CI test env | `SECRET_KEY=ci_test_secret_key_that_is_long_enough`, `DATABASE_URL=sqlite://` |
| `alembic.ini` (line 89) | Yes | Migration default URL | `sqlalchemy.url = postgresql://cerebro_user:change_me@localhost:5432/cerebro_kognit` |

**Observations / drift:**
- `backend/.env` is byte-identical to `backend/.env.example` except it sets a concrete `DATABASE_URL` (SQLite) and reorders CORS origins / adds itself as key. It still contains placeholder secrets.
- `mobile/.env` exists but there is **no `mobile/.env.example`** (documentation gap).
- No root `.env` and no `web/.env`. The web app does not read env vars at runtime; Vite proxies `/api` to `http://localhost:8000` (hardcoded in `web/vite.config.js`).
- CI never starts a server, yet runs `smoke_m1.py` / `smoke_m2.py` (see §6 gap).

---

## 4. Commands Reference

### Backend (FastAPI)
| Action | Command |
|---|---|
| Start | `backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000` (run from `backend/`) |
| Convenience launcher | `.\dev.ps1` (backend + web) / `.\dev.ps1 -BackendOnly` / `run_all.bat` |
| Tests | `cd backend; .venv\Scripts\python.exe -m pytest tests/ -q` |
| Lint | `cd backend; .venv\Scripts\python.exe -m ruff check app tests scripts` |
| Smoke m1/m2 | `cd backend; .venv\Scripts\python.exe scripts\smoke_m1.py` / `scripts\smoke_m2.py` (needs live server on :8000) |
| DB init (SQLite) | `cd backend; .venv\Scripts\python.exe scripts\init_db.py [--reset]` |
| Migrations | `alembic upgrade head` (run from repo root; reads `DATABASE_URL` if set, else `alembic.ini` Postgres URL) |
| Train ML model | `cd backend; .venv\Scripts\python.exe scripts\train_difficulty_model.py` |

### Web (React + Vite)
| Action | Command |
|---|---|
| Start | `cd web; npm run dev` (port 5173) |
| Tests | `cd web; npm test` (Vitest run) |
| Build | `cd web; npm run build` |
| Preview build | `cd web; npm run preview` |
| Lint | **No script defined** (no ESLint config) |

### Mobile (Expo / RN)
| Action | Command |
|---|---|
| Start | `cd mobile; npm start` (`expo start`, port 8081) |
| Android / iOS / web | `npm run android` / `npm run ios` / `npm run web` |
| Tests | `cd mobile; npm test` (jest, `-- --ci` for CI) |
| Lint | **No script defined** (no ESLint config); `npx expo install --check` reports dep drift |

### Docker
| Action | Command |
|---|---|
| DB only | `docker compose up -d db` |
| Full backend stack | `docker compose up -d` (db + api) |
| Teardown | `docker compose down` |

### Full stack
| Action | Command |
|---|---|
| One terminal, all 4 | `run_all.bat` (or `.\run_all.ps1`) |
| No Docker | `.\run_all.ps1 -NoDb` (falls back to SQLite) |

---

## 5. Startup Verification Results

| App | Method | Result |
|---|---|---|
| Backend | uvicorn on :8011 (temp) and :8000 | **PASS** - `/health` -> `200 {"status":"healthy"}` |
| Web | `npm run dev` on :5173 | **PASS** - Vite ready in 459 ms, `GET /` -> `200` (len 1600) |
| Mobile | `npx expo start --port 8081` | **PASS** - Metro "Waiting on http://localhost:8081", `/status` -> `200` (`packager-status:running`) |
| Docker | `docker ps` | **BLOCKED** - Docker daemon not running (see Errors) |

### Test / lint / build results

| Suite | Command | Result |
|---|---|---|
| Backend unit | `pytest tests/ -q` | **47 passed** |
| Backend lint | `ruff check app tests scripts` | **All checks passed!** |
| Smoke m1 | `scripts/smoke_m1.py` | **ALL PASS** |
| Smoke m2 | `scripts/smoke_m2.py` | **ALL PASS** |
| Web unit | `npm test` | **49 passed** (11 files) |
| Web build | `npm run build` | **PASS** - 104 modules, CSS 117.03 kB, JS 498.63 kB |
| Mobile unit | `npm test -- --ci` | **47 passed** (10 suites) |
| Alembic heads | `alembic heads` | Single head `b3f2a1c9d807` |
| SQLite DB | inspect | 10 tables; users 3, alarms 2, challenges 35 |

**Backend test breakdown (47):** `test_notifications.py` 9, `test_challenges.py` 10, `test_auth.py` 8, `test_feedback.py` 8, `test_alarms.py` 6, `test_analytics.py` 6.

---

## 6. Current Errors and Warnings

| # | Severity | Issue | Evidence |
|---|---|---|---|
| E1 | High | **Docker daemon not running** - cannot start Postgres/api containers | `docker ps` -> `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` |
| E2 | High | **`web/src/utils/api.js` is untracked** but imported by 8 pages. A fresh clone of HEAD lacks this file; committing only the modified pages would break the build | `git status` untracked; 8 imports in `web/src/pages/*.jsx` |
| E3 | Medium | **`alembic current` fails without Postgres** - `alembic.ini` default URL points to `localhost:5432`; Postgres is not running locally | `alembic current` -> `connection to server at "localhost" ... port 5432 failed: Connection refused` |
| E4 | Medium | **CI smoke steps have no server** - `smoke_m1.py` / `smoke_m2.py` need a live `:8000`, but `ci.yml` never starts uvicorn | `ci.yml` lines 43-47 |
| E5 | Medium | **Python venv drift** - local `.venv` is Python **3.14.7**; declared/Docker/CI use **3.11** | `backend/.venv/Scripts/python.exe --version` -> 3.14.7; Dockerfile `python:3.11-slim`; CI `3.11` |
| E6 | Low | Expo update available (57.0.22 -> ~57.0.23); "1 other package may need updating" | `expo start` output; `npx expo install --check` |
| E7 | Low | React Router v7 future-flag warnings (`v7_relativeSplatPath`, `v7_startTransition`) during web tests | Vitest stderr |
| E8 | Info | No coverage tooling (no pytest-cov / vitest coverage / jest coverage config) | grep of configs |

---

## 7. Uncommitted Changes

**Tracked modifications (11 files, +1957 / -827):**

| File | +/- |
|---|---|
| `web/src/index.css` | +1466 (largest) |
| `web/src/pages/AlarmManagement.jsx` | ~569 |
| `web/src/pages/ChallengeGenerator.jsx` | ~306 |
| `web/src/pages/Dashboard.jsx` | ~169 |
| `web/src/pages/Reports.jsx` | ~107 |
| `web/src/components/ui/TimeInput.jsx` | ~98 |
| `web/src/components/ui/LiveChallengeSimulator.jsx` | ~27 |
| `web/src/pages/Profile.jsx` | ~19 |
| `web/src/pages/Home.jsx` | ~9 |
| `web/src/pages/Settings.jsx` | ~9 |
| `web/src/pages/Admin.jsx` | ~5 |

**Untracked:**
- `web/src/utils/api.js` - the authenticated fetch helper (34 lines) imported by 8 pages.
- `Q and A/` - 5 audit answer documents.

**Unpushed:** 1 commit (`24bd45a`) ahead of `origin/main`.

---

## 8. Risky Files

| Risk | File(s) | Why |
|---|---|---|
| **Untracked dependency** | `web/src/utils/api.js` | Required by 8 pages, absent from git. Highest-priority repository risk. |
| Large uncommitted WIP | 11 web files incl. `index.css` (+1466) | No commit boundary; losing/merging is error-prone. |
| Placeholder secrets | `backend/.env`, `docker-compose.yml`, `backend/.env.example`, `alembic.ini` | `change_me` / `change_this_to_a_very_random_secret_key_min_32_bytes` committed in compose + alembic. Fine for dev, unsafe for deploy. |
| Debug in container | `docker-compose.yml` (`DEBUG: True`) | Debug mode on in the api service. |
| Migrations outside backend | `migrations/`, `alembic.ini` at repo root | `alembic current` requires running from root; the Docker image copies them in, but local usage is easy to mis-invoke. |
| Dev DB with real rows | `backend/cerebrokognit.db` | 3 users, 2 alarms, 35 challenges; gitignored but contains a demo login (`demo@cerebro.com`). |
| Broad CORS fallback | `backend/app/main.py` L50-57 | `allow_origins or ["*"]` + `allow_credentials=True` when `CORS_ORIGINS` is unset/empty. |
| No password reset / refresh flow | `backend/app/api/auth.py` | Refresh token issued but no `/auth/refresh`; `is_verified` never set True. |
| Dead code | `backend/app/schemas/all.py` | Not imported anywhere. |

---

## 9. Missing Configuration

| # | Missing | Impact |
|---|---|---|
| M1 | `mobile/.env.example` | Mobile API config is undocumented for new setups. |
| M2 | Root `.env.example` / env documentation | No single place describing all env vars (backend, mobile, compose, CI). |
| M3 | `web/.env` / build-time API base | API host is hardcoded to `localhost:8000` in `vite.config.js`; not overridable per environment at build time. |
| M4 | ESLint configs (web, mobile) | No lint script or config for JS/JSX; only backend has ruff. |
| M5 | Coverage config | No pytest-cov / vitest coverage / jest coverage. |
| M6 | Dockerfile for web and mobile | Compose has them commented out; no containerized web/mobile. |
| M7 | CI server bootstrap for smokes | `ci.yml` runs smoke scripts without starting the API. |
| M8 | `web/src/utils/api.js` in version control | See E2. |
| M9 | Cloud/deployment config | No Terraform / IaC / deployment workflow (PRD states cloud deployment pending). |
| M10 | `.env.example` divergence handling | `backend/.env` and `.env.example` have diverged formatting (CORS order, DATABASE_URL). |

---

## 10. Files Inspected (exact)

**Root:** `.dockerignore`, `.gitattributes`, `.gitignore`, `alembic.ini`, `context.md`, `docker-compose.yml`, `PRD.md`, `README.md`, `SRS.md`, `style.md`, `dev.ps1`, `run_all.ps1`, `run_all.bat`, `Project Details.pdf` (listed), directory listings of `.github/`, `assets/`, `migrations/`, `Q and A/`, `.ruff_cache/`.

**CI:** `.github/workflows/ci.yml`.

**Backend:** `.env`, `.env.example`, `Dockerfile`, `docker-entrypoint.sh`, `pyproject.toml`, `pytest.ini`, `requirements.txt`, `requirements-runtime.txt`, `app/main.py`, `app/Models.py`, `app/database.py`, directory listings of `app/`, `app/api/`, `app/services/`, `app/ai_engine/`, `app/gateway/`, `app/integrations/`, `app/workers/`, `app/schemas/`, `scripts/`, `tests/`, `ml_models/`; `migrations/env.py`, `migrations/versions/*` (listed). Read `web/src/utils/api.js`, `web/vite.config.js`.

**Mobile:** `.env`, `package.json`, `App.js` (listed), directory listings of `src/` and all subfolders.

**Web:** `package.json`, `vite.config.js`, `src/utils/api.js`, `src/App.jsx` (listed), directory listings of `src/` and all subfolders, `public/`.

## 11. Commands Executed (exact)

```
Get-ChildItem -Force (root + backend, web, mobile, src trees)
git status ; git branch -a ; git log -5 --oneline
git diff --stat ; git diff --name-only
git ls-files ; git ls-files "*.env*" ; git check-ignore -v backend/.env backend/.env.example mobile/.env
git log -1 --format ; git remote -v ; git status -sb
backend\.venv\Scripts\python.exe --version
backend\.venv\Scripts\python.exe -c "import fastapi,..." (deps check)
backend\.venv\Scripts\python.exe -c "import torch; print(torch.__version__)"
node --version ; npm --version
Test-Path backend/.venv/Scripts/python.exe ; Test-Path web/node_modules ; Test-Path mobile/node_modules
docker --version ; docker compose version ; docker ps
Start uvicorn app.main:app --port 8011 -> GET /health
backend/.venv/Scripts/python.exe -m pytest tests/ -q   (x2)
backend/.venv/Scripts/python.exe -m pytest tests/ --collect-only -q
backend/.venv/Scripts/python.exe -m ruff check app tests scripts
backend/.venv/Scripts/python.exe scripts/smoke_m1.py
backend/.venv/Scripts/python.exe scripts/smoke_m2.py
backend/.venv/Scripts/python.exe -m alembic current
backend/.venv/Scripts/python.exe -m alembic heads
sqlite3 inspect of backend/cerebrokognit.db
web: npm test ; npm run build ; Start "npm run dev" -> GET / (5173)
mobile: npm test -- --ci ; Start "npx expo start --port 8081" -> GET /status
```

---

## 12. Recommended Next Phase

**Phase 1 - Repository hygiene (do first, low risk):**
1. Add `web/src/utils/api.js` to git and commit the 11 modified web files as one coherent commit. This removes the single highest repository risk (E2).
2. Push the 1 unpushed commit (`24bd45a`).
3. Add `mobile/.env.example` and a short root env-var matrix in `README.md` (M1, M2).

**Phase 2 - Green CI (medium risk):**
4. Fix `ci.yml` so smoke steps start the API (background uvicorn + health wait) or gate them behind a server fixture (E4).
5. Add coverage reporting (pytest-cov + vitest/jest coverage) and upload artifacts (M5).
6. Pin or bless the Python version. Reconcile local venv 3.14 vs declared 3.11 (E5) - either upgrade the documented target to 3.14 or recreate the venv on 3.11.

**Phase 3 - Config and security hardening:**
7. Make the web API base configurable via `VITE_API_BASE` (M3).
8. Replace hardcoded compose/alembic placeholder secrets with env-driven values (Risky table) and set `DEBUG: False` for non-dev.
9. Fix the CORS wildcard + credentials fallback in `main.py` (Risky table).

**Phase 4 - Feature backlog (from existing docs):**
10. FCM/APNs delivery provider (currently `NoopProvider`), on-device local alarm scheduling, refresh-token endpoint, email verification, cloud deployment + monitoring.

**Immediate pre-flight note:** Docker Desktop is not running (E1). Start it before any compose-based work; until then, `run_all.ps1 -NoDb` / the SQLite path is the only verified full-stack startup.

---

*End of baseline audit. No fixes applied.*
