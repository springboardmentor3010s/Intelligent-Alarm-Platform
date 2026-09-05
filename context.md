# context.md - System Memory & State Anchor

## Purpose
Persistent session memory. If LLM session context resets or runs out of tokens, reading `context.md` must restore exact project state, active tasks, directory layout, database schema specifications, and next immediate implementation steps without losing information.

---

## Technology Stack Version Matrix

> Updated 2026-09-05 to reflect **actual installed versions** (verified from `.venv` and `node_modules`). Declared spec versions from `requirements.txt`/`package.json` shown in parentheses where they drift.

| Layer | Technology | Installed Version | Declared | Notes |
|---|---|---|---|---|
| **Backend** | Python | 3.14.x (venv) | 3.11.6 | ⚠️ Venv drifted to 3.14; Docker uses 3.11-slim |
| | FastAPI | 0.141.1 | >=0.109.0 | ⚠️ Unpinned range; version drift |
| | SQLAlchemy | 2.0.52 | >=2.0.0 | 2.0 style, sync sessions |
| | psycopg2-binary | present | 1.1.33 | PostgreSQL driver |
| | Pydantic | 2.13.4 | >=2.5.0 | v2 models everywhere |
| | PyTorch | present | >=2.3.x | ML / adaptive difficulty; **no trained model file** |
| | scikit-learn | present | >=1.4.x | Unused in code |
| | XGBoost | 3.4.1 | >=2.0.x | Unused in code |
| | Uvicorn | 0.52.4 | >=0.27.x | ASGI server |
| | PyJWT | 2.13.0 | — | JWT signing |
| | bcrypt | present | — | Password hashing (12 rounds) |
| **Frontend** | React.js (web) | 18.3.0 | 18.3.0 | Web dashboard |
| | React (mobile) | 19.2.3 | — | Expo SDK 57 bundles React 19 |
| | React Native | 0.87.0 | 0.76.x | Mobile (Expo) — ⚠️ drift |
| | Vite | 5.4.10 | — | Web build tool |
| | Tailwind CSS | 3.4.17 | 3.4.17 | ⚠️ **Installed but unused** — all CSS is custom |
| | Chart.js / react-chartjs-2 | 4.4.7 / 5.3.1 | 4.x / 5.x | Analytics viz |
| **Database** | PostgreSQL | 15.x (Docker `postgres:15-alpine`) | 15.x | Primary source of truth |
| | SQLite | (local dev) | — | Used via `backend/.env` override |
| | MongoDB | — | 7.x | ⚠️ **Not implemented** — referenced in architecture only |
| **DevOps** | Docker | Compose v2 | latest | Containerization |
| | Git & GitHub | — | Latest | Version control; **zero commits** |
| | GitHub Actions | — | Latest | ⚠️ **Not implemented** — no CI/CD |
| **Mobile** | Expo | SDK ~57.0.15 | Latest | React Native framework |
| | Firebase Cloud Messaging | — | Latest | ⚠️ **Not wired** — token fetched, never registered |
| | Android Alarm Manager | — | Native | ⚠️ **Not implemented** |

---

## Architecture Topology

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

### Key Flows
1. **Alarm dismissal flow**: Mobile app → FastAPI `/api/v1/alarm/dismiss` → Validates JWT → Runs cognitive challenge → Verifies completion → Updates habit score → Syncs to PostgreSQL
2. **Data sync flow**: Mobile offline cache → Background sync → Idempotent upsert → PostgreSQL → Web dashboard real-time updates
3. **ML inference flow**: Backend → Load PyTorch model → `infer()` → Adaptive difficulty adjustment → Cache result

---

## PostgreSQL Relational Models / Schemas

All models defined in `backend/models.py` (SQLAlchemy 2.0 declarative):

### Core Tables
- **`users`** — email (unique, indexed), password hash, active/verified flags, timestamps
- **`roles`** — name (Unique: User/Wellness Coach/Admin), description
- **`user_roles`** — junction table for RBAC (Unique constraint on user_id+role_id)
- **`alarms`** — linked to user, alarm type, challenge_id FK, next_trigger, snooze count
- **`challenges`** — challenge type (Math/Logic/Memory/Word/Pattern/Riddle/QuickQuiz), difficulty (Beginner→Expert), active flag
- **`challenge_attempts`** — per-attempt tracking: correct/total, time_taken, completion status
- **`habit_scores`** — daily composite: wake-up consistency (35%), challenge completion (25%), snooze reduction (20%), sleep adherence (20%)

### Indexes (performance-critical)
- `ix_users_email_lower` — case-insensitive email lookup
- `ix_alarms_user_id` — fetch user's alarms
- `ix_alarms_next_trigger` — scheduled alarm queries
- `ix_challenges_type_difficulty` — challenge generation filtering
- `ix_challenge_attempts_user_challenge` — attempt history per user/challenge
- `ix_habit_scores_user_date` — daily habit tracking queries
- `ix_habit_scores_date` — aggregate habit analytics

### ER Diagram (Mermaid format)

```mermaid
erDiagram
    USER ||--|{ ALARM : owns
    USER ||--|{ CHALLENGE_ATTEMPT : attempts
    USER ||--|{ HABIT_SCORE : generates
    USER ||--|{ USER_ROLES : has
    ROLE ||--|{ USER_ROLES : assigns
    USER ||--|{ CHALLENGE : generates
    CHALLENGE ||--|{ CHALLENGE_ATTEMPT : has_attempts
    CHALLENGE ||--|{ ALARM : triggers
    ALARM ||--|{ CHALLENGE : uses_challenge

    USER {
        int id PK
        string email UK
        string hashed_password
        bool is_active
        bool is_verified
        datetime created_at
        datetime updated_at
    }

    ROLE {
        int id PK
        string name UK
        string description
    }

    USER_ROLES {
        int id PK
        int user_id FK
        int role_id FK
    }

    ALARM {
        int id PK
        int user_id FK
        string title
        string alarm_type
        datetime next_trigger
        bool is_enabled
        int challenge_id FK
        int times_snoozed
        datetime created_at
        datetime updated_at
    }

    CHALLENGE {
        int id PK
        string title
        text description
        string challenge_type
        string difficulty
        bool is_active
        datetime created_at
    }

    CHALLENGE_ATTEMPT {
        int id PK
        int user_id FK
        int challenge_id FK
        int attempt_number
        bool completed
        int correct_answers
        int total_questions
        datetime start_time
        datetime end_time
        int time_taken_seconds
        datetime created_at
    }

    HABIT_SCORE {
        int id PK
        int user_id FK
        string date YYYY-MM-DD
        int wake_up_consistency 0-100
        int challenge_completion 0-100
        int snooze_reduction 0-100
        int sleep_schedule_adherence 0-100
        int overall_score 0-100
        datetime created_at
    }
```

---

## API Contract Registry

All endpoints defined in `SRS.md` Section 7. Must match FastAPI `app.py` + Pydantic v2 models. Registry maintained in `context.md` for traceability.

### Backend Endpoints (grouped by feature module)

| Path | Method | Description | Auth | Request Schema | Response | Status |
|---|---|---|---|---|---|---|
| `/api/v1/auth/register` | POST | User registration | None | `AuthRegisterReq` | `AuthRes` | ✅ Working |
| `/api/v1/auth/login` | POST | JWT login | None | `AuthLoginReq` | `AuthRes` | ✅ Working |
| `/api/v1/auth/me` | GET | Current user profile | Bearer | None | `UserProfileRes` | ✅ Working |
| `/api/v1/alarms` | GET | List user's alarms | Bearer | — | `List[AlarmRes]` | ✅ Working |
| `/api/v1/alarms` | POST | Create alarm | Bearer | `AlarmCreateReq` | `AlarmRes` | ⚠️ `challenge_id`/type/difficulty/recurrence ignored |
| `/api/v1/alarms/{id}` | PUT | Update alarm | Bearer | `AlarmCreateReq` | `AlarmRes` | ✅ Working |
| `/api/v1/alarms/{id}` | DELETE | Delete alarm | Bearer | — | `{"deleted": true}` | ✅ Working |
| `/api/v1/alarms/{id}/dismiss` | POST | Dismiss alarm with challenge | Bearer | `AlarmDismissReq` | `DismissRes` | 🔴 Broken end-to-end (no attempt creation path; mobile payload mismatch) |
| `/api/v1/alarms/{id}/snooze` | POST | Snooze alarm (+5 min, cap 5) | Bearer | — | `AlarmRes` | ✅ Working |
| `/api/v1/challenges` | GET | List available challenges | Bearer | — | `List[ChallengeListRes]` | ✅ Working |
| `/api/v1/challenges/next` | GET | Get next adaptive challenge | Bearer | — | `ChallengeRes` | ⚠️ Answer leaked in payload |
| `/api/v1/habits/score` | GET | Get habit score | Bearer | — | `HabitScoreRes` | ✅ Working (response_model=dict) |
| `/api/v1/habits/score/history` | GET | Get habit score history | Bearer | `days` query | `List[HabitScoreRes]` | ✅ Working |
| `/api/v1/analytics/me` | GET | User's analytics summary | Bearer | — | `AnalyticsRes` | ⚠️ Hardcoded placeholder values |
| `/api/v1/analytics/ml-status` | GET | ML inference diagnostics | Bearer | — | `dict` | ✅ Working |
| `/api/v1/challenges/submit` | POST | Submit challenge answer | Bearer | `ChallengeSubmitReq` | `ChallengeSubmitRes` | ❌ **MISSING — required for dismiss flow** |

### Mobile Sync Endpoints
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/sync/pending` | POST | Upload offline changes (idempotent upsert) | ✅ Server works; ❌ mobile never calls |
| `/api/v1/sync/pull` | GET | Download changes since timestamp | ✅ Server works; ❌ mobile never calls |

### Web Dashboard Endpoints
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/dashboard/users` | GET | List all users (Admin) | ⚠️ Admin auth is no-op |
| `/api/v1/dashboard/analytics` | GET | Platform-wide analytics (Admin) | ⚠️ Admin auth is no-op; uptime=99.9 placeholder |
| `/api/v1/dashboard/reports/habits` | GET | Habit report (CSV/JSON) | ✅ Working |
| `/api/v1/dashboard/reports/wake-up` | GET | Wake-up report (CSV/JSON) | ✅ Working |
| `/api/v1/dashboard/reports/challenges` | GET | Challenge report (CSV/JSON) | ✅ Working |

### Missing Endpoints (called by mobile, don't exist)
| Path | Method | Called From | Issue |
|---|---|---|---|
| `/api/v1/users/profile` | PUT | `mobile/src/screens/ProfileScreen.jsx:25` | 404 — no users router |
| `/api/v1/users/{key}` | PUT | `mobile/src/screens/SettingsScreen.jsx:28` | 404 — no users router |
| `/api/v1/habits/score` | PUT | `mobile/src/hooks/useHabitScore.jsx:33` | 405 — backend only has GET |

### Error Response Standard
All errors follow: `{ "detail": "human readable error", "error_code": "ERR_XXX", "timestamp": "ISO8601" }` — ⚠️ **currently only `detail` is returned; error_code/timestamp not implemented.**

---

## Active Tasks List (from PDF Milestones)

> ⚠️ **Status corrected 2026-09-05** — previously all milestones were marked `completed`. Deep codebase analysis showed this was inaccurate. The milestones below reflect **actual** implementation state.

| Milestone | Weeks | Status | Owner | Next Immediate Step |
|---|---|---|---|---|
| **Milestone 1** | 1–2 | `partial` | — | Auth + user model work; **RBAC not enforced**; profile update endpoints missing; CORS hardcoded `*`; JWT secret hardcoded |
| **Milestone 2** | 3–4 | `partial` | — | Challenge engine + adaptive difficulty work; **answer leak in payload**; template mismatch bugs; no `/challenges/submit` endpoint; mobile dismiss broken |
| **Milestone 3** | 5–6 | `partial` | — | Habit scoring 35/25/20/20 works; **analytics has hardcoded placeholders**; no trained ML model file (rule-based fallback only) |
| **Milestone 4** | 7–8 | `not started` | — | **No tests, no CI/CD, no deployment**; Dockerfile CMD broken; migrations stale; web charts mocked; mobile offline/notifications not implemented |

### Session Continuity Log
| Date (UTC) | Actor | Action | Outcome | References |
|---|---|---|---|---|
| 2026-08-23 | architect | Project init: created dirs, skills, scaffolding | Success | This file |
| 2026-08-31 | architect | PDF spec audit + discrepancy matrix completed | Success | This file |
| 2026-08-31 | architect | Implementation roadmap documented | Success | This file |
| 2026-08-31 | architect | Phase 1: Auth + User model (bcrypt, JWT HS256, get_current_user) | Success | `backend/app/api/auth.py`, `backend/app/services/auth.py`, `backend/app/schemas/auth.py`, `backend/app/Models.py` |
| 2026-08-31 | architect | Phase 2: Challenge engine (adaptive, /next endpoint, lambda serialization fix) | Success | `backend/app/services/challenge_service.py`, `backend/app/api/challenges.py` |
| 2026-08-31 | architect | Phase 3: Habit scoring with 35/25/20/20 weighted composite | Success | `backend/app/api/habits.py` |
| 2026-08-31 | architect | Phase 4: Alarm dismissal (challenge verify, snooze, next_trigger, recurring) | Success | `backend/app/api/alarms.py` |
| 2026-08-31 | architect | Phase 5: Offline sync (idempotent upsert, push/pull) | Success | `backend/app/api/sync.py` |
| 2026-08-31 | architect | Phase 6: Dashboards & reports (admin analytics, CSV export) | Success | `backend/app/api/dashboard.py`, `backend/app/api/analytics.py` |
| 2026-08-31 | architect | Phase 7: ML inference (PyTorch DifficultyPredictor, rule-based fallback) | Success | `backend/app/services/ml_inference.py` |
| 2026-09-05 | architect | Deep multi-agent codebase analysis: architecture, backend, frontend/mobile, testing/quality, infrastructure | Completed | See final report; corrected milestone statuses; created `HierarchicalRemediationPlan.md`, `Milestone.md`, `.gitignore`, `.gitattributes`; updated `SRS.md`, `README.md`, `PRD.md`, `context.md` |

---

## How to Restore Project State
1. Read this `context.md` file in full.
2. Verify directory layout matches: `backend/, mobile/, web/, .opencode/skills/, docker-compose.yml`
3. Check `context.md` → `Technology Stack Version Matrix` for exact package versions.
4. Check `context.md` → `Active Tasks List` for current milestone and next steps.
5. Check `context.md` → `API Contract Registry` for endpoint contracts.
6. Review the **Discrepancy Matrix** below to understand specification gaps.
7. Check `StagingNotes` → **`HierarchicalRemediationPlan.md`** for the level-by-level remediation plan (Levels 0–16).
8. Check **`Milestone.md`** for milestone definitions and evaluation criteria.
9. Execute the next immediate step from **Level 0** of `HierarchicalRemediationPlan.md`.
10. Run `docker-compose up -d` to start infrastructure (DB, API) after Level 0 fixes.
11. Execute the next immediate step from the Active Tasks List.

---

## Discrepancy Matrix: PDF Specification vs Current Implementation

### Authentication & Authorization
| Requirement | Status | Notes |
|---|---|---|
| FR-AUTH-001: Registration with bcrypt | ✅ Complete | `auth.py` uses `bcrypt.hashpw` with proper hashing |
| FR-AUTH-002: JWT login HS256 | ✅ Complete | Real JWT tokens via PyJWT with HS256 signing |
| FR-AUTH-003: RBAC User/Coach/Admin | 🔴 Not enforced | `Role`/`user_roles` tables exist; `_require_admin()` in `dashboard.py:22-26` returns `True` for everyone |
| FR-AUTH-004: JWT validation on endpoints | ✅ Complete | `get_current_user` dependency on all protected routes |
| NF-SEC-001: bcrypt min 12-round | ✅ Complete | `auth.py` service uses `bcrypt.hashpw` |
| NF-SEC-002: JWT secret from env | 🔴 Not compliant | `services/auth.py:17` hardcodes `SECRET_KEY`; never reads env |
| NF-SEC-003: JWT validation all endpoints | ✅ Complete | OAuth2PasswordBearer + get_current_user |
| NF-SEC-004: Pydantic v2 input validation | ✅ Complete | All endpoints use Pydantic v2 schemas |
| NF-SEC-005: CORS via env | 🔴 Not compliant | `main.py:20-27` hardcodes `["*"]`; no env read |

### User Profile & Habit Management
| Requirement | Status | Notes |
|---|---|---|
| FR-UP-001: Profile with wake-up time, sleep duration, timezone | ✅ Complete | `User` model has `full_name`, `timezone`, `difficulty_preference` |
| FR-UP-002: Daily habit scores 35/25/20/20 | ✅ Complete | Weighted composite computed from actual data in `habits.py` |
| FR-UP-003: Difficulty preference storage | ✅ Complete | `difficulty_preference` column stored and returned in profile |
| FR-UP-004: Sleep schedule & timezone | ✅ Complete | `timezone` stored; sleep adherence computed from alarm consistency |

### Alarm Scheduling System
| Requirement | Status | Notes |
|---|---|---|
| FR-AS-001: Alarm types enum | ⚠️ No constraint | `alarm_type` column accepts string; no enum validation |
| FR-AS-002: Recurring with recurrence rules | ✅ Complete | Daily/Weekday alarms auto-compute next_trigger on dismiss |
| FR-AS-003: Smart adaptive alarms | ✅ Complete | Challenge selection based on user performance history |
| FR-AS-004: Compute next_trigger | ✅ Complete | Auto-computed for Daily/Weekday; One-Time stays disabled |
| FR-AS-005: Snooze tracking | ✅ Complete | Snooze endpoint with cap at 5; tracked in habit scoring |
| **Alarm dismiss (end-to-end)** | 🔴 Broken | Mobile sends wrong payload; no `ChallengeAttempt` creation path exists; `create_alarm` ignores `challenge_id`/type/difficulty/recurrence |

### Cognitive Challenge Engine
| Requirement | Status | Notes |
|---|---|---|
| FR-CE-001: 7 challenge types | ✅ Complete | Math, Logic, Memory, Word, Pattern, Riddle, QuickQuiz templates |
| FR-CE-002: 5 difficulty levels | ✅ Complete | Beginner→Expert with adaptive selection |
| FR-CE-003: Adjust difficulty based on performance | ⚠️ Partial | ML inference (PyTorch) with rule-based fallback — **no trained model file, rule-based always active** |
| FR-CE-004: Validate completion threshold | 🔴 Bypassable | Correct `answer` leaked in `puzzle_payload`; no server-side submit/verify endpoint |
| FR-CE-005: Personalized selection | ⚠️ Partial | Rule-based adapts to success_rate, time, snoozes, streak; no ML file |
| FR-CE-006: Store description/metadata | ✅ Complete | Challenge model has title, description, generated_at |
| NF-PERF-002: Challenge < 100ms | ✅ Complete | Template-based generation is fast |

### Wake-Up Verification Module
| Requirement | Status | Notes |
|---|---|---|
| FR-WV-001: Challenge completion required | 🔴 Broken | Dismissal verifies `attempt.completed` but NO endpoint creates attempts; mobile payload doesn't match `AlarmDismissReq` |
| FR-WV-002: Multi-step challenges | ⚠️ Partial | Total questions configurable per challenge attempt |
| FR-WV-003: Consecutive correct answers | ⚠️ Partial | Streak computed in ML inference from attempt history |
| FR-WV-004: Time-based challenges | ⚠️ Partially documented | time_taken_seconds tracked |
| FR-WV-005: Record start_time/end_time | ✅ Complete | ChallengeAttempt tracks start_time, end_time, time_taken |

### Behavioral Analytics Engine
| Requirement | Status | Notes |
|---|---|---|
| FR-BA-001: Snooze pattern trends | ✅ Complete | Snooze reduction computed from 7-day rolling average |
| FR-BA-002: Wake-up behavior tracking | ✅ Complete | Wake-up consistency from alarm dismissal patterns |
| FR-BA-004: Sleep pattern analytics | ⚠️ Partial | `sleep_duration_avg = 7.5` hardcoded; `recent_activity` fake data |

### Dashboard & Analytics
| Requirement | Status | Notes |
|---|---|---|
| FR-DD-001: User Dashboard | ⚠️ Partial | Web charts use hardcoded mock data (`chartUtils.js`); silent fake fallback on errors |
| FR-DD-002: Wellness Coach Dashboard | ❌ Not implemented | No coach cohort filtering/UI exists |
| FR-DD-003: Admin Dashboard | ⚠️ Partial | Backend endpoints exist but admin RBAC is a no-op; **no admin UI page** |
| FR-REP-001: PDF habit reports | ⚠️ Partial | CSV/JSON export via `/dashboard/reports/habits`; **PDF not implemented** |
| FR-REP-002: Wake-up reports PDF/CSV | ⚠️ Partial | CSV/JSON export via `/dashboard/reports/wake-up`; **PDF not implemented** |
| FR-REP-005: All reports PDF + Excel | ⚠️ Partial | CSV + JSON exports; PDF/Excel not yet implemented |

### Offline-First Sync Protocol
| Requirement | Status | Notes |
|---|---|---|
| FR-OFF-001: Cache challenges locally | ⚠️ Schema defined | `offline-cache-schemas.ts` defined |
| FR-OFF-003: Idempotent background sync | ✅ Complete | `/sync/pending` with idempotent upsert for alarms, attempts, habits |
| FR-OFF-007: No data loss on retry | ✅ Complete | Upsert handles duplicates; conflict resolution via timestamp |
| NF-OFF-001: App functions fully offline | ⚠️ Partial | Server sync operational; mobile caching needs wiring |

### Error Handling & Standards
| Requirement | Status | Notes |
|---|---|---|
| NF-FT-003: Structured error responses | ⚠️ Partial | HTTPException with detail message; missing error_code/timestamp |
| NF-SEC-005: CORS configuration | ⚠️ `*` in dev | `allow_origins=["*"]` in `main.py`; TODO to replace with env |
| NF-SEC-007: Encryption at rest | ⚠️ Not implemented | No pgcrypto; dev uses SQLite |

---

## Active Tasks List (Updated)

| Milestone | Weeks | Status | Owner | Next Immediate Step |
|---|---|---|---|---|
| **Milestone 1** | 1–2 | `partial` | — | Fix authentication config (env-based JWT secret), complete RBAC enforcement, add user profile update endpoints |
| **Milestone 2** | 3–4 | `partial` | — | Remove answer leak from payload, fix template mismatch bugs, add `/challenges/submit`, align mobile dismiss contract |
| **Milestone 3** | 5–6 | `partial` | — | Replace hardcoded analytics values, wire web charts to `/habits/score/history`, remove mock fallbacks |
| **Milestone 4** | 7–8 | `not started` | — | Add test suite (pytest/vitest/jest-expo), CI/CD pipeline, fix Docker deployment, add notifications/offline sync |

### Session Continuity Log (2026-09-05 update)
| Date (UTC) | Actor | Action | Outcome | References |
|---|---|---|---|---|
| 2026-09-05 | architect | Deep multi-agent codebase analysis | Completed | See `SRS.md` Section 9–10, `HierarchicalRemediationPlan.md` |
| 2026-09-05 | architect | Created `Milestone.md`, `.gitignore`, `.gitattributes`, `HierarchicalRemediationPlan.md` | Success | Project root |
| 2026-09-05 | architect | Updated `SRS.md` (v1.1), `README.md`, `PRD.md`, `context.md` to reflect actual state | Success | Project root |

### Implementation Priority Order
1. **Level 0 — Repository Foundation** — `.gitignore`, `.gitattributes`, cleanup, initial commit
2. **Level 1 — Backend Security** — env-driven JWT secret, CORS config, EmailStr validation
3. **Level 2 — Schema Consolidation** — delete `schemas/all.py`, merge `schemas/auth.py` into `__init__.py`
4. **Level 3 — Database & Migrations** — fix `migrations/env.py` import, regenerate migration, add `create_all` fallback, seed script
5. **Level 4 — RBAC** — real `_require_admin()`, role assignment on registration
6. **Level 5 — Challenge Engine** — remove answer leak, fix template bugs, add `/challenges/submit`
7. **Level 6 — Alarm Dismiss Flow** — fix `create_alarm` challenge fields, align mobile contract, timezone handling, add `/users/profile`
8. **Level 7 — Analytics & Reports** — replace placeholders, add PDF/Excel export
9. **Level 8 — Error Handling** — structured errors `{detail, error_code, timestamp}`, logging
10. **Level 9 — Docker** — fix CMD, `load_dotenv` override, `.dockerignore`, compose healthchecks
11. **Level 10 — Web Dashboard** — remove mock data, wire history charts, admin UI, settings persistence
12. **Level 11 — Mobile Core Flow** — fix dismiss flow, challenge wiring, add registration/alarm-creation screens
13. **Level 12 — Notifications** — local scheduling, push registration, app assets
14. **Level 13 — Offline Sync** — SQLite cache, sync engine, screen wiring
15. **Level 14 — Testing** — pytest + httpx, vitest, jest-expo (70%+ coverage target)
16. **Level 15 — Linting & CI/CD** — Ruff, ESLint, mypy, GitHub Actions, pre-commit hooks
17. **Level 16 — Production Hardening** — monitoring, rate limiting, Sentry, performance fixes

> Full detail for every level: see **`HierarchicalRemediationPlan.md`**.