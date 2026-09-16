# Intelligent Cognitive Alarm Platform

## Project Overview
The **Intelligent Cognitive Alarm Platform** is an AI-powered alarm clock application that helps users develop consistent wake-up habits by requiring them to solve personalized cognitive challenges (math problems, logic puzzles, memory games, word games, riddles, and quick quizzes) before dismissing alarms. The platform adapts challenge difficulty based on user behavior, wake-up performance, snooze patterns, sleep schedules, and cognitive engagement levels to improve productivity, reduce oversleeping, and encourage healthy sleep routines.

### Target User Personas
- **Students**: Need consistent wake-up times for classes; benefit from cognitive engagement to fully wake up.
- **Professionals**: Early meetings; require quick but effective cognitive challenges to start the day productively.
- **Fitness Enthusiasts**: Fixed training schedules; want sleep adherence tracking and wake-up consistency.
- **Wellness Platforms**: External health/wellness apps; want to integrate habit tracking and sleep analytics.

---

## Project Status

> **Current Stage**: Functional Prototype — **Milestones 1–4 delivered** + **M4 backlog (offline sync, mobile push registration, web/mobile tests, UI app-shell pass, presentation) landed** (2026-09-07/08) + **product-wide retro-futuristic redesign (web + mobile) landed** (2026-09-10)
> Status updated: 2026-09-10.

| Module | Status | Completion | Key Notes |
|---|---|---|---|
| Backend Core Logic | Functional | ~95% | Auth, RBAC, profiles/settings, tz-aware alarms, habits, sync, **server-authoritative challenge engine** all working & smoke-tested |
| Backend Security | Good | ~95% | **Phase 2 (2026-09-16)**: secret fail-fast in production, CORS allowlist, refresh-token rotation + hashed single-use tokens, password-reset/email-verification, audit log, security headers, deactivation + admin role-change; env-driven JWT secret + RBAC, structured error envelope, rate limiting |
| Web Dashboard | Good | ~95% | **Retro-futuristic redesign (2026-09-10)**: flat brand palette `#F4A442`/#3E7C17/#125C13/#E8E1D9 (no gradients, no glow), landing page, grouped nav IA, Home command-center dashboard, admin UI, brand login-bg; **responsive + overflow pass** (no page-level horizontal scroll at any width, fixed-clock clearance, 4→2→1 column chart/metric grids, mobile alarm/settings layouts) |
| Mobile App | Good | ~80% | **Custom HOME/ALARMS/INSIGHTS/PROFILE bottom nav + redesigned screens (2026-09-10)**; alarm dismiss E2E functional; offline-first sync + Expo push-registration wired; on-device E2E + native push still pending (dev build) |
| Testing | Good | ~95% | **Backend pytest suite (95, verified 3.11 + 3.14, coverage 74%)**; **web Vitest (49) + mobile jest-expo (47)**; smoke_m1 (22)/smoke_m2 (25) regression gates; CI via GitHub Actions |
| Infrastructure/Docker | Good | ~90% | **Compose up-tested**: Postgres + migrations entrypoint + lean runtime image + api healthcheck; PDF/Excel served in container |

### Known Critical Issues (remaining after M4)
1. Mobile offline-first sync + push-token registration are wired and jest-tested (31) but **not yet on-device E2E-verified** — remote push needs an Expo **dev build** (Expo Go disables it)
2. Test coverage now exists for backend (pytest **95**, coverage 74%), web (Vitest 49) and mobile (jest 47) with coverage tooling; remaining: broader flow-level alarm-dismiss component coverage
3. No real cloud deployment yet — Docker compose works locally (M4 backlog)
4. Web settings are saved to `/users/settings` + `/users/{key}` (theme, notifications, auto-dismiss, vibrate) — completed 2026-09-08
5. Local alarm scheduling + FCM/APNs delivery provider not yet implemented (needs dev build; M4 backlog)

> M1-resolved issues: hardcoded JWT secret, admin auth bypass, CORS `*`, stale migration, wrong Dockerfile CMD, `load_dotenv` override — all fixed in M1.
> M2-resolved issues: challenge answer leak, template random-mismatch bugs, missing `/challenges/submit`, broken mobile dismiss flow, challenge analytics placeholders — all fixed in M2 (see `context.md` continuity log).
> M3-resolved issues: placeholder analytics values, missing trained ML model, web mock chart data — all fixed in M3 (real analytics, `difficulty_model.pt`, real-data charts).
> M4-resolved issues: zero tests/CI, Docker untested, missing error envelope, no admin UI, no PDF/Excel reports — all fixed in M4 (see `context.md` continuity log).

Full issue inventory: see **Section 9 (Known Issues)** in `SRS.md`.

---

## System Architecture

```
+----------------------+       +----------------------+       +----------------------+
|  Mobile (Expo Go)    |<----->|  Backend (FastAPI)   |<----->|  PostgreSQL DB       |
|  (iOS/Android)       |       |  (Python 3.11)       |       |  (schemas in models)|
+----------------------+       +----------------------+       +----------------------+
        |                            |                            |
        |          HTTPS/JSON        |        psycopg2-binary     |
        v                            v                            v
+----------------------+       +----------------------+       +----------------------+
|  Web Dashboard (React)|       |  Redis (optional)    |       |  MongoDB Collections |
|  (custom CSS, Chart.js)|<----->|  (caching/inference) |<----->|  (user sessions,    |
+----------------------+       +----------------------+       |   telemetry logs)    |
                                           |                            +----------------------+
                                           |
                                           v
                                      +---------------+
                                      |  ML Model Cache|
                                      |  (PyTorch/Joblib)|
                                      +---------------+
```
> Redis, MongoDB, and the ML model cache are **planned components** — not implemented in the current codebase.

**Backend** (FastAPI, SQLAlchemy 2.0, JWT auth): 34 HTTP endpoints (30 unique paths) under `/api/v1` — auth, users, alarms, challenges, habits, analytics, sync, dashboard, notifications.
**Web** (React 18, Vite): SPA dashboard for auth, alarms, challenges, reports, habit scores; **5 nav sections (Overview/Wake/Insights/Account/Administration)** with a collapsible icon rail and a global circular theme toggle in the topbar.
**Mobile** (Expo SDK 57 / React Native 0.87): auth + profile/settings wired; alarm-dismiss flow functional E2E (`/next` → `/submit` → `/dismiss`); **offline-first sync + Expo push-token registration wired & jest-tested (2026-09-07)**; native push delivery pending (needs an Expo dev build).
**Database**: PostgreSQL 15 (Docker) / SQLite (local dev). 9 ORM tables with performance indexes.

---

## Prerequisites

### Local Development
- **Python 3.11** installed
- **Node.js 20+** and **npm** installed
- **Docker** and **Docker Compose** installed (optional; local SQLite works without Docker)

### IDE Recommendations
- **VS Code** with extensions:
  - Python (Microsoft)
  - FastAPI (Mica)
  - Tailwind CSS IntelliSense
  - React Native/Expo (Expo)
  - PostgreSQL (Atomiks)

---

## Local Setup Instructions

> 🚀 **Quick start (recommended):** `.\dev.ps1` launches backend (`:8000`) + web (`:5173`)
> in one shot, using the **pinned** `backend\.venv` interpreter. Options: `-BackendOnly`, `-WebOnly`,
> `-Mobile` (also starts Metro `:8081`). The script waits for each service to bind a port and reports
> status. Run `npm install` / `pip install -r backend\requirements.txt` once first (see below).
>
> 🚀 **Whole stack, one terminal:** `.\run_all.bat` starts **database → backend → web → mobile**
> (mobile **last**) in a single window, streaming colour-labelled output from every service. The
> mobile part runs in the **foreground** so the Expo Go **QR code** + keyboard shortcuts
> (`a`/`w`/`r`/`q`) appear exactly as with a manual `npx expo start`. Press Ctrl+C or `q` to stop
> everything. Options: `-NoDb` (skip Postgres, use SQLite), `-TimeLimitSec N` (non-interactive
> auto-stop, no QR). If the Docker daemon isn't running it falls back to local SQLite automatically.
> When Postgres is used it waits for readiness and **applies migrations automatically**
> (`alembic upgrade head`); `-NoDb`/SQLite self-inits on backend startup.
>
> ⚠️ **Don't** start uvicorn via `activate` + bare `uvicorn` from the repo root — that can resolve to a
> stray Python (e.g. a global 3.11) missing the project deps, so the backend crashes at import and
> every `/api/v1/*` call from the web proxy fails with `ECONNREFUSED`. Always pin the interpreter:
> `backend\.venv\Scripts\python.exe -m uvicorn app.main:app ...` (from `backend/`). `dev.ps1` does this for you.

### 1. Python Virtual Environment (Backend)
```bash
cd backend
python -m venv .venv
# Activate:
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with actual values
```

### 2. PostgreSQL Initialization
```bash
# If not using Docker:
createdb cerebro_kognit
# Or via Docker Compose (see docker-compose.yml):
docker-compose up -d db
```

### 3. Database Migrations
```bash
# From project root (or with DATABASE_URL set for a non-default target):
alembic upgrade head
# Migration is current with `app/Models.py` (revision c7e4a9b2d1f0).
# `migrations/env.py` honors the `DATABASE_URL` env var; SQLite is the local-dev default.
```

### 4. Backend Server
```bash
cd backend
# If venv not activated:
.venv\Scripts\activate   # (Windows)
source .venv/bin/activate  # (macOS/Linux)
uvicorn app.main:app --host 0.0.0.0 --port 8000
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

> ⚠️ **Mobile connectivity (physical phone / emulator)**: the mobile app auto-derives the backend
> host at runtime from the JS bundle server (`Constants.expoConfig.hostUri`, see
> `mobile/src/utils/api.js`) — it does **not** hard-code an IP. Whatever LAN IP Expo Go loaded the
> bundle from is used to reach the backend (`http://<that-ip>:8000`, then `:8090` relay as fallback).
> This self-heals across Wi-Fi/IP changes (`10.22.124.136` ↔ `192.168.149.136` seen in dev).
>
> **Physical phone dev loop:**
> 1. Phone and PC on the **same Wi-Fi/router** (client isolation OFF).
> 2. Backend: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000` (already `0.0.0.0`).
> 3. Metro: `cd mobile && npx expo start --lan` → note the `exp://<LAN-IP>:8081` URL (or QR).
> 4. Expo Go on the phone: open that `exp://<LAN-IP>:8081` URL.
> 5. If the phone browser can reach `http://<LAN-IP>:8000/docs` but the app cannot, allow inbound TCP
>    8000/8081 in Windows Firewall (admin PowerShell):
>    `netsh advfirewall firewall add rule name=CerebroDev-API dir=in action=allow protocol=TCP localport=8000`
>    (`localport=8081` for Metro).
>
> `mobile/.env` (`EXPO_PUBLIC_API_URL`) is an explicit override — leave it empty in dev.

> ✅ **NOTE (M4)**: Docker deployment is verified end-to-end: root build context, lean runtime image (no torch — ML uses rule-based fallback in the container), `alembic upgrade head` entrypoint, Postgres + API healthchecks, PDF/Excel exports served. Run `docker compose up -d` (needs Docker Desktop) → API at `http://localhost:8000`.

### 5. Web Dashboard (React)
```bash
cd web
npm install
npm run dev
# Available at http://localhost:5173
```

### 6. Mobile (Expo Go - Android)
```bash
cd mobile
npm install
# Start Expo development server:
npx expo start
# Press 'a' for Android emulator, or scan QR code with Expo Go app on physical device
```

> ✅ **M2**: Mobile alarm-**dismiss** flow is functional end-to-end: `GET /challenges/next` (no answers) → solve → `POST /challenges/submit` → `POST /alarms/{id}/dismiss`. Verify with `backend/scripts/smoke_m2.py`.

### 7. Verify All Services
```bash
# Check Docker containers:
docker-compose ps

# Test API health:
curl http://localhost:8000/health

# Verify frontend loads at http://localhost:5173
```

---

## Environment Variables Reference

### Backend (`.env.example` → `.env`)
```
APP_NAME="Intelligent Cognitive Alarm Platform"
ENVIRONMENT=development
DEBUG=True

HOST=0.0.0.0
PORT=8000

# DATABASE_URL takes precedence; default local dev: sqlite:///./cerebrokognit.db
# → Fully-local mode: with no DATABASE_URL the API runs self-contained on SQLite.
#   On first startup it auto-creates tables + seeds roles / 7x5 challenges / demo user
#   (demo@cerebro.com / password123). No DB server, no Docker, no cloud. Disable with AUTO_INIT=0.
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cerebro_kognit
POSTGRES_USER=cerebro_user
POSTGRES_PASSWORD=change_me

# ⚠️ SECRET_KEY: set ENVIRONMENT=production → app refuses to start with a missing/placeholder key (fail-fast, Phase 2).
SECRET_KEY=change_this_to_a_very_random_secret_key_min_32_bytes
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# ✅ CORS is loaded from env (Level 1 fix applied).
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

MODEL_DIR=models
DEVICE=cpu  # auto-detect: cuda or cpu

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

FCM_SERVER_KEY=your_fcm_server_key_here
```

### Mobile (`.env`)
```
# EXPO_PUBLIC_API_URL is an OPTIONAL override - leave it EMPTY in dev.
# The app auto-derives the backend host from the Metro bundle's hostUri
# (see mobile/src/utils/api.js), so `localhost` here would mean the device itself.
EXPO_PUBLIC_API_URL=
```

### Web Dashboard
Vite dev server proxies `/api` → `http://localhost:8000` (defined in `web/vite.config.js`).

---

## Development Roadmap

| Milestone | Weeks | Deliverables | Status |
|---|---|---|---|
| **M1: Foundation** | 1–2 | Project scaffolding, DB schema, Auth MVP, User profiles, Alarm scheduling | ✅ Complete — auth+RBAC, profiles/settings, tz-aware alarms, migrations, 22/22 smoke (`smoke_m1.py`) |
| **M2: Cognitive Engine** | 3–4 | Challenge engine, puzzle generation, wake-up verification, analytics | ✅ Complete — server-authoritative engine, `POST /challenges/submit`, no-answer-leak `/next`, mobile E2E dismiss, 25/25 smoke (`smoke_m2.py`) |
| **M3: Adaptive Intelligence** | 5–6 | Adaptive difficulty, habit scoring, recommendation engine, ML inference | ✅ Complete — analytics service (real sleep/wake values), trained `difficulty_model.pt` (`ml-status model_loaded=true`), recommendation engine (4 categories), web wired to live data |
| **M4: Polish & Deploy** | 7–8 | Dashboards, reports, end-to-end testing, Docker deployment | ✅ Complete — error envelope, GitHub Actions CI (ruff + pytest + smokes + web test/build + mobile jest), Docker up-tested, admin UI, PDF/Excel reports; **backlog delivered**: mobile offline sync + push registration, web Vitest, sidebar/theme UI pass, Profile page, `run_all` launcher, final presentation; **Phase 2 (2026-09-16)**: pytest grew to 95 (security suite), coverage 74%; remaining: real cloud deploy |

Full milestone detail: see `SRS.md` Section 6 (Acceptance Criteria per Milestone).

---

## Available Scripts

### Backend
| Command | Description |
|---|---|
| `uvicorn app.main:app --reload` | Start dev server with auto-reload |
| `alembic upgrade head` | Apply pending DB migrations |
| `python scripts/init_db.py --reset` | Recreate schema + seed roles/demo user |
| `python scripts/smoke_m1.py` | In-process M1 regression smoke test (22 checks) via FastAPI TestClient — no server needed |
| `python scripts/smoke_m2.py` | In-process M2 smoke test (25 checks; incl. alembic-on-fresh-DB and no-answer-leak) via TestClient — no server needed |
| `python -m pytest tests/` | Backend unit test suite (95 tests: auth, security, alarms, challenges, analytics, feedback, notifications) — verified on Python 3.11 + 3.14; coverage 74% |
| `ruff check app tests scripts` | Lint the backend (E/F/W pragmatic rule set, clean) |

### Web
| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm test` | Run Vitest frontend unit tests (42) |

### Mobile
| Command | Description |
|---|---|
| `npx expo start` | Start Expo dev server |
| `npx expo start --android` | Launch Android emulator |
| `npx jest --ci` | Run jest-expo mobile tests (33) |

---

## Documentation

| Document | Purpose |
|---|---|
| `README.md` | This file — quick start, status, architecture |
| `SRS.md` | Software Requirements Specification (IEEE format, v1.4) |
| `PRD.md` | Product Requirements Document — vision, personas, modules |
| `context.md` | System Memory & State Anchor — session continuity, discrepancy matrix |

> Removed from the repo 2026-09-10 (recoverable via git history): `ARCHITECTURE.md`, `CHANGELOG.md`,
> `Milestone.md`, `plan.md`, `HierarchicalRemediationPlan.md`, `UI_Wireframes.md`, `infrastructure/`,
> `presentation/`, `Completed Milestones/`, and emulator-era scripts (`host_relay.py`, `dev_up_all.ps1`).

---

## Author

**Pawan Simha R**
MCA Student, Sapthagiri NPS University
Infosys Virtual Internship 7.0

| Channel | Link |
|---|---|
| Email | [iampawansimha.2004@gmail.com](mailto:iampawansimha.2004@gmail.com) |
| GitHub | [github.com/PawanSimha](https://github.com/PawanSimha) |
| LinkedIn | [linkedin.com/in/pawansimha](https://www.linkedin.com/in/pawansimha) |
| Portfolio | [portfolio-pawansimha.vercel.app](https://portfolio-pawansimha.vercel.app/) |
| Google Developer | [g.dev/pawansimha](https://g.dev/pawansimha) |

**Project Guide & Mentor**: Shanmukha Priya

---

## Contributing

Before making changes, review:
1. `SRS.md` — understand the specification and known-discrepancy tracking
2. `context.md` — understand known gaps vs spec

## License
Proprietary – All rights reserved.