# ARCHITECTURE.md — Intelligent Cognitive Alarm Platform

> This document is the **source of truth** for the implemented architecture and its mapping to the target architecture diagram.
> Legend: ✅ **implemented** · 🟡 **implemented-as-scaffold/shim** · 🟥 **planned / future** (explicitly not implemented — never claim otherwise).

---

## 1. Target architecture (diagram)

```
CLIENTS / USERS  →  USER INTERFACES  →  API GATEWAY (FastAPI)
    →  MICROSERVICES  →  AI / ML & INTELLIGENCE ENGINE  →  DATA LAYER

External integrations (FCM/APNs · Sleep/Health APIs · Puzzle APIs · Content · BI · Email · Cloud Storage)
File Storage · Monitoring & Logging · Backup & Security  (cross-cutting)
```

Communication model: **synchronous** HTTP/HTTPS REST (solid arrows) · **asynchronous** background jobs for long-running work (dashed arrows) · external integrations isolated behind adapters.

## 2. Implemented architecture today (single deployable FastAPI service)

```
backend/app/
├── main.py            → API Gateway assembly: routers, CORS, error envelope, lifespan, /health, OpenAPI
├── gateway/           → request-id/trace middleware, structured logging, rate limiting          [P1+]
├── api/               → routers (routing layer, thin) — auth·users·alarms·challenges·habits·sync·dashboard·analytics
├── services/          → domain service layer (microservice responsibilities in one process)
├── ai_engine/         → AI/ML & intelligence engine (interfaces + components)                   [P3+]
├── schemas/           → Pydantic v2 request/response contracts
├── Models.py          → SQLAlchemy data layer (PostgreSQL local default; SQLite dev/offline)
└── database.py        → engine/session management

web/                   → React web dashboard (UI layer)
mobile/                → React Native (Expo) app (UI layer)
migrations/            → Alembic migrations          tests/  → pytest suite (23)
ml_models/             → trained difficulty_model.pt
infrastructure/        → Docker, monitoring/logging/backup/security docs                         [P4+]
```

## 3. Layer / component matrix

| # | Component | Status | Where |
|---|---|---|---|
| 1 | Client layer (User/Wellness Coach/Administrator; web+mobile+API) | ✅ | `web/`, `mobile/`, REST APIs |
| 2 | User interfaces (web dashboard, analytics, reports) | ✅ | `web/src/pages/*` |
| 3 | API Gateway — FastAPI | ✅ | `backend/app/main.py` |
| 4 | — API versioning `/api/v1/*` | ✅ | routers prefix |
| 5 | — Authentication (JWT) | ✅ | `api/deps.py`, `services/auth.py` |
| 6 | — Authorization / RBAC | ✅ | `require_roles()` |
| 7 | — Request/response validation (Pydantic v2) | ✅ | `schemas/` |
| 8 | — Error handling envelope `{detail,error_code,timestamp,status_code}` | ✅ | `main.py` |
| 9 | — CORS (env) | ✅ | `main.py` |
| 10 | — Health checks `/health` | ✅ | `main.py` |
| 11 | — OpenAPI docs | ✅ | FastAPI auto |
| 12 | — Structured logging + trace IDs | 🟡 | `gateway/` (P1+) |
| 13 | — Rate limiting | 🟡 | `gateway/` in-memory (P1+) |
| 14 | — Load balancing | 🟥 | via Docker/cloud orchestrator (planned) |
| 15 | User Service | ✅ | `services/user_service.py` (auth/users/roles/profile) |
| 16 | Alarm Service | ✅ | `services/alarm_service.py` |
| 17 | Challenge Service | ✅ | `services/challenge_service.py` |
| 18 | Adaptive Difficulty Service | ✅ | `services/adaptive_difficulty_service.py` + `ai_engine/difficulty.py` |
| 19 | Verification Service | ✅ | `services/verification_service.py` |
| 20 | Behavior Analytics Service | ✅ | `services/behavior_analytics_service.py` |
| 21 | Habit Scoring Service | ✅ | `services/habit_scoring_service.py` |
| 22 | Recommendation Service | ✅ | `services/recommendation_service.py` + `ai_engine/recommendations.py` |
| 23 | Notification Service | 🟡 | `services/notification_service.py` interface + register API (P5+) |
| 24 | Analytics Service | ✅ | `services/analytics_service.py` |
| 25 | Report Service (PDF/Excel/CSV/JSON) | ✅ | `services/report_service.py` |
| 26 | Admin Service | ✅ | `services/admin_service.py` + `web/src/pages/Admin.jsx` |

## 4. AI / ML & Intelligence Engine

| Component | Status | Where |
|---|---|---|
| Interfaces `predict/score/recommend/adapt_difficulty/generate_challenge/detect_anomaly` | 🟡 | `ai_engine/interfaces.py` (P3+) |
| Difficulty Adaptation Model (trained `difficulty_model.pt` + rule fallback) | ✅ | `ai_engine/difficulty.py`, `ml_models/`, `scripts/train_difficulty_model.py` |
| Recommendation Engine | ✅ | `ai_engine/recommendations.py` |
| Challenge Generation Model (deterministic generator) | ✅ | `ai_engine/challenge_generation.py` (wraps `challenge_service`) |
| Behavior Analysis Model | 🟥 | interface only — planned |
| Habit Scoring Model (formula-driven) | 🟡 | via `habit_scoring_service` — planned model layer |
| Performance Prediction Model | 🟥 | interface only — planned |
| Anomaly Detection (snooze patterns) | 🟥 | interface only — planned |

Principle: **inference separated from training** (training = `scripts/train_difficulty_model.py`); ML keeps clean interfaces; not every problem uses deep learning.

## 5. Data layer (polyglot persistence)

| Store | Purpose | Status | Where |
|---|---|---|---|
| PostgreSQL | users, alarms, habits, scores, attempts | ✅ | `Models.py`, `migrations/`, `docker-compose.yml` |
| SQLite | local/offline dev mode | ✅ | `database.py` default + `services/bootstrap.py` |
| Redis | session/cache/rate-limit | 🟡 | `services/cache.py` optional adapter (active only if `REDIS_URL`); no-op otherwise (P4+) |
| MongoDB | challenges/preferences/logs | 🟥 | no justified workload — planned |
| Elasticsearch | search | 🟥 | no justified workload — planned |
| Vector DB (FAISS/Pinecone) | embeddings/similarity | 🟥 | no justified workload — planned |
| InfluxDB | time-series trends | 🟥 | trends computed from Postgres today — planned |

Data ownership (§17): each domain service owns its models; no cross-service DB writes.

## 6. External integrations (isolated behind adapters)

| Integration | Status | Where |
|---|---|---|
| Cloud messaging FCM / APNs | 🟥 | `integrations/messaging.py` interface (P5+) — Expo token capture exists on mobile |
| Sleep/health APIs (HealthKit, Google Fit) | 🟥 | `integrations/health.py` — planned |
| Puzzle/content providers | 🟥 | `integrations/content.py` — planned |
| Analytics/BI | 🟥 | `integrations/analytics_bi.py` — planned |
| Email (SendGrid/SES) | 🟥 | `integrations/email.py` — planned |
| Cloud storage (S3/Azure Blob) | 🟥 | `integrations/storage.py` — planned |

## 7. Cross-cutting infrastructure

| Area | Status | Where |
|---|---|---|
| Docker (compose, Dockerfile, entrypoint, healthchecks) | ✅ | root, `backend/` |
| CI/CD (ruff + pytest + smokes + web build) | ✅ | `.github/workflows/ci.yml` |
| Security: env secrets, bcrypt, JWT, RBAC, CORS, Pydantic validation | ✅ | `app/`, `.env.example` |
| Security: rate limiting | 🟡 | `gateway/` (P1+) |
| Monitoring & error tracking | 🟥 | `infrastructure/monitoring.md` — plan documented (P4+), implementation planned |
| Structured logging | ✅ | `gateway/` (P1) + `infrastructure/logging.md` |
| Backup & disaster recovery | 🟡 | `infrastructure/backup-dr.md` — procedure documented (P4), automation planned |

## 8. Async processing

| Task | Status |
|---|---|
| Report/PDF/Excel generation (background) | 🟡 — `workers/` interface + FastAPI BackgroundTasks (P4+) |
| Alarm scheduling / notification delivery / analytics aggregation / ML jobs | 🟥 — message queue/full workers planned |

## 9. Validation

Continuously validated by: `./scripts/smoke_m1.py` (22) · `./scripts/smoke_m2.py` (28) · `pytest` (23) · `ruff` · `npm run build` · `docker compose up` healthcheck. Full §27 checklist run in P7.

*Last updated: 2026-09-07 (P0 baseline; superscript [Pn+] rows land in that phase).*