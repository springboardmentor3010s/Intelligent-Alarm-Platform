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

> **Current Stage**: Functional Prototype — **Milestone 1 complete** (auth, RBAC, profiles, timezone-aware alarms, habit scoring, migrations, smoke-tested)
> Status updated: 2026-09-05. See `HierarchicalRemediationPlan.md` for the prioritized remediation roadmap.

| Module | Status | Completion | Key Notes |
|---|---|---|---|
| Backend Core Logic | Functional | ~85% | Auth, RBAC, profiles/settings, tz-aware alarms, habits, sync all working & smoke-tested |
| Backend Security | Good | ~80% | Env-driven JWT secret + CORS, RBAC enforced; remaining: structured errors, rate limiting |
| Web Dashboard | Partial | ~60% | Dashboard wired to real history charts; Home still mock; no admin UI |
| Mobile App | Partial | ~35% | Profile/settings wired to backend; dismiss flow still broken; notifications/offline not wired |
| Testing | None | 0% | Zero unit tests, no CI/CD (`smoke_m1.py` = manual verification only) |
| Infrastructure/Docker | Partial | ~55% | Dockerfile CMD fixed, .dockerignore, migration current; full compose up-test pending |

### Known Critical Issues (remaining after M1)
1. Challenge answers still leaked in `/api/v1/challenges/next` response — trivially bypassable (M2)
2. Mobile alarm-dismiss payload mismatch + no `/api/v1/challenges/submit` endpoint — core flow cannot succeed (M2)
3. No server-side challenge verification endpoint (M2)
4. Analytics endpoint returns hardcoded placeholder values (M3)
5. Zero unit tests and no CI/CD pipeline (M4)
6. Mobile UI shows mock data / silent fake fallbacks; admin dashboard page missing (M3/M4)

> M1-resolved issues: hardcoded JWT secret, admin auth bypass, CORS `*`, stale migration, wrong Dockerfile CMD, `load_dotenv` override — all fixed in M1 (see `context.md` continuity log).

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

**Backend** (FastAPI, SQLAlchemy 2.0, JWT auth): 23 REST endpoints under `/api/v1` — auth, users, alarms, challenges, habits, analytics, sync, dashboard.
**Web** (React 18, Vite): SPA dashboard for auth, alarms, challenges, reports, habit scores.
**Mobile** (Expo SDK 57 / React Native 0.87): auth + profile/settings wired; core dismiss flow still broken (M2).
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
# Migration is current with `app/Models.py` (revision 732e5cb49bcf).
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

> ⚠️ **NOTE**: Mobile profile/settings screens are wired to the backend, but the alarm-**dismiss** flow still does not match the backend contract (no `/challenges/submit` endpoint server-side). See `HierarchicalRemediationPlan.md` Level 11 / M2.

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
| **M1: Foundation** | 1–2 | Project scaffolding, DB schema, Auth MVP, User profiles, Alarm scheduling | ✅ Complete — auth+RBAC, profiles/settings, tz-aware alarms, migration `732e5cb49bcf`, 22/22 smoke |
| **M2: Cognitive Engine** | 3–4 | Challenge engine, puzzle generation, wake-up verification, analytics | ⚠️ Partial — engine works; answer leak, no submit endpoint |
| **M3: Adaptive Intelligence** | 5–6 | Adaptive difficulty, habit scoring, recommendation engine, ML inference | ⚠️ Partial — scoring works; analytics placeholders |
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
| `python scripts/smoke_m1.py` | End-to-end HTTP smoke test (22 checks) — needs server running |

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