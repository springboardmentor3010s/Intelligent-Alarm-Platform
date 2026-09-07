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

> **Current Stage**: Functional Prototype — **Milestones 1–3 complete, M4 core delivered**, plus **architecture alignment P1–P7 landed** (2026-09-07)
> Status updated: 2026-09-07. See `HierarchicalRemediationPlan.md` for the prioritized remediation roadmap and `ARCHITECTURE.md` for the implemented-vs-planned mapping.

| Module | Status | Completion | Key Notes |
|---|---|---|---|
| Backend Core Logic | Functional | ~95% | Auth, RBAC, profiles/settings, tz-aware alarms, habits, sync, **server-authoritative challenge engine** all working & smoke-tested |
| Backend Security | Good | ~95% | Env-driven JWT secret + CORS, RBAC enforced, **structured error envelope**, **rate limiting + request-id/structured logging (P1)** |
| Web Dashboard | Good | ~85% | Home/Dashboard/Reports wired to real history charts; admin UI page; **§21 grouped navigation (P6)**; settings persistence remains |
| Mobile App | Partial | ~50% | Profile/settings wired; **alarm dismiss E2E (next→submit→dismiss) functional**; **offline-first sync engine + Expo push-token registration wired (2026-09-07)**; on-device E2E + native push still pending |
| Testing | Good | ~90% | **Backend pytest suite (32 tests, verified on Python 3.11 + 3.14)**; **web Vitest (8) + mobile jest-expo (31)**; smoke_m1/smoke_m2 as regression gates; CI/CD (ruff + pytest + smokes + web build+test + mobile test) via GitHub Actions |
| Infrastructure/Docker | Good | ~85% | **Compose up-tested**: Postgres + migrations entrypoint + lean runtime image + api healthcheck; PDF/Excel served in container |

### Known Critical Issues (remaining after M4)
1. Mobile offline-first sync + push-token registration now wired (2026-09-07, jest 31/31 + Metro bundle clean) but **not yet on-device E2E-verified** (needs a dev build for Expo push; Expo Go disables it)
2. Test coverage now exists for web (Vitest) + mobile (jest-expo 31) and backend (pytest 32); remaining: broader flow-level alarm-dismiss component coverage
3. No real cloud deployment yet — Docker compose works locally (M4 backlog)
4. Settings persistence on web dashboard pending (M4 backlog)
5. Local alarm scheduling + FCM/APNs delivery provider not yet implemented (M4 backlog)

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
>
> The mapping of this diagram to the implemented (single-deployable) architecture is documented in **`ARCHITECTURE.md`** (source of truth: ✅ implemented · 🟡 scaffold · 🟥 planned).

**Backend** (FastAPI, SQLAlchemy 2.0, JWT auth): 30 REST endpoints under `/api/v1` — auth, users, alarms, challenges, habits, analytics, sync, dashboard, notifications (P5).
**Web** (React 18, Vite): SPA dashboard for auth, alarms, challenges, reports, habit scores; **§21 grouped navigation**.
**Mobile** (Expo SDK 57 / React Native 0.87): auth + profile/settings wired; alarm-dismiss flow functional E2E (`/next` → `/submit` → `/dismiss`); offline caching + notifications pending (M4 backlog — P5 register API ready).
**Database**: PostgreSQL 15 (Docker) / SQLite (local dev). 9 ORM tables with performance indexes.

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

> 🚀 **Quick start (recommended):** `.\dev.ps1` launches backend (`:8000`) + web (`:5173`)
> in one shot, using the **pinned** `backend\.venv` interpreter. Options: `-BackendOnly`, `-WebOnly`,
> `-Mobile` (also starts Metro `:8081`). The script waits for each service to bind a port and reports
> status. Run `npm install` / `pip install -r backend\requirements.txt` once first (see below).
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

# DATABASE_URL takes precedence; default local dev: sqlite:///./cerebro_kognit.db
# → Fully-local mode: with no DATABASE_URL the API runs self-contained on SQLite.
#   On first startup it auto-creates tables + seeds roles / 7x5 challenges / demo user
#   (demo@cerebro.com / password123). No DB server, no Docker, no cloud. Disable with AUTO_INIT=0.
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
| **M4: Polish & Deploy** | 7–8 | Dashboards, reports, end-to-end testing, Docker deployment | 🟡 Core delivered — pytest (23 tests), error envelope, GitHub Actions CI, Docker up-tested, admin UI, PDF/Excel reports; backlog: offline sync/notifications, cloud deploy, mobile tests |

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
| `python -m pytest tests/` | Backend unit test suite (32 tests: auth, alarms, challenges, analytics, sync, reports) — verified on Python 3.11 + 3.14 |
| `ruff check app tests scripts` | Lint the backend (E/F/W pragmatic rule set, clean) |

### Web
| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm test` | Run Vitest frontend unit tests (8) |

### Mobile
| Command | Description |
|---|---|
| `npx expo start` | Start Expo dev server |
| `npx expo start --android` | Launch Android emulator |
| `npx jest --ci` | Run jest-expo mobile tests (31) |

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
| `presentation/CerebroKognit_Final.pptx` | Final capstone presentation (15 slides + speaker notes) |
| `presentation/build_presentation.py` | Reproducible generator for the final deck (python-pptx) |
| `Completed Milestones/Milestone - 1.docx` | Milestone 1 presentation notes (foundation, auth, alarms) |
| `Completed Milestones/Milestone - 2.docx` | Milestone 2 presentation notes (cognitive challenge engine) |
| `Completed Milestones/Milestone - 3.docx` | Milestone 3 presentation notes (adaptive ML + recommendations) |
| `Completed Milestones/Milestone - 4.docx` | Milestone 4 presentation notes (analytics, testing, deployment) |
| `presentation/build_milestone_docs.py` | Reproducible generator for the milestone DOCX notes |

---

## Contributing

Before making changes, review:
1. `HierarchicalRemediationPlan.md` — understand current priority order
2. `context.md` — understand known gaps vs spec
3. `.opencode/skills/` — coding conventions for backend/frontend/mobile

## License
Proprietary – All rights reserved.