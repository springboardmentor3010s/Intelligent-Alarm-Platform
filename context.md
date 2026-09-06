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
| | Alembic | 1.19.2 | >=1.13.0 (added M1) | Migrations regenerated & verified |
| | PyTorch | present | >=2.3.x | ML / adaptive difficulty; **trained `backend/ml_models/difficulty_model.pt` (M3)** |
| | scikit-learn | present | >=1.4.x | Unused in code |
| | XGBoost | 3.4.1 | >=2.0.x | Unused in code |
| | Uvicorn | 0.52.4 | >=0.27.x | ASGI server |
| | PyJWT | 2.13.0 | — | JWT signing; **secret from env since M1** |
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
| | Git & GitHub | — | Latest | Version control; **5 commits, HEAD `3dfe85a` (M2), pushed to `origin/main`** |
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
| `/api/v1/users/profile` | GET | Current user profile (users router) | Bearer | — | `UserProfileRes` | ✅ Working (M1) |
| `/api/v1/users/profile` | PUT | Update profile | Bearer | `UserProfileUpdateReq` | `UserProfileRes` | ✅ Working (M1) |
| `/api/v1/users/settings` | GET | Get user settings | Bearer | — | `UserSettingsRes` | ✅ Working (M1) |
| `/api/v1/users/settings` | PUT | Update settings (tx | Bearer | `UserSettingsUpdateReq` | `UserSettingsRes` | ✅ Working (M1) |
| `/api/v1/users/{key}` | PUT | Update scalar user field | Bearer | `UserFieldUpdateReq` | `UserProfileRes` | ✅ Working (M1) |
| `/api/v1/alarms` | GET | List user's alarms | Bearer | — | `List[AlarmRes]` | ✅ Working |
| `/api/v1/alarms` | POST | Create alarm | Bearer | `AlarmCreateReq` | `AlarmRes` | ✅ Working (M1: time/type/challenge/difficulty/recurrence wired) |
| `/api/v1/alarms/{id}` | PUT | Update alarm | Bearer | `AlarmCreateReq` | `AlarmRes` | ✅ Working |
| `/api/v1/alarms/{id}` | DELETE | Delete alarm | Bearer | — | `{"deleted": true}` | ✅ Working |
| `/api/v1/alarms/{id}/dismiss` | POST | Dismiss alarm with challenge | Bearer | `AlarmDismissReq` | `DismissRes` | ✅ Working end-to-end (M2) |
| `/api/v1/alarms/{id}/snooze` | POST | Snooze alarm (+5 min, cap 5) | Bearer | — | `AlarmRes` | ✅ Working |
| `/api/v1/challenges` | GET | List available challenges | Bearer | — | `List[ChallengeListRes]` | ✅ Working |
| `/api/v1/challenges/next` | GET | Get next adaptive challenge (creates pending attempt; no answer leak) | Bearer | — | `ChallengeRes` (+`challenge_attempt_id`, `question_count`/`difficulty`/`challenge_type` query) | ✅ Working — no answer leakage (M2) |
| `/api/v1/habits/score` | GET | Get habit score | Bearer | — | `HabitScoreRes` | ✅ Working (response_model=dict) |
| `/api/v1/habits/score/history` | GET | Get habit score history | Bearer | `days` query | `List[HabitScoreRes]` | ✅ Working |
| `/api/v1/analytics/me` | GET | User's analytics summary | Bearer | — | `AnalyticsRes` | ⚠️ Hardcoded placeholder values — M3 |
| `/api/v1/analytics/ml-status` | GET | ML inference diagnostics | Bearer | — | `dict` | ✅ Working |
| `/api/v1/analytics/recommendations` | GET | Personalized recommendations (sleep/wake-up/habit/challenge) | Bearer | — | `List[RecommendationRes]` | ✅ Working (M3) |
| `/api/v1/challenges/submit` | POST | Submit challenge answer (server-authoritative verify) | Bearer | `ChallengeSubmitReq` | `ChallengeSubmitRes` | ✅ Working (M2) — verifies pending attempt, saves `user_answers`, marks complete |

### Mobile Sync Endpoints
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/sync/pending` | POST | Upload offline changes (idempotent upsert) | ✅ Server works; ❌ mobile never calls |
| `/api/v1/sync/pull` | GET | Download changes since timestamp | ✅ Server works; ❌ mobile never calls |

### Web Dashboard Endpoints
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/dashboard/users` | GET | List all users (Admin) | ✅ Working — RBAC enforced (staff+); admin UI page still missing (M4) |
| `/api/v1/dashboard/analytics` | GET | Platform-wide analytics (Admin) | ✅ Working — admin-only enforced; uptime=99.9 placeholder (M3) |
| `/api/v1/dashboard/reports/habits` | GET | Habit report (CSV/JSON) | ✅ Working |
| `/api/v1/dashboard/reports/wake-up` | GET | Wake-up report (CSV/JSON) | ✅ Working |
| `/api/v1/dashboard/reports/challenges` | GET | Challenge report (CSV/JSON) | ✅ Working |

### Missing Endpoints (called by mobile, don't exist)
| Path | Method | Called From | Issue |
|---|---|---|---|
| ~~`/api/v1/habits/score`~~ | ~~PUT~~ | ~~`mobile/src/hooks/useHabitScore.jsx`~~ | ✅ Resolved (M2) — `useHabitScore` now uses GET; habit scoring is server-computed and read-only |

### Error Response Standard
All errors follow: `{ "detail": "human readable error", "error_code": "ERR_XXX", "timestamp": "ISO8601" }` — ⚠️ **currently only `detail` is returned; error_code/timestamp not implemented.**

---

## Active Tasks List (from PDF Milestones)

> ⚠️ **Status corrected 2026-09-05** — previously all milestones were marked `completed`. Deep codebase analysis showed this was inaccurate. The milestones below reflect **actual** implementation state.

| Milestone | Weeks | Status | Owner | Next Immediate Step |
|---|---|---|---|---|
| **Milestone 1** | 1–2 | `complete` | — | Done 2026-09-05: auth+RBAC enforced, env-based secrets/CORS, profile/settings APIs, timezone-aware alarm scheduling; see WP-A→F in continuity log below |
| **Milestone 2** | 3–4 | `complete` | — | Done 2026-09-06: server-authoritative challenge engine (no answer leak), `/challenges/submit`, wake-up verify dismiss gate, real challenge analytics, mobile E2E dismiss flow, `smoke_m2.py` 28/28 + `smoke_m1.py` 22/22. Next → Milestone 3 |
| **Milestone 3** | 5–6 | `complete` | — | Done 2026-09-06: analytics service refactor (real sleep/wake values), trained `difficulty_model.pt` (`ml-status model_loaded=true`), recommendation engine (4 categories, priority-sorted), streak-factored habit scoring, web dashboard wired to live data. Next → Milestone 4 |
| **Milestone 4** | 7–8 | `not started` | — | **No tests, no CI/CD, no deployment**; Dockerfile up-test pending; PDF/Excel reports; admin UI; mobile offline/notifications not implemented |

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
| 2026-09-06 | architect | **M2 execution**: server-authoritative challenge service (deterministic templates, answer normalization, on-demand Challenge creation, pending ChallengeAttempt snapshot), `/challenges/submit`, no-answer-leak `/next`, tz-aware snooze, real challenge analytics, mobile E2E dismiss flow (useChallenge/Alarm/Challenge/Home + typo fix), `init_db.py` challenge seeding, `smoke_m2.py` 28/28 with alembic-on-fresh-DB, smoke_m1 22/22 regression | Success 2026-09-06 | `backend/app/services/challenge_service.py`, `backend/app/api/challenges.py`, `backend/app/api/alarms.py`, `backend/app/api/analytics.py`, `backend/app/schemas/__init__.py`, `backend/app/Models.py`, `migrations/versions/1c584bd4a5b0_*.py`, `backend/scripts/smoke_m2.py`, `backend/scripts/init_db.py`, `mobile/src/hooks/useChallenge.jsx`, `mobile/src/utils/api.js`, `mobile/src/screens/{Alarm,Challenge,Home}Screen.jsx`, `mobile/src/hooks/useHabitScore.jsx` |

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
| FR-AUTH-003: RBAC User/Coach/Admin | ✅ Enforced (M1) | `require_roles()` in `app/api/deps.py`; staff/admin roles checked; 403 smoke-verified |
| FR-AUTH-004: JWT validation on endpoints | ✅ Complete | `get_current_user` dependency on all protected routes |
| NF-SEC-001: bcrypt min 12-round | ✅ Complete | `auth.py` service uses `bcrypt.hashpw` |
| NF-SEC-002: JWT secret from env | ✅ Compliant (M1) | `services/auth.py` reads `SECRET_KEY` from env (dev fallback remains) |
| NF-SEC-003: JWT validation all endpoints | ✅ Complete | OAuth2PasswordBearer + get_current_user |
| NF-SEC-004: Pydantic v2 input validation | ✅ Complete | All endpoints use Pydantic v2 schemas |
| NF-SEC-005: CORS via env | ✅ Compliant (M1) | `CORS_ORIGINS` env parsed in `core/config.py`; credentials only with explicit origins |

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
| **Alarm dismiss (end-to-end)** | ✅ Complete | Server-snapshot attempt → `/challenges/submit` → `/alarms/{id}/dismiss`; dismiss only after all-correct completion (smoke_m2 verified). Alarm creation fields (time/type/challenge/difficulty/recurrence/question_count) wired. |

### Cognitive Challenge Engine
| Requirement | Status | Notes |
|---|---|---|
| FR-CE-001: 7 challenge types | ✅ Complete | Math, Logic, Memory, Word, Pattern, Riddle, QuickQuiz templates |
| FR-CE-002: 5 difficulty levels | ✅ Complete | Beginner→Expert with adaptive selection |
| FR-CE-003: Adjust difficulty based on performance | ✅ Complete | ML inference (PyTorch) with rule-based fallback; trained `difficulty_model.pt` loaded (`ml-status model_loaded=true`) |
| FR-CE-004: Validate completion threshold | ✅ Complete | Server-authoritative `POST /challenges/submit` verifies against the stored attempt; `puzzle_payload` contains no answer (smoke_m2 no-leak check). |
| FR-CE-005: Personalized selection | ✅ Complete | ML model + rule-based adapts to success_rate, time, snoozes, streak (M3) |
| FR-CE-006: Store description/metadata | ✅ Complete | Challenge model has title, description, generated_at |
| NF-PERF-002: Challenge < 100ms | ✅ Complete | Template-based generation is fast |

### Wake-Up Verification Module
| Requirement | Status | Notes |
|---|---|---|
| FR-WV-001: Challenge completion required | ✅ Complete | Server creates the pending attempt at `/next`; dismiss verifies ownership + `completed` + all-correct (smoke_m2 verified: incomplete → 400, unknown → 404). |
| FR-WV-002: Multi-step challenges | ⚠️ Partial | Total questions configurable per challenge attempt |
| FR-WV-003: Consecutive correct answers | ⚠️ Partial | Streak computed in ML inference from attempt history |
| FR-WV-004: Time-based challenges | ⚠️ Partially documented | time_taken_seconds tracked |
| FR-WV-005: Record start_time/end_time | ✅ Complete | ChallengeAttempt tracks start_time, end_time, time_taken |

### Behavioral Analytics Engine
| Requirement | Status | Notes |
|---|---|---|
| FR-BA-001: Snooze pattern trends | ✅ Complete | Snooze reduction computed from 7-day rolling average |
| FR-BA-002: Wake-up behavior tracking | ✅ Complete | Wake-up consistency from alarm dismissal patterns |
| FR-BA-004: Sleep pattern analytics | ✅ Complete | `sleep_duration_avg` estimated from alarm overnight gaps or user preference; trend + recent activity computed from real data (M3) |
| FR-RE-001: Sleep improvement recommendations | ✅ Complete | Bedtime/wake-up 15-min adjustments based on sleep window + preference (M3) |
| FR-RE-002: Wake-up optimization suggestions | ✅ Complete | Optimal wake-up + challenge anchor from snooze count / attempt accuracy (M3) |
| FR-RE-003: Habit improvement guidance | ✅ Complete | Behavioral thresholds (e.g. "+20% completion") trigger coaching (M3) |
| FR-RE-004: Personalized challenge recommendations | ✅ Complete | Unattempted types + difficulty progression from accuracy history (M3) |

### Dashboard & Analytics
| Requirement | Status | Notes |
|---|---|---|
| FR-DD-001: User Dashboard | ⚠️ Partial | Dashboard page wired to real `/habits/score/history`; Home page still uses hardcoded mock data (`chartUtils.js`) — M3 |
| FR-DD-002: Wellness Coach Dashboard | ❌ Not implemented | No coach cohort filtering/UI exists |
| FR-DD-003: Admin Dashboard | ⚠️ Partial | Backend endpoints exist + RBAC enforced (M1); **no admin UI page** yet (M4) |
| FR-REP-001: PDF habit reports | ⚠️ Partial | CSV/JSON export via `/dashboard/reports/habits`; **PDF not implemented** (M4) |
| FR-REP-002: Wake-up reports PDF/CSV | ⚠️ Partial | CSV/JSON export via `/dashboard/reports/wake-up`; **PDF not implemented** (M4) |
| FR-REP-005: All reports PDF + Excel | ⚠️ Partial | CSV + JSON exports; PDF/Excel not yet implemented (M4) |

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
| **Milestone 1** | 1–2 | `complete` | — | ✅ Delivered 2026-09-05 (WP-A→F): env JWT/CORS, RBAC enforced, profile/settings endpoints, tz-aware alarms, migration regen, seed+smoke scripts, web+mobile M1 wiring, initial git commit `bc31e9f` |
| **Milestone 2** | 3–4 | `complete` | — | ✅ Delivered 2026-09-06: server-authoritative challenge verification, `/challenges/submit`, no-answer-leak `/next`, E2E mobile dismiss, real challenge analytics; `smoke_m2.py` 28/28, M1 regression 22/22 |
| **Milestone 3** | 5–6 | `complete` | — | ✅ Delivered 2026-09-06: analytics service refactor, trained ML model + ml-status verification, recommendation engine (4 categories), streak-factored habit scoring, web real-data wiring (Home/Dashboard/Reports); smokes 22/22 + 28/28 green |
| **Milestone 4** | 7–8 | `not started` | — | Add test suite (pytest/vitest/jest-expo), CI/CD pipeline, fix Docker deployment, add notifications/offline sync |

### Session Continuity Log (2026-09-05 update)
| Date (UTC) | Actor | Action | Outcome | References |
|---|---|---|---|---|
| 2026-09-05 | architect | Deep multi-agent codebase analysis | Completed | See `SRS.md` Section 9–10, `HierarchicalRemediationPlan.md` |
| 2026-09-05 | architect | Created `Milestone.md`, `.gitignore`, `.gitattributes`, `HierarchicalRemediationPlan.md` | Success | Project root |
| 2026-09-05 | architect | Updated `SRS.md` (v1.1), `README.md`, `PRD.md`, `context.md` to reflect actual state | Success | Project root |
| 2026-09-05 | architect | **M1 execution (WP-A→F)**: UI wireframes, migration/env/Docker fixes, `deps.py` RBAC, `init_db.py`+`smoke_m1.py`, profile/settings APIs, timezone-aware alarm scheduling (+`time` in response), web chart wiring, HTTP end-to-end verified (06:45 NY → 10:45 UTC), migration regenerated (`732e5cb49bcf`), alembic added to requirements, **initial commit `bc31e9f`** | Success 2026-09-05 | WP-B: `migrations/env.py`, `backend/Dockerfile`, `.dockerignore`; WP-C: `app/api/deps.py`; WP-D: `app/api/users.py`, profile cards; WP-D20: web dashboard real charts; WP-E: `app/api/alarms.py` rewrite; WP-F: scripts + migration + commit |
| 2026-09-05 | architect | Docs refresh post-M1 (README/SRS-v1.2/PRD/context/Milestone/HRP), stale artifact cleanup (`test_run.bat` removed), `.env.example` DATABASE_URL note, `.gitattributes` +`*.docx`, first remote push | Docs updated; push pending | `SRS.md`, `PRD.md`, `README.md`, `context.md`, `Milestone.md`, `HierarchicalRemediationPlan.md`, `.gitattributes`, `backend/.env.example` |
| 2026-09-06 | architect | **M2 execution**: server-authoritative challenge engine, `/challenges/submit`, no-answer-leak `/next`, tz-aware snooze, real challenge analytics, mobile E2E dismiss flow + Home nav/typo fixes, 7×5 challenge seed, `smoke_m2.py` 28/28 + fresh-DB migration + `smoke_m1.py` 22/22 regression + web build + mobile Babel parse | Success 2026-09-06 | `backend/app/services/challenge_service.py`, `backend/app/api/challenges.py`, `backend/app/api/analytics.py`, `backend/app/api/alarms.py`, `backend/app/schemas/__init__.py`, `backend/app/Models.py`, `migrations/versions/1c584bd4a5b0_add_challenge_attempt_answer_data.py`, `backend/scripts/{smoke_m2,init_db}.py`, `mobile/src/{hooks,screens,utils}` |
| 2026-09-06 | architect | **Emulator→backend connectivity fix**: mobile dev could not reach uvicorn from Expo Go/emulator (POSTs canceled/`fetch request has been canceled`, IP churn `192.168…→10.22…`, emulator adb dropouts). Added `netconn` rescue: `backend/scripts/host_relay.py` (8090→8000), `backend/scripts/dev_up_all.ps1` (bring-up: backend+relay+emulator+adb reverses), `mobile` app now probes backend candidates with a body-POST and advances past dead ones (`api.js` POST-probe + skip-and-retry), `.env` → `http://localhost:8090` via `adb reverse`, Expo Go opened via `exp://localhost:8081` (adb) to avoid LAN/HMR warning. Verified: relay+direct host logins return tokens; emulator connects to relay+direct. | In progress — final on-screen login/Home check pending user | `backend/scripts/{host_relay,dev_up_all}.ps1|py`, `mobile/src/utils/api.js`, `mobile/.env`, `README.md` §4, this file |
| 2026-09-06 | architect | **Moved to physical-phone dev (emulator/adb abandoned)**: root cause of all mobile failures = API base hard-coded to emulator-only addresses (`localhost:8090` in `.env` + `10.0.2.2` candidates) — `localhost` means the device itself on a real phone → `ConnectException`, and Wi-Fi IP churn broke every fixed IP. `api.js` now derives backend host from `Constants.expoConfig.hostUri` (the LAN IP Expo Go used) → `http://<LAN-IP>:8000` primary, `:8090` relay fallback, env override blanked in `.env`. Metro running LAN mode on :8081; LAN-IP curl verified (packager `running`, backend 401). Firewall admin rules for 8000/8081 passed to user (UAC automation not possible from harness). | Done 2026-09-06; final phone verify pending user | `mobile/src/utils/api.js`, `mobile/.env`, `README.md` §4, this file |
| 2026-09-06 | architect | **Phone E2E bugfix (auth + habit score)**: physical phone reached backend over LAN (`[api] backend reachable at http://10.22.124.136:8000`) but Home showed `Invalid authentication credentials`. Root causes: (1) `useAuth` trusted any stored AsyncStorage token without validation → expired 60-min JWT → auto-login to Home → every authed call 401; (2) dev SQLite DB (`cerebrokognit.db`) predated M2 — `challenge_attempts` lacked `puzzle_payload`/`expected_answers`/`user_answers` → **any** attempt query 500'd (`habits/score` = Internal Server Error even with valid token). Fixes: `api.js` adds `onAuthExpired` 401 event bus; `useAuth` validates stored token via `/api/v1/auth/me` on startup (clears on 401, keeps on network error) + logs out on any 401; backend rebuilt with `scripts/init_db.py --reset` (fresh schema incl. M2 columns + reseed) and uvicorn restarted; verified `habits/score`→200 (63), history→200, alarms→1, challenges/next→200. | Done 2026-09-06 — phone re-login pending user | `mobile/src/hooks/useAuth.jsx`, `mobile/src/utils/api.js`, `backend/scripts/init_db.py`, `CONTEXT.md` |
| 2026-09-06 | architect | **M3 execution**: refactored analytics into `services/analytics_service.py` (sleep estimate from alarm gaps, tz-safe datetimes, 5-point band trend, per-type recent activity, streak-factored challenge completion capped at 10% of component, IntegrityError-guarded score writes); trained `backend/ml_models/difficulty_model.pt` via `scripts/train_difficulty_model.py` (synthetic rule-based dataset, 93.7% val acc; `ml-status` `model_loaded=true`); added `services/recommendation_service.py` + `RecommendationRes` + `GET /api/v1/analytics/recommendations` (sleep/wake-up/habit/challenge, priority-sorted, 4 categories verified); wired web to real data (`Home.jsx` + history charts via `buildHabitCharts`, removed static `chartUtils` series + hardcoded fallbacks, Dashboard recommendations panel, Reports `'—'` fallback removed); web `npm run build` clean; smoke_m1 22/22 + smoke_m2 28/28 green | Success 2026-09-06 | `backend/app/services/{analytics_service,recommendation_service}.py`, `backend/app/api/{analytics,habits,alarms}.py`, `backend/app/schemas/__init__.py`, `backend/scripts/train_difficulty_model.py`, `backend/ml_models/difficulty_model.pt`, `web/src/pages/{Home,Reports,Dashboard}.jsx`, `web/src/utils/chartUtils.js`, `Milestone.md`, `CONTEXT.md` |

### Implementation Priority Order
1. **Level 0 — Repository Foundation** — `.gitignore`, `.gitattributes`, cleanup, initial commit
2. **Level 1 — Backend Security** — env-driven JWT secret, CORS config, EmailStr validation
3. **Level 2 — Schema Consolidation** — delete `schemas/all.py`, merge `schemas/auth.py` into `__init__.py`
4. **Level 3 — Database & Migrations** — fix `migrations/env.py` import, regenerate migration, add `create_all` fallback, seed script
5. **Level 4 — RBAC** — real `_require_admin()`, role assignment on registration
6. **Level 5 — Challenge Engine** — remove answer leak, fix template bugs, add `/challenges/submit` ✅ **DONE (M2)**
7. **Level 6 — Alarm Dismiss Flow** — fix `create_alarm` challenge fields, align mobile contract, timezone handling, add `/users/profile` ✅ **DONE (M1 + M2)**
8. **Level 7 — Analytics & Reports** — real challenge analytics ✅ partial (M2); PDF/Excel export still pending (M4)
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