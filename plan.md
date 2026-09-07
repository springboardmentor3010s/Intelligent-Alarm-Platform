# Plan — Architecture Alignment: Intelligent Cognitive Alarm Platform

> Status: **approved 2026-09-07**. Source spec: *Architecture Update Specification* (architecture spec ref'd from codebase) + `context.md` milestones.
> Principle (§25/§20): **do not rewrite working functionality.** Map existing code to target responsibilities; only add/move/refactor where required for architectural consistency. Anything not yet implemented is either implemented-as-scaffold or explicitly documented as **planned**.

---

## Decisions (locked)

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Refactor depth | **Logical service-layer** inside the existing single FastAPI process | §20/§25: don't force the physical `services/` tree if the repo already has a better equivalent; a 12-process split is overkill and risks the working system. |
| 2 | Speculative infra | MongoDB, Elasticsearch, Vector DB, InfluxDB, S3, email, MQ = **planned-only, documented**. Redis = thin optional adapter (active only if `REDIS_URL` set). Rate limiting = **real, in-memory**. | §25: don't fabricate functionality from the diagram. |
| 3 | Sequencing | Architecture alignment first, then mobile offline/notifications → tests → presentation | P1/P5 produce the notification-registration endpoint and isolated modules the mobile work needs. |

---

## Target architecture (one view)

```
CLIENTS/USERS -> USER INTERFACES -> API GATEWAY (FastAPI) -> MICROSERVICES -> AI/ML ENGINE -> DATA LAYER
   (External integrations via gateway/services)
```

- **12 microservices**: User, Alarm, Challenge, Adaptive Difficulty, Verification, Behavior Analytics, Habit Scoring, Recommendation, Notification, Analytics, Report, Admin
- **AI/ML engine** (7 components): Challenge Generation, Difficulty Adaptation, Behavior Analysis, Habit Scoring, Recommendation, Performance Prediction, Anomaly Detection
- **Data layer**: PostgreSQL (real), Redis (optional adapter), MongoDB/Elasticsearch/Vector/InfluxDB (**planned**)
- **Cross-cutting**: File storage, Monitoring & Logging, Backup & Security (**planned** except docker/env/security which are real)

---

## Current → target mapping

| Target service | Current home | Disposition |
|---|---|---|
| API Gateway | `backend/app/main.py`, `api/deps.py`, `api/*` | keep; add rate limit, trace-id, structured logs |
| User | `api/auth.py`, `api/users.py`, `services/auth.py` | → `user_service.py` |
| Alarm | `api/alarms.py` | → `alarm_service.py` |
| Challenge | `api/challenges.py`, `services/challenge_service.py` | → `challenge_service.py` |
| Adaptive Difficulty | `services/ml_inference.py` + adaptive pick | → `adaptive_difficulty_service.py` + `ai_engine/difficulty.py` |
| Verification | submit/dismiss gates in `challenges.py`/`alarms.py` | → `verification_service.py` |
| Behavior Analytics | `services/analytics_service.py` | → `behavior_analytics_service.py` |
| Habit Scoring | scoring in `analytics_service.py` + `api/habits.py` | → `habit_scoring_service.py` |
| Recommendation | `services/recommendation_service.py` | → `recommendation_service.py` + `ai_engine/recommendations.py` |
| Notification | none | **new** → `notification_service.py` + register endpoint (P5) |
| Analytics (aggregate) | `api/analytics.py` + `analytics_service.py` | → `analytics_service.py` |
| Report | `services/report_export.py` + report routes | → `report_service.py` |
| Admin | `api/dashboard.py` + `web/src/pages/Admin.jsx` | → `admin_service.py` |

---

## Phases & gates

### P0 — Docs baseline
- Create `ARCHITECTURE.md` (implemented ↔ planned matrix; diagram as source of truth).
- Create `CHANGELOG.md`.
- Commit.

### P1 — API Gateway hardening (implement)
- New `backend/app/gateway/` module:
  - request `X-Request-ID`/trace-id **middleware**
  - **structured logging** (JSON-friendly; method/path/status/duration/trace)
  - **in-memory sliding-window rate limiter** for `/api/v1/auth/*` (e.g. 10/min per IP)
- Wire into `main.py`. Keep CORS, error envelope, RBAC, `/health`, OpenAPI untouched.
- **Gate:** pytest 23 ✓ · smoke_m1 22/22 ✓ · smoke_m2 28/28 ✓ · ruff ✓ · `X-Request-ID` echo verified.

### P2 — Service modularization (reorganize, zero logic change)
- Split `services/` into one module per domain, preserving signatures via thin import shims used by `api/`:
  - `user_service.py`, `alarm_service.py`, `challenge_service.py`, `adaptive_difficulty_service.py`, `verification_service.py`, `behavior_analytics_service.py`, `habit_scoring_service.py`, `recommendation_service.py`, `analytics_service.py`, `report_service.py`, `admin_service.py`, `notification_service.py` (interface).
  - `services/auth.py`, `challenge_service.py`, `ml_inference.py`, `analytics_service.py`, `recommendation_service.py`, `report_export.py` become re-export facades so routers/smokes/tests keep working unchanged.
- **Gate:** full pytest + both smokes + ruff after each sub-step.

### P3 — AI/ML engine separation
- New `backend/ai_engine/` package:
  - `interfaces.py`: `predict()`, `score()`, `recommend()`, `adapt_difficulty()`, `generate_challenge()`, `detect_anomaly()`
  - `difficulty.py` (real: model + rule fallback), `recommendations.py` (real), `challenge_generation.py` (real: wraps existing generator)
  - `behavior_analysis.py`, `anomaly.py`, `performance_prediction.py` (**stubs, documented planned**)
- `services/ml_inference.py` stays as backward-compat facade.
- **Gate:** `ml-status model_loaded=true` (local), pytest + smokes + ruff.

### P4 — Data layer & infra scaffolds
- Optional `RedisCache` adapter (`services/cache.py`) active only when `REDIS_URL` set.
- `workers/` interface + FastAPI `BackgroundTasks` async report generation (`?async=1`) for the 3 report endpoints.
- `infrastructure/` docs: monitoring, logging, backup/DR procedure, security checklist.
- MongoDB/ES/Vector/InfluxDB: **planned rows** in ARCHITECTURE.md.
- **Gate:** async report path tested; pytest + smokes + ruff.

### P5 — Notification service + mobile registration
- `notification_service.py` (channel abstraction) + `POST /api/v1/notifications/register` / `DELETE /api/v1/notifications/register` (new `push_tokens` table + migration).
- `integrations/messaging.py` adapter interface (FCM/APNs **planned**).
- **Gate:** pytest (register/list/deregister), smokes + ruff.

### P6 — Frontend navigation (§21)
- Reorganize `web/src/App.jsx` nav hierarchy reusing existing pages:
  - User: Dashboard → Home/Alarms (Active, History, Create via existing form)/Challenges (History, Performance)/Habits (Tracking, Score)/Sleep/Analytics/Recommendations/Reports/Profile
  - Admin: Users / Reports / Configuration (RBAC-gated)
- **Gate:** `npm run build` clean.

### P7 — Docs sync + §27 audit
- Update README/PRD/SRS/Milestone/context/ARCHITECTURE/CHANGELOG.
- Run full §27 validation checklist; mark real items ✅, intentional-planned items explicitly.
- **Final gate:** pytest ✓ · smokes ✓ · ruff ✓ · web build ✓ · `docker compose up` + health + E2E ✓ · commit + push.

---

## Post-plan backlog (builds on alignment)
1. Mobile offline sync + notifications (uses P5 register endpoint, P2/P3 isolation)
2. Mobile/web test coverage (jest-expo + Vitest) wired into CI
3. Final presentation

## Non-goals (deliberately untouched)
- Challenge engine, scoring formulas, models, error envelope, smokes, existing test contracts.
- No physical multi-process service split.
- No MongoDB/ES/Vector/InfluxDB/S3/email/MQ implementation (planned-only).