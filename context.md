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
| | reportlab | 5.0.1 | >=4.0.0 (added M4) | PDF report export |
| | openpyxl | 3.1.5 | >=3.1.0 (added M4) | Excel report export |
| | pytest | 9.1.1 | >=8.0.0 (added M4) | Test suite (`backend/tests/`, 34 tests) |
| | ruff | 0.16.6 | >=0.8.0 (added M4) | Linter (`backend/pyproject.toml`, E/F/W) |
| | PyTorch | present | >=2.3.x | ML / adaptive difficulty; **trained `backend/ml_models/difficulty_model.pt` (M3)** |
| | scikit-learn | present | >=1.4.x | Unused in code |
| | XGBoost | 3.4.1 | >=2.0.x | Unused in code |
| | Uvicorn | 0.52.4 | >=0.27.x | ASGI server |
| | PyJWT | 2.13.0 | — | JWT signing; **secret from env since M1** |
| | bcrypt | present | — | Password hashing (12 rounds) |
| **Frontend** | React.js (web) | 18.3.0 | 18.3.0 | Web dashboard |
| | React (mobile) | 19.2.3 | — | Expo SDK 57 bundles React 19 |
| | React Native | 0.86.3 | 0.76.x | Mobile (Expo) — ⚠️ drift |
| | Vite | 5.4.10 | — | Web build tool |
| | Tailwind CSS | 3.4.17 | 3.4.17 | ⚠️ **Installed but unused** — all CSS is custom |
| | Chart.js / react-chartjs-2 | 4.4.7 / 5.3.1 | 4.x / 5.x | Analytics viz |
| **Database** | PostgreSQL | 15.x (Docker `postgres:15-alpine`) | 15.x | Primary source of truth |
| | SQLite | (local dev) | — | Used via `backend/.env` override |
| | MongoDB | — | 7.x | ⚠️ **Not implemented** — referenced in architecture only |
| **DevOps** | Docker | Compose v2 | latest | Containerization |
| | Git & GitHub | — | Latest | Version control; `main` synced with `origin` (HEAD `7d736eb`, 2026-09-10) |
| | GitHub Actions | — | Latest | ✅ **Implemented (M4)** — `.github/workflows/ci.yml`: ruff + pytest + smokes + web test (Vitest 42) + web build + mobile jest (33) |
| **Mobile** | Expo | SDK ~57.0.15 | Latest | React Native framework |
| | Firebase Cloud Messaging | — | Latest | ⚠️ **Registration wired (P5 + 2026-09-07)** — Expo push token registered via `/notifications/register`; delivery provider still Noop (FCM/APNs pending) |
| | Android Alarm Manager | — | Native | ⚠️ **Backlog** — on-device local alarm scheduling (Levels 12/16) |

---

## Architecture Topology

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

### Key Flows
1. **Alarm dismissal flow**: Mobile app → FastAPI `/api/v1/alarms/{id}/dismiss` → Validates JWT → Runs cognitive challenge → Verifies completion → Updates habit score → Syncs to PostgreSQL
2. **Data sync flow**: Mobile offline cache → Background sync → Idempotent upsert → PostgreSQL → Web dashboard real-time updates
3. **ML inference flow**: Backend → Load PyTorch model → `infer()` → Adaptive difficulty adjustment → Cache result

---

## PostgreSQL Relational Models / Schemas

All models defined in `backend/app/Models.py` (SQLAlchemy 2.0 declarative):

### Core Tables
- **`users`** — email (unique, indexed), password hash, active/verified flags, timestamps
- **`roles`** — name (Unique: User/Wellness Coach/Admin), description
- **`user_roles`** — junction table for RBAC (Unique constraint on user_id+role_id)
- **`alarms`** — linked to user, alarm type, challenge_id FK, next_trigger, snooze count
- **`challenges`** — challenge type (Math/Logic/Memory/Word/Pattern/Riddle/QuickQuiz), difficulty (Beginner→Expert), active flag
- **`challenge_attempts`** — per-attempt tracking: correct/total, time_taken, completion status
- **`habit_scores`** — daily composite: wake-up consistency (35%), challenge completion (25%), snooze reduction (20%), sleep adherence (20%)
- **`push_tokens`** — push-notification tokens per user (unique token, platform, cascade delete)
- **`alarm_roles`** — cooperative alarm assignment junction (alarm_id ↔ role_id)

9 ORM tables total (incl. `push_tokens` + `alarm_roles`); 10 physical in a migrated DB (+ `alembic_version`).

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
    ALARM ||--|{ ALARM_ROLES : assigned_roles
    ROLE ||--|{ ALARM_ROLES : assigned_to_alarms
    USER ||--|{ PUSH_TOKEN : owns_push_tokens

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

    ALARM_ROLES {
        int id PK
        int alarm_id FK
        int role_id FK
    }

    PUSH_TOKEN {
        int id PK
        int user_id FK
        string token UK
        string platform
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
| `/api/v1/alarms/{id}/snooze` | POST | Snooze alarm (postpones next_trigger by 5 min — `max(now, scheduled)+5`, cap 5) | Bearer | — | `AlarmRes` | ✅ Working |
| `/api/v1/challenges` | GET | List available challenges | Bearer | — | `List[ChallengeListRes]` | ✅ Working |
| `/api/v1/challenges/next` | GET | Get next adaptive challenge (creates pending attempt; no answer leak) | Bearer | — | `ChallengeRes` (+`challenge_attempt_id`, `question_count`/`difficulty`/`challenge_type` query) | ✅ Working — no answer leakage (M2) |
| `/api/v1/habits/score` | GET | Get habit score | Bearer | — | `HabitScoreRes` | ✅ Working (response_model=dict) |
| `/api/v1/habits/score/history` | GET | Get habit score history | Bearer | `days` query | `List[HabitScoreRes]` | ✅ Working |
| `/api/v1/analytics/me` | GET | User's analytics summary | Bearer | — | `AnalyticsRes` | ✅ Working — real analytics computed (M3) |
| `/api/v1/analytics/ml-status` | GET | ML inference diagnostics | Bearer | — | `dict` | ✅ Working |
| `/api/v1/analytics/recommendations` | GET | Personalized recommendations (sleep/wake-up/habit/challenge) | Bearer | — | `List[RecommendationRes]` | ✅ Working (M3) |
| `/api/v1/challenges/submit` | POST | Submit challenge answer (server-authoritative verify) | Bearer | `ChallengeSubmitReq` | `ChallengeSubmitRes` | ✅ Working (M2) — verifies pending attempt, saves `user_answers`, marks complete |

### Mobile Sync Endpoints
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/sync/pending` | POST | Upload offline changes (idempotent upsert) | ✅ Server works; ✅ Mobile calls via `syncEngine.js` (2026-09-07) |
| `/api/v1/sync/pull` | GET | Download changes since timestamp | ✅ Server works; ✅ Mobile calls via `syncEngine.js` (2026-09-07) |

### Web Dashboard Endpoints
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/dashboard/users` | GET | List all users (Admin) | ✅ Working — RBAC enforced (staff+); admin UI page delivered (`web/src/pages/Admin.jsx`) |
| `/api/v1/dashboard/analytics` | GET | Platform-wide analytics (Admin) | ✅ Working — admin-only enforced; uptime=99.9 placeholder (M3) |
| `/api/v1/dashboard/reports/habits` | GET | Habit report (`format=csv|json|pdf|excel`) | ✅ Working (M4); `?async=1` + status (P4) |
| `/api/v1/dashboard/reports/wake-up` | GET | Wake-up report (`format=csv|json|pdf|excel`) | ✅ Working (M4); `?async=1` + status (P4) |
| `/api/v1/dashboard/reports/challenges` | GET | Challenge report (`format=csv|json|pdf|excel`) | ✅ Working (M4); `?async=1` + status (P4) |
| `/api/v1/dashboard/reports/status/{job_id}` | GET | Async report job status (`queued|running|completed|failed`) | ✅ Working (P4) |

### Notification & Auth Diagnostics Endpoints (P1/P5)
| Path | Method | Description | Status |
|---|---|---|---|
| `/api/v1/notifications/register` | POST | Register push token (idempotent; reassigns on ownership change) | ✅ Working (P5) |
| `/api/v1/notifications/register` | DELETE | Deregister push token | ✅ Working (P5) |
| `/api/v1/notifications/tokens` | GET | List user's push tokens | ✅ Working (P5) |
| `/api/v1/auth/register` | GET | Verification stub for email loop (diagnostic) | ✅ Working (P1) |
| `/api/v1/auth/login` | GET | Token inspector (diagnostic; leaks no secret) | ✅ Working (P1) |

### Missing Endpoints (called by mobile, don't exist)
| Path | Method | Called From | Issue |
|---|---|---|---|
| ~~`/api/v1/habits/score`~~ | ~~PUT~~ | ~~`mobile/src/hooks/useHabitScore.jsx`~~ | ✅ Resolved (M2) — `useHabitScore` now uses GET; habit scoring is server-computed and read-only |

### Error Response Standard
All errors follow: `{ "detail": "human readable error", "error_code": "ERR_XXX", "timestamp": "ISO8601", "status_code": N }` — ✅ **implemented (M4)** via global `StarletteHTTPException` + `RequestValidationError` handlers in `app/main.py` (additive: `detail` preserved, so all existing clients/smokes keep working).

---

## Active Tasks List (from PDF Milestones)

> ⚠️ **Status corrected 2026-09-05** — previously all milestones were marked `completed`. Deep codebase analysis showed this was inaccurate. The milestones below reflect **actual** implementation state.

| Milestone | Weeks | Status | Owner | Next Immediate Step |
|---|---|---|---|---|
| **Milestone 1** | 1–2 | `complete` | — | Done 2026-09-05: auth+RBAC enforced, env-based secrets/CORS, profile/settings APIs, timezone-aware alarm scheduling; see WP-A→F in continuity log below |
| **Milestone 2** | 3–4 | `complete` | — | Done 2026-09-06: server-authoritative challenge engine (no answer leak), `/challenges/submit`, wake-up verify dismiss gate, real challenge analytics, mobile E2E dismiss flow, `smoke_m2.py` 25/25 + `smoke_m1.py` 22/22. Next → Milestone 3 |
| **Milestone 3** | 5–6 | `complete` | — | Done 2026-09-06: analytics service refactor (real sleep/wake values), trained `difficulty_model.pt` (`ml-status model_loaded=true`), recommendation engine (4 categories, priority-sorted), streak-factored habit scoring, web dashboard wired to live data. Next → Milestone 4 |
| **Milestone 4** | 7–8 | `complete` | — | ✅ Core delivered 2026-09-07: pytest suite (34 tests, verified on 3.11+3.14), error envelope, GitHub Actions CI, Docker deployment fixed+up-tested (Postgres, migrations entrypoint, lean runtime image), Admin UI page, PDF/Excel reports, Ruff clean. **Architecture alignment P1–P7 landed 2026-09-07** (gateway hardening, service modularization, `ai_engine`, infra scaffolds, push-token notification API, §21 web nav, docs audit). **Frontend/mobile test coverage added 2026-09-07** (web Vitest 42, mobile jest-expo 33, wired into CI). **M4 backlog delivered 2026-09-07/08** (offline sync + push registration, web sidebar/theme UI pass + Profile, mobile AuthContext fix, `run_all` launcher, presentation, Milestone 3/4 notes). **M4 backlog (remaining)**: FCM/APNs delivery provider + on-device local alarm scheduling (Levels 12/16), broader flow-level alarm-dismiss coverage, real cloud deployment. Final presentation ✅ delivered (2026-09-07). |
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
| 2026-09-06 | architect | **M2 execution**: server-authoritative challenge service (deterministic templates, answer normalization, on-demand Challenge creation, pending ChallengeAttempt snapshot), `/challenges/submit`, no-answer-leak `/next`, tz-aware snooze, real challenge analytics, mobile E2E dismiss flow (useChallenge/Alarm/Challenge/Home + typo fix), `init_db.py` challenge seeding, `smoke_m2.py` 25/25 with alembic-on-fresh-DB, smoke_m1 22/22 regression | Success 2026-09-06 | `backend/app/services/challenge_service.py`, `backend/app/api/challenges.py`, `backend/app/api/alarms.py`, `backend/app/api/analytics.py`, `backend/app/schemas/__init__.py`, `backend/app/Models.py`, `migrations/versions/1c584bd4a5b0_*.py`, `backend/scripts/smoke_m2.py`, `backend/scripts/init_db.py`, `mobile/src/hooks/useChallenge.jsx`, `mobile/src/utils/api.js`, `mobile/src/screens/{Alarm,Challenge,Home}Screen.jsx`, `mobile/src/hooks/useHabitScore.jsx` |

---

## How to Restore Project State
1. Read this `context.md` file in full.
2. Verify directory layout matches: `backend/, mobile/, web/, docker-compose.yml`
3. Check `context.md` → `Technology Stack Version Matrix` for exact package versions.
4. Check `context.md` → `Active Tasks List` for current milestone and next steps.
5. Check `context.md` → `API Contract Registry` for endpoint contracts.
6. Review the **Discrepancy Matrix** below to understand specification gaps.
7. Removed docs are recoverable from git history (`ARCHITECTURE.md`, `CHANGELOG.md`, `Milestone.md`, `plan.md`, `HierarchicalRemediationPlan.md`, `UI_Wireframes.md`, `infrastructure/`, `presentation/`, `Completed Milestones/`, `.opencode/skills/`).
8. Run `docker-compose up -d` to start infrastructure (DB, API), or `run_all.bat` for the full stack (DB→backend→web→mobile).
9. Execute the next immediate step from the Active Tasks List.

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
| FR-DD-001: User Dashboard | ✅ Complete (M3/M4) | Dashboard page wired to real `/habits/score/history`; Home command-center with score ring + live alarm data |
| FR-DD-002: Wellness Coach Dashboard | ❌ Not implemented | No coach cohort filtering/UI exists |
| FR-DD-003: Admin Dashboard | ✅ Complete (M4) | Backend endpoints + RBAC (M1) + **admin UI page** (`web/src/pages/Admin.jsx`) |
| FR-REP-001: PDF habit reports | ✅ Complete (M4) | CSV/JSON/PDF/Excel via `/dashboard/reports/habits?format=…` |
| FR-REP-002: Wake-up reports PDF/CSV | ✅ Complete (M4) | CSV/JSON/PDF/Excel via `/dashboard/reports/wake-up?format=…` |
| FR-REP-005: All reports PDF + Excel | ✅ Complete (M4) | `/dashboard/reports/{habits,wake-up,challenges}` support `format=csv|json|pdf|excel` |

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
| NF-FT-003: Structured error responses | ✅ Complete (M4) | Global handlers return `{detail, error_code, timestamp, status_code}` |
| NF-SEC-005: CORS configuration | ✅ Compliant (M1+P1) | `CORS_ORIGINS` env parsed; credentials only with explicit origins; no wildcard in production |
| NF-SEC-007: Encryption at rest | ⚠️ Not implemented | No pgcrypto; dev uses SQLite |

---

## Active Tasks List (Updated)

| Milestone | Weeks | Status | Owner | Next Immediate Step |
|---|---|---|---|---|
| **Milestone 1** | 1–2 | `complete` | — | ✅ Delivered 2026-09-05 (WP-A→F): env JWT/CORS, RBAC enforced, profile/settings endpoints, tz-aware alarms, migration regen, seed+smoke scripts, web+mobile M1 wiring, initial git commit `bc31e9f` |
| **Milestone 2** | 3–4 | `complete` | — | ✅ Delivered 2026-09-06: server-authoritative challenge verification, `/challenges/submit`, no-answer-leak `/next`, E2E mobile dismiss, real challenge analytics; `smoke_m2.py` 25/25, M1 regression 22/22 |
| **Milestone 3** | 5–6 | `complete` | — | ✅ Delivered 2026-09-06: analytics service refactor, trained ML model + ml-status verification, recommendation engine (4 categories), streak-factored habit scoring, web real-data wiring (Home/Dashboard/Reports); smokes 22/22 + 25/25 green |
| **Milestone 4** | 7–8 | `complete` | — | ✅ Core delivered 2026-09-07: pytest suite (34 tests), error envelope, GitHub Actions CI, Docker up-test (Postgres + migrations + lean runtime image), Admin UI page, PDF/Excel reports, Ruff clean. **Architecture alignment P1–P7 landed 2026-09-07** (gateway hardening, service modularization, `ai_engine`, infra scaffolds, push-token notification API, §21 web nav, docs audit). **Frontend/mobile test coverage added 2026-09-07** (web Vitest 42, mobile jest-expo 33, wired into CI). **Backlog delivered 2026-09-07/08**: offline sync + push registration, web sidebar/theme UI pass + Profile, mobile AuthContext fix, `run_all` launcher, Milestone 3/4 notes. Final presentation ✅ delivered (2026-09-07). **Remaining**: FCM/APNs delivery provider + on-device local alarm scheduling (Levels 12/16), broader flow-level alarm-dismiss coverage, real cloud deployment |

### Session Continuity Log (2026-09-05 update)
| Date (UTC) | Actor | Action | Outcome | References |
|---|---|---|---|---|
| 2026-09-05 | architect | Deep multi-agent codebase analysis | Completed | See `SRS.md` Section 9–10, `HierarchicalRemediationPlan.md` |
| 2026-09-05 | architect | Created `Milestone.md`, `.gitignore`, `.gitattributes`, `HierarchicalRemediationPlan.md` | Success | Project root |
| 2026-09-05 | architect | Updated `SRS.md` (v1.1), `README.md`, `PRD.md`, `context.md` to reflect actual state | Success | Project root |
| 2026-09-05 | architect | **M1 execution (WP-A→F)**: UI wireframes, migration/env/Docker fixes, `deps.py` RBAC, `init_db.py`+`smoke_m1.py`, profile/settings APIs, timezone-aware alarm scheduling (+`time` in response), web chart wiring, HTTP end-to-end verified (06:45 NY → 10:45 UTC), migration regenerated (`732e5cb49bcf`), alembic added to requirements, **initial commit `bc31e9f`** | Success 2026-09-05 | WP-B: `migrations/env.py`, `backend/Dockerfile`, `.dockerignore`; WP-C: `app/api/deps.py`; WP-D: `app/api/users.py`, profile cards; WP-D20: web dashboard real charts; WP-E: `app/api/alarms.py` rewrite; WP-F: scripts + migration + commit |
| 2026-09-05 | architect | Docs refresh post-M1 (README/SRS-v1.2/PRD/context/Milestone/HRP), stale artifact cleanup (`test_run.bat` removed), `.env.example` DATABASE_URL note, `.gitattributes` +`*.docx`, first remote push | Docs updated; push pending | `SRS.md`, `PRD.md`, `README.md`, `context.md`, `Milestone.md`, `HierarchicalRemediationPlan.md`, `.gitattributes`, `backend/.env.example` |
| 2026-09-06 | architect | **M2 execution**: server-authoritative challenge engine, `/challenges/submit`, no-answer-leak `/next`, tz-aware snooze, real challenge analytics, mobile E2E dismiss flow + Home nav/typo fixes, 7×5 challenge seed, `smoke_m2.py` 25/25 + fresh-DB migration + `smoke_m1.py` 22/22 regression + web build + mobile Babel parse | Success 2026-09-06 | `backend/app/services/challenge_service.py`, `backend/app/api/challenges.py`, `backend/app/api/analytics.py`, `backend/app/api/alarms.py`, `backend/app/schemas/__init__.py`, `backend/app/Models.py`, `migrations/versions/1c584bd4a5b0_add_challenge_attempt_answer_data.py`, `backend/scripts/{smoke_m2,init_db}.py`, `mobile/src/{hooks,screens,utils}` |
| 2026-09-06 | architect | **Emulator→backend connectivity fix**: mobile dev could not reach uvicorn from Expo Go/emulator (POSTs canceled/`fetch request has been canceled`, IP churn `192.168…→10.22…`, emulator adb dropouts). Added `netconn` rescue: `backend/scripts/host_relay.py` (8090→8000), `backend/scripts/dev_up_all.ps1` (bring-up: backend+relay+emulator+adb reverses), `mobile` app now probes backend candidates with a body-POST and advances past dead ones (`api.js` POST-probe + skip-and-retry), `.env` → `http://localhost:8090` via `adb reverse`, Expo Go opened via `exp://localhost:8081` (adb) to avoid LAN/HMR warning. Verified: relay+direct host logins return tokens; emulator connects to relay+direct. | In progress — final on-screen login/Home check pending user | `backend/scripts/{host_relay,dev_up_all}.ps1|py`, `mobile/src/utils/api.js`, `mobile/.env`, `README.md` §4, this file |
| 2026-09-06 | architect | **Moved to physical-phone dev (emulator/adb abandoned)**: root cause of all mobile failures = API base hard-coded to emulator-only addresses (`localhost:8090` in `.env` + `10.0.2.2` candidates) — `localhost` means the device itself on a real phone → `ConnectException`, and Wi-Fi IP churn broke every fixed IP. `api.js` now derives backend host from `Constants.expoConfig.hostUri` (the LAN IP Expo Go used) → `http://<LAN-IP>:8000` primary, `:8090` relay fallback, env override blanked in `.env`. Metro running LAN mode on :8081; LAN-IP curl verified (packager `running`, backend 401). Firewall admin rules for 8000/8081 passed to user (UAC automation not possible from harness). | Done 2026-09-06; final phone verify pending user | `mobile/src/utils/api.js`, `mobile/.env`, `README.md` §4, this file |
| 2026-09-06 | architect | **Phone E2E bugfix (auth + habit score)**: physical phone reached backend over LAN (`[api] backend reachable at http://10.22.124.136:8000`) but Home showed `Invalid authentication credentials`. Root causes: (1) `useAuth` trusted any stored AsyncStorage token without validation → expired 60-min JWT → auto-login to Home → every authed call 401; (2) dev SQLite DB (`cerebrokognit.db`) predated M2 — `challenge_attempts` lacked `puzzle_payload`/`expected_answers`/`user_answers` → **any** attempt query 500'd (`habits/score` = Internal Server Error even with valid token). Fixes: `api.js` adds `onAuthExpired` 401 event bus; `useAuth` validates stored token via `/api/v1/auth/me` on startup (clears on 401, keeps on network error) + logs out on any 401; backend rebuilt with `scripts/init_db.py --reset` (fresh schema incl. M2 columns + reseed) and uvicorn restarted; verified `habits/score`→200 (63), history→200, alarms→1, challenges/next→200. | Done 2026-09-06 — phone re-login pending user | `mobile/src/hooks/useAuth.jsx`, `mobile/src/utils/api.js`, `backend/scripts/init_db.py`, `CONTEXT.md` |
| 2026-09-06 | architect | **M3 execution**: refactored analytics into `services/analytics_service.py` (sleep estimate from alarm gaps, tz-safe datetimes, 5-point band trend, per-type recent activity, streak-factored challenge completion capped at 10% of component, IntegrityError-guarded score writes); trained `backend/ml_models/difficulty_model.pt` via `scripts/train_difficulty_model.py` (synthetic rule-based dataset, 93.7% val acc; `ml-status` `model_loaded=true`); added `services/recommendation_service.py` + `RecommendationRes` + `GET /api/v1/analytics/recommendations` (sleep/wake-up/habit/challenge, priority-sorted, 4 categories verified); wired web to real data (`Home.jsx` + history charts via `buildHabitCharts`, removed static `chartUtils` series + hardcoded fallbacks, Dashboard recommendations panel, Reports `'—'` fallback removed); web `npm run build` clean; smoke_m1 22/22 + smoke_m2 25/25 green | Success 2026-09-06 | `backend/app/services/{analytics_service,recommendation_service}.py`, `backend/app/api/{analytics,habits,alarms}.py`, `backend/app/schemas/__init__.py`, `backend/scripts/train_difficulty_model.py`, `backend/ml_models/difficulty_model.pt`, `web/src/pages/{Home,Reports,Dashboard}.jsx`, `web/src/utils/chartUtils.js`, `Milestone.md`, `CONTEXT.md` |
| 2026-09-07 | architect | **M4 execution (backend/testing/deployment core)**: bumped `pytest>=8.0.0` w/ `pytest.ini`; wrote `backend/tests/` (conftest + auth/alarms/challenges/analytics) — **23 tests**; added global exception handlers in `app/main.py` → structured error envelope `{detail, error_code, timestamp, status_code}` (additive, `detail` preserved); created `.github/workflows/ci.yml` (ruff + pytest + smoke_m1 + smoke_m2 + web build); fixed Docker: root build context, `requirements-runtime.txt` (lean image, torch excluded → rule-based ML fallback), `docker-entrypoint.sh` runs `alembic upgrade head` before uvicorn, api healthcheck, root `.dockerignore`; **found & fixed latent Python-3.14-only bug** — `schemas/auth.py` defined `UserProfileRes` after `AuthRes` (PEP 749 deferred annotations on 3.14 mask it; 3.11 container crashed), reordered definitively; built + compose up-tested: Postgres healthy, migrations applied, register→login→challenge→habit→analytics→recommendations E2E 200s over HTTP, PDF (`%PDF`) + XLSX (`PK`) exports verified in container; full pytest suite verified on **Python 3.11 in container** (22→23 tests) + 3.14 locally; admin UI page `web/src/pages/Admin.jsx` (platform metrics, top challenge types, users table, RBAC-gated 403 panel) + `/admin` route + table CSS; PDF/Excel report export via `services/report_export.py` + `format=csv|json|pdf|excel` on `/dashboard/reports/{habits,wake-up,challenges}`; Ruff clean via `backend/pyproject.toml` (E/F/W pragmatic select) — 122 issues → 0 (removed dead code incl. dead `acc` var; E712 `==True/False` → `.filter(col)`/`.is_(True)`); reportlab 5.0.1 + openpyxl 3.1.5 added (venv + requirements); all regressions green | Success 2026-09-07 | `backend/tests/{conftest,test_auth,test_alarms,test_challenges,test_analytics}.py`, `backend/app/main.py`, `backend/app/services/report_export.py`, `backend/app/schemas/auth.py`, `backend/{Dockerfile,requirements-runtime.txt,docker-entrypoint.sh,pyproject.toml,pytest.ini}`, `.github/workflows/ci.yml`, `docker-compose.yml`, `.dockerignore`, `migrations/env.py`, `web/src/pages/Admin.jsx`, `web/src/App.jsx`, `web/src/index.css`, `Milestone.md`, `CONTEXT.md` |
| 2026-09-07 | architect | **M4 close-out**: docs updated for M4 core (README/PRD/SRS/Milestone/HRP/context); committed `e2cbe05` | Success | All root docs |
| 2026-09-07 | architect | **Fully-local mode (no DB server/cloud needed)**: added `services/bootstrap.py` — on startup, ONLY when `DATABASE_URL` targets SQLite, the app auto-creates tables + seeds roles/7×5 challenges/demo user (idempotent; `AUTO_INIT=0` disables). Postgres (Docker/cloud) never touched (alembic via entrypoint). Wired via `lifespan` in `main.py`. Verified: `Remove-Item *.db` → `TestClient` start → demo login 200, challenges/next 200, habits/score 200, analytics/me 200, health 200 on a fresh DB with zero setup. Note: the old dev `cerebrokognit.db` was deleted in testing and recreated fresh (phone-registered account not restored; demo seed present). | Success 2026-09-07 | `backend/app/services/bootstrap.py`, `backend/app/main.py`, `README.md`, this file |
| 2026-09-07 | architect | **Architecture alignment P1–P6 (approved `plan.md`)**: **P1** `gateway/` middleware (request-id + structured logging) + in-memory sliding-window rate limiter (`429`/`ERR_RATE_LIMIT`/`Retry-After`) + auth-diagnostics GET stubs + CORS → env config; **P2** services modularized into 11 domain modules (`user_service` w/ AuthService, `alarm_service`, `verification_service`, `habit_scoring_service`, `behavior_analytics_service`, `analytics_service` (facade), `report_service`, `admin_service`, `notification_service`, `adaptive_difficulty_service`, challenge/recommendation kept) with thin routers + facade shims (`services/auth.py` etc.); **P3** `ai_engine/` package (`interfaces.py` Protocols + `ENGINE_REGISTRY`, `difficulty.py` canonical ML engine, real adapters recommendation/challenge/behavior, planned stubs anomaly/performance; `services/ml_inference.py` torch-tolerant facade for lean Docker runtime); **P4** optional Redis adapter (`services/cache.py`, active only w/ `REDIS_URL`), `workers/` background-job interface, async reports (`?async=1` + `/dashboard/reports/status/{job_id}`), `infrastructure/` docs + ARCHITECTURE rows tightened; **P5** `PushToken` model + migration `992b0ec03dba` (also restores `ix_users_email_lower` missing from migration chain), `integrations/messaging.py` provider protocol + NoopProvider, `api/notifications.py` (`POST/DELETE /register`, `GET /tokens`; idempotent + ownership reassignment), 9 new pytest tests (32 total), fresh-DB migrate 0→head verified; **P6** `web/src/App.jsx` nav grouped Track/Plan/Account (§21) with tooltips, all destinations reusing existing pages. Gates green after every phase: ruff, pytest, smoke_m1, smoke_m2, `npm run build`. Commits: gateway/P1 pushed, `eefb126` (P2), `5bd6c39` (P3), `a1c69ac` (P4), `5c3a913` (P5), `c0ab496` (P6). | Success 2026-09-07 | `backend/app/{gateway,ai_engine,integrations,workers,services,cache}`, `backend/app/api/*`, `backend/app/Models.py`, `migrations/versions/992b0ec03dba_add_push_tokens.py`, `web/src/App.jsx`, `web/src/index.css`, `ARCHITECTURE.md`, `CHANGELOG.md`, `plan.md` |
| 2026-09-07 | architect | **P7 docs sync + §27 audit**: README/PRD/SRS/Milestone/context/ARCHITECTURE/CHANGELOG refreshed for P1–P6 reality; ARCHITECTURE matrix marks implemented ✅ / scaffold 🟡 / intentional-planned 🟥; final gate suite run (ruff · pytest 32 · smoke_m1 22 · smoke_m2 25 · web build · docker compose up + health) then commit + push. **P7 closes the architecture-alignment plan; M4 backlog (mobile offline/notifications/test coverage/deployment/presentation) remains.** | Success 2026-09-07 | All root docs, `plan.md`, this file |
| 2026-09-07 | architect | **Frontend/mobile test coverage (M4 backlog)**: **web** — added Vitest 2 + Testing Library + jest-dom (dev deps), `test` script (`vitest run`), `vite.config.js` `test` block + `src/test/setup.js` (jsdom + localStorage shim); tests: `chartUtils.test.js` (5 unit: all four series, snake_case data keys, label fallback, empty input) + `App.test.jsx` (§21 Track/Plan/Account groups + home data render) + `Dashboard.test.jsx` (real payload metrics + recommendation). **Tests caught & fixed real `buildHabitCharts` bug** — it keyed series by camelCase (`h['wakeUp']`) instead of the snake_case API contract (`wake_up_consistency`), so all four dashboard charts plotted `undefined`; now maps via `dataKey`. **mobile** — added jest-expo ~57 + jest + react-test-renderer + @testing-library/react-native, `test` script, jest `preset: jest-expo` config; SDK 57 peer-dep conflict (jest-expo wants `@react-native/jest-preset ^0.85`, RN 0.86 wants 0.86.0) resolved via package `overrides` `"@react-native/jest-preset": "0.86.0"` (official Expo workaround); tests: `utils/api.test.js` (10) + `hooks/useHabitScore.test.jsx` (4). 14 FE tests total. CI: `ci.yml` web job now runs `npm test` before build; new `mobile` job runs `npm test -- --ci`. Verified: web vitest 8/8 + build; mobile jest 14/14. Committed `0c4572d`. | Success 2026-09-07 | `web/{package.json,vite.config.js,src/test/setup.js,src/utils/chartUtils.js,src/utils/chartUtils.test.js,src/App.test.jsx,src/pages/Dashboard.test.jsx}`, `mobile/{package.json,src/utils/api.test.js,src/hooks/useHabitScore.test.jsx}`, `.github/workflows/ci.yml`, `README.md`, `CONTEXT.md`, `CHANGELOG.md` |
| 2026-09-07 | architect | **Mobile offline-first sync + push-notification wiring (M4 backlog)**: backend P5 (`/notifications/register`) + `/sync/*` were dead ends — mobile never called them. Added pure/injectable module layer, all jest-tested: `notifications/registerPush.js` (`acquireAndRegister`/`registerPushToken`/`getExpoPushToken` — lazy `expo-notifications` import, Expo-Go guard `{registered:false,reason:'expo-go'}`); `useAuth` now POSTs a fresh Expo token to `/api/v1/notifications/register` on login (`login` passes `access_token` explicitly). `sync/offlineStore.js` AsyncStorage-backed table store (`ck_offline_<table>`, tables alarms/habit_scores/challenge_attempts, `synced` flag); `sync/syncEngine.js` storage-agnostic `pushPending`/`pullServer`/`runSync` against idempotent `/sync/pending` + `/sync/pull`, marks accepted rows synced; `sync/useSync.js` hook (injectable store/request; `run`/`pushOnly`/`syncing`/`status`). `HomeScreen` caches alarms + habit score, falls back to cache with an offline banner, triggers sync on focus; `ChallengeScreen` caches challenge payload + completed attempt locally. `jest.setup.js` official AsyncStorage mock. 17 new tests → mobile suite **31/31**; Metro `expo export --platform android` bundles cleanly; backend pytest 32/32 unchanged. Committed `745186c`. | Success 2026-09-07 | `mobile/src/{notifications/registerPush.js,notifications/registerPush.test.js,sync/{syncEngine,offlineStore,useSync,syncRequest}.js,sync/{syncEngine,offlineStore}.test.js}`, `mobile/src/hooks/useAuth.jsx`, `mobile/src/screens/{HomeScreen,ChallengeScreen}.jsx`, `mobile/{package.json,jest.setup.js}`, `CONTEXT.md`, `CHANGELOG.md` |
| 2026-09-07 | architect | **Final capstone presentation (M4 backlog)**: built `presentation/CerebroKognit_Final.pptx` (15 slides, full speaker notes) via a reproducible `presentation/build_presentation.py` (python-pptx). Pyramid-ordered deck: title → agenda → problem → cognitive-verification loop → architecture → milestones → backend features → mobile/offline → ML → web/admin → validation (32+31+8 tests) → challenges solved → impact → roadmap → thanks. Docs updated (README Documentation row, context continuity) and committed. | Success 2026-09-07 | `presentation/{CerebroKognit_Final.pptx,build_presentation.py}`, `README.md`, `CONTEXT.md` |
| 2026-09-07 | architect | **Local-run footgun fixed + `dev.ps1` launcher**: root cause — launching uvicorn via `activate` + bare `uvicorn` from the repo root resolved to a **stray global Python 3.11** (no `sqlalchemy`), so the backend crashed at import and every `/api/v1/*` call through the Vite proxy failed with `ECONNREFUSED` for minutes. Fixes: (1) added root **`dev.ps1`** one-shot launcher that pins the exact `backend\.venv\Scripts\python.exe -m uvicorn` (never a bare-command interpreter), starts backend `:8000` + web `:5173`, optional `-Mobile` Metro `:8081`, waits for each port to bind, and reports status (`-BackendOnly`/`-WebOnly` switches); (2) removed the stray root `.venv` (Python 3.14 pure venv, gitignored, unreferenced — real venv is `backend/.venv`; caused the interpreter confusion); (3) documented the trap + quick-start in `README.md` §Local Setup. Verified: `dev.ps1` boots backend on a free port via pinned venv, `/health` 200, web-proxy `/api/v1/alarms` returns proper 401 (proxy → backend working, no ECONNREFUSED), all three ports up. | Success 2026-09-07 | `dev.ps1`, `README.md`, `context.md` |
| 2026-09-07 | architect | **Web session-validity bug fixed (stale/expired JWT → "everything is bad")**: dashboard showed "Test Account One" but every `/api/v1/*` call failed ("Could not load dashboard/alarms/challenges"). Root cause: `web/src/App.jsx` set `authed = !!localStorage.token` and **never validated the token** — an expired 60-min JWT (or a token whose user was wiped by a DB reset) left the user on the authed shell while every authed fetch 401'd. Backend itself was healthy (verified: login `demo@cerebro.com`/`password123` → all 6 data endpoints return 200). Fix mirrors the earlier mobile `useAuth` fix: on startup, `App.jsx` now calls `/api/v1/auth/me` with the stored token — 401/403 clears `localStorage` and shows the login page; network error keeps the session; success refreshes `localStorage.user`. Added regression test (invalid token → login page + token cleared) and made the nav test async to wait for session restore. Invalid-token path verified via test; backend routes verified 200 via curl. | Success 2026-09-07 | `web/src/App.jsx`, `web/src/App.test.jsx` |
| 2026-09-07 | architect | **Login page background → crisp full-bleed image**: the "blurry background" the user saw was actually pure CSS radial-gradient glows (fixed `body::before` + `.auth-hero` gradients) — the project had **zero** image assets. User confirmed: "Replace gradients with a crisp image." Created `web/public/login-bg.svg` (3 KB brand vector: deep-navy base, neural-net constellation, ripple arcs, circuit-chip detail, hairline grid — sharp flat-vector lines, **no blur/gaussian**); `.auth-hero` now uses `background: url('/login-bg.svg') no-repeat center / cover` (+ subtle dark scrim `::before` for legibility, `z-index` layered content above). Hero foreground forced light in both themes (`.auth-hero` scoped `--text` overrides) since the image stays dark in light mode. Removed the old gradient + light-theme gradient blocks. Vite emits `dist/login-bg.svg` (no base64 CSS bloat — moved out of `src/assets` into `public/`). Conflict: only touch `.auth-hero` rules; the `@media (max-width:960px)` `.auth-hero` override (padding/justify-content only) preserves the image. Gates green: Vitest **16/16**, `npm run build` clean (`login-bg.svg` verifiably emitted). | Success 2026-09-07 | `web/public/login-bg.svg`, `web/src/index.css` (.auth-hero 613–639), `CONTEXT.md` |
| 2026-09-07 | architect | **Auth components + full UI/UX refinement pass (web, non-auth pages)**: fixed `ThemeToggle.jsx` to use `useState` (auth pages now re-render sun/moon + aria-label correctly). Added `web/src/components/ui/` design system (`Icons.jsx` Lucide-style SVG set, `Badge`/`DifficultyBadge`, `ProgressBar`, `Toggle`, `Skeleton`/`CardSkeleton`/`GridSkeleton`, `EmptyState`, `ErrorState`). `index.css` token/radius overhaul (dark + light, 8-pt spacing, radii 8/10/14/16/20, plain-surface cards) + nav/shell/application styles; `App.jsx` shell rewritten (5 nav sections Track/Plan/Insights/Account/Administration, SVG brand, initials avatar "Hi, {name}", icon logout, mobile drawer rendered only when open). Pages rebuilt as one cohesive product: **Home** (score hero + real Next Alarm card + weighted progress bars + honest 7-day trend with "X of 7 days" note), **Dashboard** (real analytics summary + theme-aware charts + priority-sorted recommendations), **Alarms** (prominent time, status pill, snooze/delete, structured create form), **Challenges** (card hierarchy + per-type Start via `/challenges/next?challenge_type=&difficulty=`), **Reports** (score summary + real CSV/PDF/Excel exports + honest trend state when <2 days), **Profile** (new page: identity card + saved editable fields to `PUT /users/profile`), **Settings** (shared Toggle persisted to `/users/{key}`, real Dark/Light theme segmented control via `ck-theme`), **Admin** (delimited loading/denied/error states with ShieldIcon + refined tables/progress). Load-state headings use "Loading…" so data-driven tests wait for real payloads; array fetches guarded with `Array.isArray`. Gates green: Vitest **16/16** + `npm run build` clean. | Success 2026-09-07 | `web/src/App.jsx`, `web/src/index.css`, `web/src/utils/chartUtils.js`, `web/src/components/ui/*`, `web/src/pages/{Home,Dashboard,AlarmManagement,ChallengeGenerator,Reports,Settings,Profile,Admin}.jsx`, `web/src/components/auth/ThemeToggle.jsx`, `CONTEXT.md` |
| 2026-09-07 | architect | **Global sidebar + global theme switcher (web app shell redesign)**: Replaced the crowded horizontal top navigation (`nav.app-nav`) with a **fixed 248px left sidebar** (collapsible to 76px icons-only on desktop via `app-shell--collapsed`, persisted to `localStorage['ck-sidebar-collapsed']`). Sidebar contains: brand, §21 nav groups (Track/Plan/Insights/Account/Administration), **global `ThemeSwitcher`** segmented Light/Dark control (below nav, always visible), user area (avatar, name, email, logout). Created shared `theme.js` helper (`getTheme`/`setTheme`/`subscribeTheme`) so every theme control — sidebar switcher, auth `ThemeToggle`, Settings segmented — stays in sync via a single `data-theme` + `localStorage['ck-theme']` state; emitted a `ck-theme-changed` custom event + cross-tab `storage` listener. New shell structure: `<div.app-shell>` → `<Sidebar>` + `<div.app-main>` (offset `margin-left: var(--sidebar-width)`) + `<header.app-topbar>` (sticky mobile bar with hamburger + brand, visible only ≤1000px); `<button.sidebar-overlay>` backdrop closes the mobile drawer + ESC key handler + `body:has(.app-shell--drawer-open) { overflow:hidden }`. Sidebar collapsed state hides section labels, link text, theme label, user meta; keeps icon links, collapse toggle, compact theme icon buttons, logout. Tokens added to `:root` (`--sidebar-width`, `--sidebar-collapsed-width`, `--sidebar-bg`, `--sidebar-border`, `--nav-text`, `--nav-hover-bg`, `--nav-active-bg`, `--nav-active-text`) with light overrides (#fff sidebar, #dde2ee border, #4f5b73 nav text, indigo active). Profile layout tightened to `grid-template-columns: 280px minmax(0,560px)` with `max-width:920px`. All old nav CSS removed (`.app-nav`, `.nav-groups`, `.nav-link`, `.nav-drawer`). Tests: added 2 theme-switcher tests (switch + persist + restore); **Vitest 18/18**, `npm run build` clean (34.9KB CSS, 391KB JS). | Success 2026-09-07 | `web/src/{theme.js,navSections.js,App.jsx}`, `web/src/components/layout/Sidebar.jsx`, `web/src/components/ui/{ThemeSwitcher.jsx,Icons.jsx,index.js}`, `web/src/pages/Settings.jsx`, `web/src/components/auth/ThemeToggle.jsx`, `web/src/App.test.jsx`, `web/src/index.css`, `CONTEXT.md` |

| 2026-09-07 | architect | **Profile label wording/capitalization + one-terminal launcher**: (1) `Profile.jsx` labels normalized to the design reference — card heading "Profile details"→**"Profile Details"**, "Full name"→**"Full Name"** (Email/Time zone/Preferred difficulty already matched); Vitest **18/18** + build clean. (2) **`run_all.bat`** — launches the ENTIRE stack (**database → backend → web → mobile, mobile LAST**) in **one terminal** by invoking `run_all.ps1`: DB via `docker compose up -d db` (auto-falls back to local SQLite when the Docker daemon isn't running); backend via pinned `backend\.venv\Scripts\python.exe -m uvicorn app.main:app` on `:8000`; web `npm run dev` on `:5173`; mobile `npx expo start` on `:8081` **last**. Each service runs as a PowerShell job (`Start-Job`) whose output is streamed into the single console as colour-labelled `[backend]/[web]/[mobile]` lines; `Wait-Port` polls each service ready; Ctrl+C stops everything (Stop-Job + Stop-Process on the bound PIDs). Options: `-NoDb`, `-TimeLimitSec N` (auto-stop; used to verify in-harness). Verified end-to-end clean-state: all 4 launch, mobile block prints Metro "Waiting on http://localhost:8081" last, ports freed after stop. (Note: first event-handler streaming attempt crashed — `Process.Add_OutputDataReceived` has no runspace on worker threads — replaced with the job+Receive-Job pattern.) README Quick start updated. | Success 2026-09-07 | `run_all.bat`, `run_all.ps1`, `web/src/pages/Profile.jsx`, `README.md`, `CONTEXT.md` |
| 2026-09-07 | architect | **run_all QR-code fix**: Expo had been launched as a `Start-Job` (non-TTY) which suppresses the QR code the user needs for Expo Go. `run_all.ps1` now runs `npx expo start` in the **foreground** of the same console (still started **LAST**), so the QR + keyboard shortcuts (`a`/`w`/`r`/`q`) render exactly like a manual `expo start`; backend/web stay as jobs with labelled drain + `Wait-Port` readiness; Ctrl+C or `q` stops everything (Stop-Job + Stop-Process on bound PIDs). `-TimeLimitSec` keeps the job-based path for non-interactive/CI runs (no QR expected). Verified: all 3 ports bind, Metro/node runs as a foreground child of the main pwsh, `/health`+`/`+`/status` all 200, tree-kill cleanup clean. README Quick start updated. | Success 2026-09-07 | `run_all.bat`, `run_all.ps1`, `README.md`, `CONTEXT.md` |
| 2026-09-07 | architect | **Mobile login-stuck bugfix (unshared auth state)**: root cause — `useAuth()` was called **independently in 7 places** (`App.js` + all 6 screens), so each mounted its own private state; LoginScreen's `login()` succeeded server-side (evidenced by repeated `[api] backend reachable` + `Push registration skipped` console pairs) but `App.js`'s `isLoggedIn` never flipped → navigation stuck on Login until app **restart** (restart worked because `loadStoredAuth` read AsyncStorage). Fix: new `mobile/src/context/AuthContext.jsx` (`AuthProvider` + `useAuthContext`) — `App.js` wraps navigation in `<AuthProvider>`; all 6 screens (`Login/Home/Alarm/Challenge/Profile/Settings`) now consume `useAuthContext()` so login/logout/401-expiry notify the whole tree. Verified: jest **31/31**, Metro android bundle 200 (5.9MB dev). | Success 2026-09-07 | `mobile/src/context/AuthContext.jsx`, `mobile/App.js`, `mobile/src/screens/{Login,Home,Alarm,Challenge,Profile,Settings}Screen.jsx`, `CONTEXT.md` |
| 2026-09-08 | architect | **Full-project doc sync + gate verification (user-provided UI/UX pass committed)**: verified all gates live — `ruff` clean, `pytest` **32 passed**, `smoke_m1.py` **22/22**, `smoke_m2.py` **25/25**, web **Vitest 18/18** + `npm run build` clean (34.93KB CSS / 391.12KB JS, `login-bg.svg` emitted), mobile **jest 31/31**, `expo export` bundles clean. **Correction:** `smoke_m2.py` has **25 checks, not 28** (was misreported in earlier docs; script unchanged since `e2cbe05`) — normalized everywhere. Committed the user-made web UI pass (Commit A: sidebar app-shell, global theme `theme.js`, auth design system incl. `Auth.test.jsx`, Profile page, rebuilt pages), mobile `AuthContext` fix (`3dc82c6`), and `run_all` launcher (Commit C). **Doc updates (Phase 3, pending commit):** `Milestone.md` (M4 delivered + backlog-landed; evaluation criteria E2E ✅ via Docker+smokes), `PRD.md` (~80%→**~92%** completion; gaps refreshed), `SRS.md` (offline/push/testing/CI rows + matrices updated, v1.4), `HierarchicalRemediationPlan.md` (Level 12 🟡/13 ✅/14 ✅/15 🟡; remaining ~28h→**~14h**), `README.md` (module %s, Known Issues, M2 smoke 25/25), `ARCHITECTURE.md` (added offline-sync + app-shell rows 27/28, CI row incl. web test + mobile jest, §9 validation 18/31/25, updated date), `UI_Wireframes.md` §4.4 → implemented, plus stale `28/28`/test-count fixes across `CHANGELOG`/`context`/`Milestone`/`SRS`. **Remaining backlog:** FCM/APNs delivery provider + on-device local alarm scheduling (Levels 12/16), broader flow-level alarm-dismiss coverage, real cloud deployment. Committed `062dae1` (doc sync) — pushed `07cd2f3..062dae1` (6 commits: `a09c012` milestone notes · `8d1bb36` token-validation/dev.ps1 · Commit A web UI pass · `3dc82c6` mobile AuthContext · Commit C `run_all` launcher · `062dae1` doc sync). | Success 2026-09-08 | All root `.md`, `RUNME` gates, this file |
| 2026-09-08 | architect | **Launcher fix + full local run verified + config/doc refresh**: (1) **`run_all.ps1` fix** — Postgres path never waited for readiness or applied migrations (fresh Docker volume → backend 500s since `bootstrap.py` auto-inits SQLite only). Now: `docker compose up -d db` → poll `pg_isready` → `alembic upgrade head` with the compose DB URL (PS1-pinned venv, run from repo root so `alembic.ini` resolves); warn-and-continue on failure. (2) **Ran the whole stack** `run_all.bat` twice: DB up + **migrations applied** (Postgres verified 10 tables incl. `push_tokens`), backend `:8000` bound, web `:5173` (Vite ready), mobile Metro `:8081` "Waiting on http://localhost:8081" — all clean, services stopped after. (3) **Configs**: `.gitignore` (+`.ruff_cache/`, `coverage/`, dedupe `web-build/`), `.gitattributes` (+`*.pptx binary`, `*.svg text eol=lf`), `.dockerignore` (+`presentation/`, `Completed Milestones/`, `.idea/`, `.expo/`, junk zips/csvs/root `package-lock.json`, coverage dirs). (4) **Docs (targeted)**: README (Vitest (18), migration HEAD `992b0ec03dba`, mobile offline/push blurb, `EXPO_PUBLIC_API_URL` empty-override note, `run_all` auto-migration note, Documentation table → SRS v1.4 + ARCHITECTURE/CHANGELOG/plan/UI_Wireframes/infrastructure rows), SRS (header v1.4/2026-09-08 + revision row), `plan.md` (EXECUTED marker + smoke_m2 25/25), `context.md` (entry above → Success). Gates re-run + 2 commits (launcher+config, docs) + push. | Success 2026-09-08 | `run_all.ps1`, `.gitignore`, `.gitattributes`, `.dockerignore`, `README.md`, `SRS.md`, `plan.md`, this file |
| 2026-09-09 | architect | **Searchable timezone picker committed + snooze bug fix**: (1) picker follow-up committed `dbd4409` (11 files, Vitest 42/42, ruff clean, pytest 33). (2) **Snooze bugfix** — `snooze_alarm` set `next_trigger = now + 5min`, so snoozing a 7:00 AM alarm right after creating it at ~4:41 rewound the card to 4:46 (next_trigger display). Now `max(now, scheduled) + 5min` → 7:00→7:05, and now+5 only for alarms already ringing. Regression test `test_snooze_postpones_scheduled_alarm_by_five` (pytest 34, ruff clean); live-verified via API (07:00 IST → 01:35 UTC = 07:05 IST); backend restarted on :8000 (new code), web/test left running. Committed + pushed. | Success 2026-09-09 | `backend/app/services/alarm_service.py`, `backend/tests/test_alarms.py`, `CHANGELOG.md`, `CONTEXT.md` |
| 2026-09-10 | architect | **Sidebar logo → collapse-toggle morph on hover (web, ChatGPT/Gemini style)**: reworked the earlier hover-reveal — the header now shows only the CerebroKognit logo and, on hovering/keyboard-focusing `.sidebar-head`, the **logo crossfades into the collapse/expand chevron in place** (`opacity` + slight `scale`, ~0.18s, `:focus-within` a11y) instead of a second button appearing next to it. Both `.sidebar-brand` and `.sidebar-collapse` are absolutely anchored to the same slot (`left:4px; top:50%; translateY(-50%)`), head fixed at `height:36px; padding:0 0 20px`, hidden button `opacity:0; scale(.9); pointer-events:none` → hover `opacity:1; scale(1); pointer-events:auto`. Collapsed rail needs no special positioning anymore (previous chip-at-right + brand-shift overrides removed; LED still hidden). Mobile-drawer `display:none` (≤1000px) preserved. Gates: web **Vitest 42/42** + build clean (45.70KB CSS / 411.83KB JS). Committed + pushed. | Success 2026-09-10 | `web/src/index.css`, `CHANGELOG.md`, this file |
| 2026-09-10 | architect | **Retro-futuristic product-wide redesign (web + mobile)**: one design system across the whole ecosystem — brand palette `#F4A442`/`#3E7C17`/`#125C13`/`#E8E1D9`/`#0F1410`, flat design with no gradients or glow effects. **Web**: `index.css` brand token overhaul (dark+light) + retro component system (`.sys-label`, `.led`+pulse, card corner brackets, `.score-ring`, `.stat-strip`, alarm `.timeline`, `.countdown`, landing `.landing*` set); **landing page** `pages/Landing.jsx` (logged-out → `/`, `/auth` = login; hero "WAKE WITH PURPOSE." with live dashboard mock, 4 feature modules, 3-step protocol, CTA, footer); `navSections.js` IA v2 (Track/Plan/Insights/Account/Admin) + sidebar live LED; **Home = command-center dashboard** (score ring, Next-Alarm countdown card, stat strip, pillar weights, timeline, weekly trend, quick actions); brand `login-bg.svg` (deep-space + neural constellation + circuit chip). Updated `App.test.jsx` for new labels (Insights duplicates → `getAllByText`, 72 duplicated in ring+stat). **Mobile**: `theme/tokens.js` (BRAND palette + shared `ui` styles); **custom bottom nav HOME/ALARMS/INSIGHTS/PROFILE** (`components/MainTabs.jsx`, no new dep; RN-0.86 SafeAreaView from safe-area-context); **new screens**: `tabs/HomeTab` (score ring + next window + alarm queue), `tabs/AlarmsTab` (list + edit/delete), `screens/AlarmFormScreen` (create/edit chips: title, HH:MM, recurrence, challenge type, difficulty, question count — matches `AlarmCreateReq` `type`/`time` contract), `tabs/InsightsTab` (weighted pillars + 7-day track), `tabs/ProfileTab` (identity card + controls); restyled Login/Challenge/Alarm/Settings/Profile + App.js header deep-purple/orange loader; `@expo/vector-icons` jest stub (`jest.setup.js`); old `HomeScreen.jsx` removed. Gates: web **Vitest 42/42** + build clean (45.17KB CSS / 411.83KB JS), mobile **jest 33/33** + `expo export` bundles clean, backend pytest **34/34** + ruff clean (backend untouched). | Success 2026-09-10 | `web/src/{index.css,App.jsx,App.test.jsx,navSections.js,pages/{Home,Landing}.jsx,components/layout/Sidebar.jsx,public/login-bg.svg,utils/chartUtils.js}`, `mobile/{App.js,jest.setup.js,src/theme/tokens.js,src/components/MainTabs.jsx,src/components/MainTabs.test.jsx,src/screens/{Login,Challenge,Alarm,AlarmForm,Profile,Settings}Screen.jsx,src/screens/tabs/*}`, `CHANGELOG.md`, this file |
| 2026-09-08 | architect | **Timezone + 12/24-hour format system (web)**: **Backend** — `User.settings.time_format` ("12"/"24", default "12") via whitelisted `_SETTING_KEYS` (`PUT /api/v1/users/time_format`), returned in `GET /users/settings` (response_model → `Dict[str, object]`), `SettingsUpdateReq` extended, `test_time_format_setting` (default/valid/invalid-400/unknown-400) → pytest **33**. **Web** — `utils/timezones.js` (IANA catalog via `Intl.supportedValuesOf('timeZone')`, fallback + **guaranteed `UTC`/`Asia/Kolkata`** — this Node ICU emits 418 zones w/o `UTC` and uses legacy `Asia/Calcutta`), `utils/timeFormat.js` (`ck-time-format` store, `formatDateTime/formatDate/formatWeekday/formatTimeOfDay/parseTimeOfDay/toTimeInputValue`), `components/ui/LiveClock.jsx` (fixed top-right ticking clock, tz from `localStorage.user`), `components/ui/TimeInput.jsx` (12h → Hour/Minute/AM-PM selects, 24h → native time input, always emits `HH:MM`), `LiveZoneTime` inline readout; **pages wired**: Profile (catalog select + segmented 12/24 + save persists via PUT profile + `/users/time_format`, syncs `localStorage.user` + `setTimeFormat` broadcast), Auth register (catalog select), Home (alarm time/next per preference), AlarmManagement (TimeInput + formatted display), Admin (`formatDate`); CSS `.live-clock`/`.time-input`/`.tz-live`/`.tabular`/`.segmented--format`. **Searchable timezone picker added (`TimezonePicker.jsx`)**: click → scrollable dropdown + type-to-filter search by zone/city/region/offset and **plain country names** (`timeZoneTags()` alias map — "india" → Asia/Kolkata, "usa" → US zones; exact-country matches rank first, arrow/Esc/click-outside UX), wired into Profile + Auth register (replaces native 420-option select). Gates: web **Vitest 42/42** (TimezonePicker 6 · timezones 3 · timeFormat 6 · TimeInput 4 · LiveClock 2 · Profile 3 · rest unchanged) + `npm run build` clean (37.40KB CSS / 402.97KB JS), ruff clean, pytest **33**. Fixes during tests: lowercase `PM` in node ICU → case-insensitive matcher; TimeInput controlled-harness for onChange re-render; `Asia/Kolkata` missing from ICU zone list → guaranteed entries; "india" substring-matching `Indian/*` ocean zones → score-rank exact country matches first. Docs: CHANGELOG entry added. Committed `d84e5fb` (base system) + picker follow-up pending. | Success 2026-09-08 | `web/src/{utils/timezones.js,utils/timeFormat.js,components/ui/{LiveClock,TimeInput,TimezonePicker}.jsx,components/ui/index.js,pages/{Profile,Auth,Home,AlarmManagement,Admin}.jsx,App.jsx,index.css,+*.test.*}`, `backend/app/{schemas/__init__.py,services/user_service.py,api/users.py,tests/test_auth.py}`, `CHANGELOG.md`, this file |

| 2026-09-10 | architect | **Responsive + overflow pass across the whole web app (web)**: **Overflow kills** — every grid now uses `minmax(min(100%, Npx), 1fr)` tracks (`grid-cards` 300px / `grid-cards--metrics` 320px / `grid-cards--3` / `export-grid` / `form-grid` / `landing-grid`) + `min-width: 0` on all grid/flex children (`.grid-cards > *`, `.metric-grid > *`, `.stat-strip > *`, `.score-hero > *`, `.chart-card`, `.card`); `.app-shell` gets `overflow-x: clip` safety net (tables already self-scroll via `.table-wrap`). **Fixed-clock collision**: `.page` padding-top clears the pinned `LiveClock` (nowrap; compact top-right at 561–1000px so it never sits under the mobile topbar brand). **Dashboard**: loaded metrics row → new `.grid-cards--duo` (Overall Score + Analytics Summary side-by-side, stacked ≤900px); removed the `span-2` that left blank columns under the 4-col media; 4 charts now auto-fill (2×2 at ~1280, 3 at 1440, 4-across ≥1500px via `repeat(4, minmax(0,1fr))`); summary `metric-grid` → tidy 2×2 (1-col ≤560px). **Reports**: `.reports-grid` no longer `repeat(2,1fr)` on mobile (was an overflow source) — 1fr <1024px, 2×minmax(0,1fr) ≥1024; dropped undefined `span-2-s`; export buttons `flex:1 1 120px` consistent. **Admin**: denied state renders `.state-card` directly (no nested `<Card>`); **Profile** side col `minmax(0,1fr)`; **Alarms** rows stack ≤640px; **Settings** rows wrap on phones; **Challenges** action buttons pin to bottom (`margin-top:auto`) keeping equal-height cards; **Auth** hero h1 `clamp()` + form 420px + ≤560px compact brand band (benefits hidden via CSS, still in DOM — Auth tests untouched); **micro-interactions/a11y**: card hover elevation (light-theme shadow variant), `.quick-action:focus-visible`, `state-card--empty` centered 480px variant, `.page-header` standardized (`align-items:center`, 1.75rem h1, min-width-0 title). Gates: web **Vitest 42/42** + `npm run build` clean (47.69KB CSS / 411.77KB JS). No backend/mobile changes. Committed + pushed. | Success 2026-09-10 | `web/src/index.css`, `web/src/pages/{Dashboard,Reports,Admin}.jsx`, `CHANGELOG.md`, this file |

| 2026-09-10 | architect | **Responsive pass follow-up (web)**: Alarms/Challenges headers now use `.page-header__actions` wrapper (bulk action grouping, `margin-left:auto`, wrap on narrow widths, `flex-shrink:0` buttons — consistent alignment + never under the pinned live clock); `.page` horizontal padding 1.5rem at ≤1100px (was 2.5rem until 900); `.form-actions` flex-wrap on small phones. Gates: web **Vitest 42/42** + `npm run build` clean (47.82KB CSS / 411.88KB JS). No backend/mobile changes. | `web/src/index.css`, `web/src/pages/{AlarmManagement,ChallengeGenerator}.jsx`, `CHANGELOG.md`, this file |

| 2026-09-10 | architect | **Flat green/amber palette + no-glow redesign (web + mobile)**: whole product recolored to amber `#F4A442` / green `#3E7C17` / deep-green `#125C13` / cream `#E8E1D9` / space `#0F1410` (+ white/black) — replaces the orange/purple spectrum everywhere (tokens, Chart.js series, landing, `login-bg.svg`, stats, progress, badges, nav states, mobile `theme/tokens.js`). **No gradients, no glow**: every `linear/radial-gradient` flattened to solid fills (btn, brand marks, avatars, benefit dots, progress, skeleton, timeline, hero scrim + ambient body/landing glows removed); glow box-shadows removed (buttons, LED (now opacity blink), score ring, timeline dots); dark body bg is flat with only a subtle 1px grid-texture (kept as line texture, not color blend); flat `--grad`/`--grad-purple` vars keep dark/light theme-awareness for text-clip/border usages. Light theme now warm cream (`--bg:#E8E1D9`, white cards). Mobile primary buttons use near-black text on amber. Gates: web **Vitest 42/42** + build clean (45.98KB CSS / 411.87KB JS), mobile **jest 33/33** + expo export bundles clean. No backend changes. Committed + pushed. | `web/src/{index.css,utils/chartUtils.js,pages/Landing.jsx,public/login-bg.svg}`, `mobile/src/theme/tokens.js`, `mobile/src/{components,screens}/**`, `CHANGELOG.md`, this file |

| 2026-09-12 | architect | **Brand-purple purge: only Violet `#6844FD` · Violet-Dark `#4E28E0` · Mint `#58F6CA` site-wide (web + mobile, light + dark); deep violet `#7C3AED` and indigo `#4F46E5` removed entirely; emerald `#10B981`/rose `#EF4444` now semantic-only** (led to the earlier fixed `fb187ff` purple-only + `508921e` mint-streak commits, then this full purge): **Web CSS** — deleted `--c-indigo`/`--c-indigo-soft`/`--c-deep-violet` tokens + `--grad-emerald` (dead code); light `--grad-primary` `#7c3aed`→`#4E28E0`; removed `.hl--royal` (deep violet) + `#a78bfa` dark fallback; added dark-mode `#8b5cf6` lighter-violet fallback for `.hl--violet`/`.hl--deep` legibility; hero badge mint-soft; sys-label tones dropped `--indigo`/`--emerald`/`--deep` (added `--dark`; `--mint` → `--c-violet-light`); card-icon tones `--deep`→`--dark`, `--mint` glyph → `--c-violet-light`, `.lp-card--principle` tile violet-soft/violet-dark; pillar fills `--indigo`/`--emerald`/`--deep` → `--dark`; `.lp-chart__dot--last` + `.auth-visual__const` fill → mint; `.lp-final__inner--strong` gradient `#4E28E0→#6844FD` + violet shadow, btn text `--c-violet-dark`; footer sys-labels → `--c-violet`; streaks (`.streak-badge`, `.cc__streak`, `.lp-show__streak`, `.lp-stepmock__streak strong`, phone chip `.lp-show__phone-stat--streak`) → mint; new tone classes `.badge--mint`/`.pill-mint` + `.badge--dark`/`.pill-dark` + `.benefit-dot--dark`; **fixed accidental replaceAll regression** — reverted `.badge--success`/`.pill-success` back to emerald (semantic) while keeping `.streak-badge` mint. **JSX/pages** — `Hero.jsx` mornings `hl--royal`→`hl--violet`; `demo.js` FEATURES Cognitive→mint + Habit→dark, PILLARS Snooze cut→dark; `ChallengeGenerator.jsx` Memory badge `success`→`mint`; `AlarmManagement.jsx` Deep Recovery `success`→`warm`; `Badge.jsx` `DIFFICULTY_TONE` heat ladder → subtie/mint/brand/warm/dark (no green/red); `Home.jsx` + `Reports.jsx` challenge pillar `success`→`mint`; `BenefitList.jsx` item 3 `success`→`dark`; `LandingFooter.jsx` 4× `sys-label--indigo`→`--violet`; `LogoStory.jsx` copy "deep navy and indigo"→violet/violet-dark + alt text; stale amber comment in `AuthVisual.jsx`; `.auth-visual__const--green`→`--mint` (class + JSX). **`login-bg.svg`** — removed indigo `#6366f1`/`#818cf8` + cyan `#06b6d4` + decorative emerald from the neural constation; now violet `#6844FD` nodes/lines, mint `#58F6CA` accents, `glowMint` def, slate neutrals kept. **Mobile** — `tokens.js` removed unused `deepViolet`/`indigo`/`indigoSoft`/`lavender` (both themes) + comment updates; `ChallengeScreen.jsx` completion check `colors.violet`→`colors.emerald` (semantic correct); `SysLabel.jsx`/`ChipRow.jsx`/`BrandMark.jsx` comment fixes. **Governance** — `style.md` §§1/2.1/2.2/5/8/10 rewritten: 3 brand colors only, emerald/rose = semantic indicators, new landing pairing (Intelligent Alarms violet · Cognitive Challenges mint · Habit Tracking violet-dark · Personal Insights mint; pillars Wake-up violet · Challenges mint · Snooze cut violet-dark · Sleep mint), `#7c3aed`/`#4f46e5` ban, progress tones remapped. **Verified zero banned-hex hits** across web/mobile/style (grep sweep clean). Gates: web **Vitest 49/49** + build clean (84.79KB CSS / 487.98KB JS), mobile **jest 47/47**. Committed + pushed. | `web/src/{index.css,public/login-bg.svg,pages/{Home,AlarmManagement,ChallengeGenerator,Reports}.jsx,components/{ui/Badge.jsx,auth/{AuthVisual,BenefitList}.jsx,landing/{Hero,demo,LandingFooter,LogoStory,FinalCta,HabitChart}.jsx}}`, `mobile/src/{theme/tokens.js,screens/ChallengeScreen.jsx,components/ui/{SysLabel,ChipRow,BrandMark}.jsx}`, `style.md`, this file |
| 2026-09-12 | architect | **Hero/auth polish (web)**: (1) **Hero badge** — "Cognitive alarm system" wordmark now emerald-green (`--c-emerald`) on emerald-soft pill, matching the blinking green LED (semantic "live/on", per user request). (2) **Hero heading** — "center" and "mornings" dropped their highlight spans (`hl--deep`/`hl--violet`), so they render plain text color (white dark / near-black light); "intelligent" (violet) + "command" (mint) stay brand-colored. (3) **"See how it works"** button → new `.btn--mint` variant (mint `#58F6CA` fill, violet-dark text/label, violet-tinted lift shadow) in place of ghost. (4) **Auth page Back button** — `.auth-top` fixed cluster top-right next to the theme toggle: `<Link to="/">` chip with chevron + "Back" via `AuthLayout.jsx`; `.auth-top .theme-toggle` un-fixed scoped so the pair sits together; link returns to `/` (Landing). (5) **AuthVisual waveform enhanced** (user: "make the snake more perfect") — added faint ghost guide rails under both traces (full-row snakes readable edge-to-edge), bumped trace strokes (2.25/1.8), mint echo now carries its own leading pulse, each trace has a violet/mint leader pulse with two comet-tail followers (fading, trailing delays), subtle `drop-shadow` halos on the leaders (dark theme slightly stronger), nodes get a faint mint halo; new `auth-travel-2` keyframe; reduced-motion still kills every circle/path animation. **Tests** — `Auth.test.jsx` now renders inside `<MemoryRouter>` (needed for the new `<Link>`; 8 calls via `renderAuth()` helper) + new assertion for the Back link (href `/`, accessible name). Gates: web **Vitest 49/49** + build clean (86.78KB CSS / 488.72KB JS). Committed + pushed. | `web/src/components/landing/Hero.jsx`, `web/src/components/auth/{AuthLayout,AuthVisual}.jsx`, `web/src/pages/Auth.test.jsx`, `web/src/index.css`, `style.md`, `context.md` |
| 2026-09-12 | architect | **Login-page desktop breakage fix + mint button revert (web)**: (1) **Root cause of the broken full-screen login** — the previous edit inserted the `.auth-top`/`.auth-back` rules *inside* the `@media (max-width: 960px)` block and swallowed its closing brace, so on desktop (>960px) `.auth-top` lost `position:fixed`, became a normal grid child, and collapsed the 2-column `.auth-shell` into a 3-item grid mess (blank left panel, form+animation+words shoved right). Fixed by closing the media block after `.auth-mobile-brand` (`.auth-top` now base at all widths) and re-wrapping the `.theme-toggle { top:.75rem; right:.75rem }` override in its own `@media (max-width:960px)` (brace balance verified 827/827). (2) **"See how it works" button reverted** to the original `.btn-ghost` (mint removed per user); deleted now-unused `.btn--mint` CSS. Gates: web **Vitest 49/49** + build clean (86.62KB CSS / 488.72KB JS). Committed + pushed. | `web/src/index.css`, `web/src/components/landing/Hero.jsx`, this file |
| 2026-09-12 | architect | **Auth panel polish (web)**: (1) **Waveform full-width** — removed `max-width: 560px` (base) + 460px (short-viewport desktop) caps on `.auth-visual` so the dual-snake animation now stretches across the entire left brand panel. (2) **"Adaptive protocol" dash removed** — deleted `.auth-visual__label::before` 26px rule, label now reads plainly. (3) **Three benefit ticks unified** — removed the circular box effect (`benefit-dot` box/tone classes `--brand/--mint/--dark` deleted, `BenefitList.jsx` tone data dropped) and made every check mark mint `--c-violet-light` (`#58F6CA`) per user's preferred option. (4) **Back button matched to theme toggle** — `.auth-back` height now exactly 38px (same as `.theme-toggle`), `border-radius: var(--radius-full)` pill shape, `padding: 0 0.95rem` so both top-right controls align edge-to-edge. Gates: web **Vitest 49/49** + build clean (86.27KB CSS / 488.66KB JS), brace balance 822/822. Committed + pushed. | `web/src/index.css`, `web/src/components/auth/BenefitList.jsx`, this file |
| 2026-09-12 | architect | **Auth UI polish round 2 (web)**: (1) **Theme toggle → full circle** — base `.theme-toggle` `border-radius: var(--radius-full)` (38×38, circles on auth page + landing nav; world app unaffected). (2) **Pill workspace** — `.auth-form .form-control`, `.auth-form__actions .btn`, `.auth-tabs`, `.auth-tab` all `border-radius: var(--radius-full)` (inputs incl. difficulty select + tz picker trigger via shared `.form-control`); demo-account button `.auth-form > .btn-secondary` sized `width:100%; height:48px; font-size:.95rem; font-weight:600` (+ pill). (3) **Left brand panel structured** — `.hero-stat` cards standardized to `min-height:86px`, flex column centered, gap .35rem, `radius-lg`, `text-align:center` (7/5/ML cards now equal height); `.hero-note` full-width (dropped `max-width:44ch`) + `margin-top:.4rem`; `.auth-wake` card full-width (dropped `max-width:440px`) + `padding:1rem 1.1rem` so it aligns edge-to-edge with the stats grid; consistent `margin-top:.4rem` rhythm. (4) **Benefit ticks theme-aware** — `.benefit-dot` stays mint `--c-violet-light` in dark; `html[data-theme='light'] .benefit-dot { color: var(--c-violet) }` renders purple ticks in light mode. Gates: web **Vitest 49/49** + build clean (86.64KB CSS / 488.66KB JS), brace balance OK. Committed + pushed. | `web/src/index.css`, this file |
| 2026-09-12 | architect | **Dashboard shell revamp (web)** (user-approved Option A): (1) **Nav IA reorganized** — `navSections.js` now: **Overview** (Dashboard `/` · Analytics `/dashboard`, renamed from "Insights"), **Wake** (Alarms · Challenges, renamed from "Plan"), **Insights** (History), **Account** (Profile · Settings), **Administration** (Admin). Kills the "Insights-is-both-a-section-and-a-page" collision; topbar breadcrumb tag + mobile drawer derive from the same source. Landing footer product link `Insights`→`Analytics`. (2) **Sidebar logo behavior** — collapsed rail now shows only the centered brand mark; the expand chevron is hidden by default and crossfades in over the mark on `.sidebar-head:hover` / `:focus-within` (mark fades out, chevron scales in; keyboard-accessible Tab path preserved). Open state unchanged: full lockup (mark + wordmark + LED) + collapse chevron. (3) **Topbar decluttered** — brand logo removed (`.app-topbar__brand` + `.brand-logo--topbar` CSS deleted); left = hamburger (mobile) + breadcrumb tag only; right = new `.app-topbar__right` cluster `[live clock][circular theme toggle]` (reuses auth `ThemeToggle`, scoped `.app-topbar .theme-toggle { position: static }`). (4) **Theme control moved out of sidebar** — segmented `ThemeSwitcher` ("Appearance") removed from the sidebar footer; file + `ui/index.js` export deleted (dead code). Settings page segmented control kept. (5) **style.md compliance** — `.led--on` glow box-shadow removed (flat emerald opacity blink per §5); banned-hex sweep / leftover-class sweep clean (no `ThemeSwitcher|sidebar-theme|brand-logo--topbar|app-topbar__brand` refs). Docs synced (README nav line, style.md §8 + new §8.1 *App shell & navigation*, context.md). Gates: web **Vitest 49/49** + `npm run build` clean (87.27KB CSS / 487.74KB JS), CSS brace balance 830/830. Committed + pushed. | `web/src/{App.jsx,navSections.js,index.css,App.test.jsx}`, `web/src/components/{layout/Sidebar.jsx,ui/index.js,ui/ThemeSwitcher.jsx(deleted),landing/LandingFooter.jsx}`, `README.md`, `style.md`, `context.md` |
| 2026-09-12 | architect | **User-visible em-dash purge + Roboto re-verification (web)**: (1) **Em-dash sweep** — style.md §290 bans U+2014 in user-visible copy; a repo-wide grep showed it survived only in placeholders/fallbacks and one string *after* the Landing/Login passes. Replaced: `timeFormat.js` empty-state fallback `'—'`→`'-'` (3 spots: `formatDateTime`/`formatDate`/`formatTimeOfDay`), placeholder `'—'`→`'-'` in Admin (`u.created_at`), AlarmManagement (`'—:—'`→`'-:-'`), Home (2×), Dashboard (`?? '—'`→`?? '-'`), and `LiveChallengeSimulator` copy `'Incorrect — difficulty'`→`'Incorrect - difficulty'`. Middle-dot `·` separators intentionally kept (not banned). All remaining `—` exist only in code comments (allowed). Test `timeFormat.test.js` updated to expect `'-'`. Vitest **49/49**, build clean (87.38KB CSS / 487.79KB JS), braces 831/831. Committed `c6a28d8` + pushed. (2) **Roboto recheck** — full comparison (personality/x-height/weights/mono pairing/brand fit/legibility): **Plus Jakarta Sans retained** over Roboto — Roboto's Material-neutral look reads as generic against the retro-futuristic violet/mint brand; PJS geometric character matches the command-center aesthetic, taller x-height serves the dense admin tables; the one PJS concern (letter-spacing) already addressed by the `0.01em` body bump. Documented in style.md §3.1. | `web/src/utils/{timeFormat.js,timeFormat.test.js}`, `web/src/pages/{Admin,AlarmManagement,Home,Dashboard}.jsx`, `web/src/components/ui/LiveChallengeSimulator.jsx`, `style.md`, `context.md` |
| 2026-09-12 | architect | **Sidebar LED removal + typography air + arrow→dot pass (web follow-up)**: (1) **Green LED removed from open sidebar header** — the `.led.led--on` status dot next to "CerebroKognit" compressed/starved the wordmark; span deleted from `Sidebar.jsx`, `.sidebar-brand` `overflow:hidden`→`min-width:0`, collapsed `.led` selector dropped. Sidebar behavior unchanged & now pure: collapsed rail shows JustLogo.webp mark alone → hover/focus crossfades it into the expand chevron → click opens sidebar with the full mark+wordmark lockup at top (no LED). (2) **Typography air** — user asked for more letter/line spacing; kept **Plus Jakarta Sans** (documented over Poppins/Roboto in style.md §3.1: taller x-height, clean at 16px, has 300–800 weights) and bumped base `html/body` to `line-height: 1.7` + `letter-spacing: 0.01em`; doc rule added: long-form lines keep `≥1.6` line-height. (3) **Arrow→dot** — all decorative `→` glyphs in text lines → solid `.dot-bullet` (0.4rem circle, `currentColor`): Home + Dashboard suggested-action prefixes, Home "Configure schedules" link, Next Puzzle button, landing demo example (`→` now `·`). Trend glyphs `↑/↓` in `MetricCard` retained (semantic direction, style.md §3). Gates: web **Vitest 49/49** + `npm run build` clean (87.38KB CSS / 487.79KB JS), CSS brace balance 831/831. Committed + pushed. | `web/src/components/layout/Sidebar.jsx`, `web/src/components/ui/LiveChallengeSimulator.jsx`, `web/src/components/landing/demo.js`, `web/src/pages/{Home,Dashboard}.jsx`, `web/src/index.css`, `style.md`, `CONTEXT.md` |

### Implementation Priority Order
1. **Level 0 — Repository Foundation** — `.gitignore`, `.gitattributes`, cleanup, initial commit
2. **Level 1 — Backend Security** — env-driven JWT secret, CORS config, EmailStr validation
3. **Level 2 — Schema Consolidation** — delete `schemas/all.py`, merge `schemas/auth.py` into `__init__.py`
4. **Level 3 — Database & Migrations** — fix `migrations/env.py` import, regenerate migration, add `create_all` fallback, seed script
5. **Level 4 — RBAC** — real `_require_admin()`, role assignment on registration
6. **Level 5 — Challenge Engine** — remove answer leak, fix template bugs, add `/challenges/submit` ✅ **DONE (M2)**
7. **Level 6 — Alarm Dismiss Flow** — fix `create_alarm` challenge fields, align mobile contract, timezone handling, add `/users/profile` ✅ **DONE (M1 + M2)**
8. **Level 7 — Analytics & Reports** — real challenge analytics ✅ partial (M2) + recommendations ✅ (M3); **PDF/Excel export ✅ DONE (M4)**
9. **Level 8 — Error Handling** — structured errors `{detail, error_code, timestamp}` ✅ **DONE (M4)**; logging/observability not added (> Level 16)
10. **Level 9 — Docker** — fix CMD, `load_dotenv` override, `.dockerignore`, compose healthchecks ✅ **DONE (M4)**: root build context, lean runtime image (no torch), migrations entrypoint, api healthcheck, compose up-tested
11. **Level 10 — Web Dashboard** — remove mock data, wire history charts ✅ (M3); **admin UI page ✅ DONE (M4)**; settings persistence pending
12. **Level 11 — Mobile Core Flow** — fix dismiss flow, challenge wiring, add registration/alarm-creation screens ✅ (M2) — screens exist; polish pending
13. **Level 12 — Notifications** — server push-token API + mobile Expo-token registration ✅ DONE (P5 + 2026-09-07); **local scheduling + FCM/APNs delivery provider ⚠️ M4 backlog**
14. **Level 13 — Offline Sync** — SQLite/AsyncStorage cache + sync engine + screen wiring ✅ DONE (2026-09-07, but on-device E2E pending)
15. **Level 14 — Testing** — pytest + httpx ✅ backend (34 tests, 3.11+3.14 verified); **web Vitest (42) + mobile jest-expo (33) ✅ added 2026-09-07**; reminders: broader flow-level component coverage
16. **Level 15 — Linting & CI/CD** — Ruff ✅ (pyproject pragmatic E/F/W config, `ruff check app tests scripts` clean); ESLint/mypy ⚠️; **GitHub Actions ✅ DONE (M4)** (`ci.yml`: ruff + pytest (34) + smokes + web test (42)/build + mobile jest (33))
17. **Level 16 — Production Hardening** — monitoring, rate limiting, Sentry, performance fixes

> Full detail for every level: see **`HierarchicalRemediationPlan.md`**.
