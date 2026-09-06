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

> **Current Stage**: Functional Prototype — **Milestones 1–2 complete** (auth, RBAC, profiles, timezone-aware alarms, habit scoring, server-authoritative challenge engine, E2E alarm dismiss, migrations, smoke-tested)
> Status updated: 2026-09-06. See `HierarchicalRemediationPlan.md` for the prioritized remediation roadmap.

| Module | Status | Completion | Key Notes |
|---|---|---|---|
| Backend Core Logic | Functional | ~88% | Auth, RBAC, profiles/settings, tz-aware alarms, habits, sync, **server-authoritative challenge engine** all working & smoke-tested |
| Backend Security | Good | ~80% | Env-driven JWT secret + CORS, RBAC enforced; remaining: structured errors, rate limiting |
| Web Dashboard | Partial | ~60% | Dashboard wired to real history charts; Home still mock; no admin UI |
| Mobile App | Partial | ~45% | Profile/settings wired; **alarm dismiss E2E (next→submit→dismiss) now functional**; notifications/offline not wired |
| Testing | None | 0% | Zero unit tests, no CI/CD (`smoke_m1.py` + `smoke_m2.py` = manual verification only) |
| Infrastructure/Docker | Partial | ~55% | Dockerfile CMD fixed, .dockerignore, migration current; full compose up-test pending |

### Known Critical Issues (remaining after M2)
1. Analytics sleep values still placeholder (`sleep_duration_avg = 7.5`) (M3)
2. No trained ML model file — adaptive difficulty uses rule-based fallback (M3)
3. Web dashboard Home page still renders mock chart data / silent fake fallbacks (M3)
4. Zero unit tests and no CI/CD pipeline (M4)
5. Admin dashboard page missing; PDF/Excel reports not implemented (M3/M4)
6. Mobile offline caching + notifications not wired (M4)

> M1-resolved issues: hardcoded JWT secret, admin auth bypass, CORS `*`, stale migration, wrong Dockerfile CMD, `load_dotenv` override — all fixed in M1.
> M2-resolved issues: challenge answer leak, template random-mismatch bugs, missing `/challenges/submit`, broken mobile dismiss flow, challenge analytics placeholders — all fixed in M2 (see `context.md` continuity log).

Full issue inventory: see **Section 9 (Known Issues)** in `SRS.md`.

---

## System Architecture

```
+----------------------+       +----------------------+       +----------------------+
|  Mobile (Expo Go)    |<----->|  Backend (FastAPI)   |<----->|  PostgreSQL DB       |
|  (iOS/Android)       |       |  (Python 3.11)       |       |  (schemas in models)|
+----------------------+       +----------------------+       +----------------------+
        |                            |                            |
        |          HTTPS/JSON        |          asyncpg           |
        v                            v                            v
+----------------------+       +----------------------+       +----------------------+
|  Web Dashboard (React)|       |  Redis (optional)    |       |  MongoDB Collections |
|  (Tailwind, Chart.js) |<----->|  (caching/inference) |<----->|  (user sessions,    |
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

**Backend** (FastAPI, SQLAlchemy 2.0, JWT auth): 27 REST endpoints under `/api/v1` — auth, users, alarms, challenges, habits, analytics, sync, dashboard.
**Web** (React 18, Vite): SPA dashboard for auth, alarms, challenges, reports, habit scores.
**Mobile** (Expo SDK 57 / React Native 0.87): auth + profile/settings wired; alarm-dismiss flow functional E2E (`/next` → `/submit` → `/dismiss`); offline caching + notifications pending (M4).
**Database**: PostgreSQL 15 (Docker) / SQLite (local dev). 8 ORM tables with performance indexes.

---

## Prerequisites

### Local Development
- **Python 3.11** installed
- **Node.js 20+** and **npm** installed
- **Expo CLI** installed globally: `npm install -g expo-cli`
- **Docker** and **Docker Compose** installed
- **PostgreSQL 15** installed (or use Docker)

### IDE Recommendations
- **VS Code** with extensions:
  - Python (Microsoft)
  - FastAPI (Mica)
  - Tailwind CSS IntelliSense
  - React Native/Expo (Expo)
  - PostgreSQL (Atomiks)

---

## Local Setup Instructions

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
# Migration is current with `app/Models.py` (revision 1c584bd4a5b0).
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
> **Emulator fallback (optional, dev-only):** `scripts/host_relay.py` (8090→8000) and
> `scripts/dev_up_all.ps1` exist for Android-emulator debugging; not required for the phone.
> `mobile/.env` (`EXPO_PUBLIC_API_URL`) is an explicit override — leave it empty in dev.

> ✅ **NOTE**: The Dockerfile now uses the correct `app.main:app` target and ships with a `.dockerignore`. Full container up-test is pending — requires Docker Desktop running.

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

# DATABASE_URL takes precedence; default local dev: sqlite:///./cerebro_kognit.db
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cerebro_kognit
POSTGRES_USER=cerebro_user
POSTGRES_PASSWORD=change_me

# ✅ SECRET_KEY is read from env by AuthService (Level 1 fix applied).
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
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000  # Android emulator localhost
```

### Web Dashboard
Vite dev server proxies `/api` → `http://localhost:8000` (defined in `web/vite.config.js`).

---

## Development Roadmap

| Milestone | Weeks | Deliverables | Status |
|---|---|---|---|
| **M1: Foundation** | 1–2 | Project scaffolding, DB schema, Auth MVP, User profiles, Alarm scheduling | ✅ Complete — auth+RBAC, profiles/settings, tz-aware alarms, migrations, 22/22 smoke (`smoke_m1.py`) |
| **M2: Cognitive Engine** | 3–4 | Challenge engine, puzzle generation, wake-up verification, analytics | ✅ Complete — server-authoritative engine, `POST /challenges/submit`, no-answer-leak `/next`, mobile E2E dismiss, 28/28 smoke (`smoke_m2.py`) |
| **M3: Adaptive Intelligence** | 5–6 | Adaptive difficulty, habit scoring, recommendation engine, ML inference | ✅ Complete — analytics service (real sleep/wake values), trained `difficulty_model.pt` (`ml-status model_loaded=true`), recommendation engine (4 categories), web wired to live data |
| **M4: Polish & Deploy** | 7–8 | Dashboards, reports, end-to-end testing, Docker deployment | ❌ Not started — no tests, no CI, full container up-test pending |

Full milestone detail: see `Milestone.md`.

---

## Available Scripts

### Backend
| Command | Description |
|---|---|
| `uvicorn app.main:app --reload` | Start dev server with auto-reload |
| `alembic upgrade head` | Apply pending DB migrations |
| `python scripts/init_db.py --reset` | Recreate schema + seed roles/demo user |
| `python scripts/smoke_m1.py` | In-process M1 regression smoke test (22 checks) via FastAPI TestClient — no server needed |
| `python scripts/smoke_m2.py` | In-process M2 smoke test (28 checks; incl. alembic-on-fresh-DB and no-answer-leak) via TestClient — no server needed |

⚠️ **Note**: A real test suite (`pytest`) is not yet configured — this is remediation Level 14.

### Web
| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |

⚠️ **Note**: `npm run lint` and `npm run test` are not yet configured — remediation Level 15.

### Mobile
| Command | Description |
|---|---|
| `npx expo start` | Start Expo dev server |
| `npx expo start --android` | Launch Android emulator |

---

## Documentation

| Document | Purpose |
|---|---|
| `README.md` | This file — quick start, status, architecture |
| `SRS.md` | Software Requirements Specification (IEEE format, v1.2) |
| `PRD.md` | Product Requirements Document — vision, personas, modules |
| `context.md` | System Memory & State Anchor — session continuity, discrepancy matrix |
| `Milestone.md` | Milestone definitions, tasks, outcomes, evaluation criteria |
| `HierarchicalRemediationPlan.md` | Prioritized remediation roadmap — Levels 0–16 with effort estimates |

---

## Contributing

Before making changes, review:
1. `HierarchicalRemediationPlan.md` — understand current priority order
2. `context.md` — understand known gaps vs spec
3. `.opencode/skills/` — coding conventions for backend/frontend/mobile

## License
Proprietary – All rights reserved.