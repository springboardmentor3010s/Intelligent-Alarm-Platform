# Milestone 1 Report — Intelligent Cognitive Alarm Platform

**Project:** CognitiveAlarm  
**Milestone:** M1 — Authentication, User Profile, Alarm Scheduling, UI Wireframes  
**Status:** ✅ Completed  
**Tech Stack:** Python 3.11 · FastAPI · PostgreSQL 16 · MongoDB 7 · Redis 7 · React 18 · Tailwind CSS · Docker

---

## 1. Objectives

Milestone 1 covered the foundational layer of the platform:

| # | Objective |
|---|-----------|
| 1 | Secure user registration and login with JWT authentication |
| 2 | Role-based access control (user, wellness_coach, admin) |
| 3 | User profile management with sleep schedule and habit preferences |
| 4 | Habit score calculation using a weighted formula |
| 5 | Full alarm CRUD with scheduling, snooze control, and toggle |
| 6 | Alarm session tracking |
| 7 | Responsive React UI with sidebar navigation and dark theme |
| 8 | Containerised infrastructure with Docker Compose |

---

## 2. Backend Implementation

### 2.1 Project Structure

```
backend/
├── app/
│   ├── api/          # Route handlers
│   ├── core/         # Config, JWT security
│   ├── db/           # PostgreSQL + MongoDB connections
│   ├── models/       # SQLAlchemy ORM models
│   ├── schemas/      # Pydantic request/response schemas
│   └── services/     # Business logic (challenge engine, adaptive engine, etc.)
├── alembic/          # Database migrations
└── requirements.txt
```

### 2.2 Configuration (`app/core/config.py`)

All settings are managed via `pydantic-settings` and loaded from a `.env` file:

| Setting | Default |
|---------|---------|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/cognitive_alarm` |
| `MONGO_URL` | `mongodb://localhost:27017` |
| `REDIS_URL` | `redis://localhost:6379` |
| `SECRET_KEY` | `change-this-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `ALLOWED_ORIGINS` | `["http://localhost:3000"]` |

### 2.3 Database Layer

**PostgreSQL** (`app/db/database.py`)  
- SQLAlchemy engine with `pool_pre_ping=True`, `pool_recycle=300`, `pool_size=5`, `max_overflow=10`  
- `get_db()` dependency yields a session with automatic rollback on error and guaranteed close  
- `create_tables()` called on startup to auto-create all tables

**MongoDB** (`app/db/mongo.py`)  
- Motor async client for analytics data  
- Lazy singleton initialisation  
- `close_mongo()` called on app shutdown

**Alembic** (`alembic/env.py`)  
- Migrations wired to `settings.DATABASE_URL`  
- All models imported to register metadata before migration runs  
- Supports both online and offline migration modes

### 2.4 Security (`app/core/security.py`)

| Feature | Implementation |
|---------|---------------|
| Password hashing | `bcrypt` via `passlib` |
| Access token | JWT, HS256, 30-minute expiry |
| Refresh token | JWT, HS256, 7-day expiry, `type: refresh` claim |
| Token decode | `python-jose`, raises 401 on invalid/expired |
| Auth dependency | `get_current_user` — validates token, checks `is_active` |
| Role guard | `require_role(*roles)` — raises 403 on insufficient permissions |

---

## 3. Data Models

### 3.1 User (`models/user.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `email` | String | Unique, indexed |
| `username` | String | Unique, indexed |
| `hashed_password` | String | Nullable (OAuth support) |
| `full_name` | String | Optional |
| `role` | Enum | `user`, `wellness_coach`, `admin` |
| `is_active` | Boolean | Default `True` |
| `is_verified` | Boolean | Default `False` |
| `oauth_provider` | String | e.g. `google` |
| `created_at` / `updated_at` | DateTime | Auto-managed |

Relationships: `profile` (one-to-one), `alarms` (one-to-many), both with cascade delete.

### 3.2 UserProfile (`models/profile.py`)

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | FK → users | Unique |
| `preferred_wake_time` | String | e.g. `"06:30"` |
| `preferred_sleep_time` | String | e.g. `"22:30"` |
| `sleep_duration_goal` | Float | Default `8.0` hours |
| `timezone` | String | Default `"UTC"` |
| `productivity_goals` | JSON | List of strings |
| `habit_preferences` | JSON | List of strings |
| `difficulty_preference` | Enum | `beginner` → `expert` |
| `habit_score` | Float | Computed, stored |
| `wake_consistency_score` | Float | Component score |
| `challenge_completion_score` | Float | Component score |
| `snooze_reduction_score` | Float | Component score |
| `sleep_adherence_score` | Float | Component score |

### 3.3 Alarm (`models/alarm.py`)

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | FK → users | |
| `label` | String | Default `"Wake Up"` |
| `alarm_time` | String | `"HH:MM"` format |
| `alarm_type` | Enum | `daily`, `weekday`, `weekend`, `one_time`, `smart_adaptive` |
| `repeat_days` | JSON | `[0..6]` Mon–Sun |
| `is_active` | Boolean | Default `True` |
| `snooze_limit` | Integer | Default `3` |
| `snooze_duration` | Integer | Minutes, default `5` |
| `challenge_type` | Enum | `math`, `logic`, `memory`, `word_game`, `pattern`, `riddle`, `quiz` |
| `challenge_count` | Integer | Challenges required to dismiss |
| `difficulty_override` | String | Optional manual override |
| `ringtone` | String | Default `"default"` |
| `vibration` | Boolean | Default `True` |
| `volume` | Float | `0.0–1.0`, default `0.8` |

### 3.4 AlarmSession (`models/alarm.py`)

Tracks each individual alarm trigger event.

| Column | Type | Notes |
|--------|------|-------|
| `alarm_id` | FK → alarms | |
| `user_id` | FK → users | |
| `triggered_at` | DateTime | Auto |
| `dismissed_at` | DateTime | Nullable |
| `status` | Enum | `active`, `snoozed`, `dismissed`, `missed`, `pending` |
| `snooze_count` | Integer | |
| `challenges_presented` | Integer | |
| `challenges_solved` | Integer | |
| `total_time_seconds` | Float | |
| `accuracy_rate` | Float | |

### 3.5 Challenge (`models/challenge.py`)

| Column | Type | Notes |
|--------|------|-------|
| `session_id` | FK → alarm_sessions | |
| `user_id` | FK → users | |
| `challenge_type` | Enum | |
| `difficulty` | Enum | |
| `question` | String | |
| `options` | JSON | For MCQ types |
| `correct_answer` | String | |
| `user_answer` | String | Nullable until answered |
| `is_correct` | Boolean | Nullable until answered |
| `time_taken_seconds` | Float | |
| `presented_at` / `answered_at` | DateTime | |

---

## 4. API Endpoints

### 4.1 Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | Public | Register new user, auto-creates profile |
| POST | `/login` | Public | OAuth2 form login, returns JWT pair |
| POST | `/refresh` | Public | Refresh access token using refresh token |
| GET | `/me` | JWT | Returns current user info |
| POST | `/logout` | JWT | Client-side logout (token removal) |

**Register flow:** Creates `User` + `UserProfile` in a single transaction using `db.flush()` before commit.

**Login flow:** Validates email + bcrypt password, checks `is_active`, returns `access_token` + `refresh_token`.

**Refresh flow:** Decodes refresh token, validates `type == "refresh"` claim, issues new token pair.

### 4.2 Alarms (`/api/alarms`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all alarms for current user |
| POST | `/` | Create new alarm |
| GET | `/{id}` | Get single alarm (ownership enforced) |
| PUT | `/{id}` | Update alarm fields |
| DELETE | `/{id}` | Delete alarm (204 No Content) |
| PATCH | `/{id}/toggle` | Toggle `is_active` on/off |
| GET | `/{id}/sessions` | Last 30 alarm sessions |
| POST | `/{id}/snooze` | Snooze with session tracking, enforces snooze limit |

All endpoints enforce ownership — queries always filter by `user_id == current_user.id`.

**Snooze logic:** Increments `session.snooze_count`, sets status to `SNOOZED`, returns remaining snoozes. Returns 400 if limit reached.

### 4.3 Profile (`/api/profile`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user profile |
| POST | `/` | Create profile (if not exists) |
| PUT | `/` | Update profile fields |
| GET | `/habit-score` | Computed habit score with breakdown |

**Habit Score Formula:**

```
Habit Score = wake_consistency_score  × 0.35
            + challenge_completion_score × 0.25
            + snooze_reduction_score  × 0.20
            + sleep_adherence_score   × 0.20
```

Response includes both the total score and the full breakdown per component.

---

## 5. Pydantic Schemas

### Auth Schemas (`schemas/auth.py`)
- `UserRegister` — email, username, password, optional full_name
- `TokenResponse` — access_token, refresh_token, token_type
- `RefreshTokenRequest` — refresh_token
- `UserResponse` — id, email, username, full_name, role, is_active, is_verified, profile_picture

### Alarm Schemas (`schemas/alarm.py`)
- `AlarmCreate` — all alarm fields with defaults
- `AlarmUpdate` — extends AlarmCreate, adds optional `is_active`
- `AlarmResponse` — adds id, user_id, is_active, created_at
- `AlarmSessionResponse` — session tracking fields

### Profile Schemas (`schemas/profile.py`)
- `ProfileCreate` / `ProfileUpdate` — sleep schedule, goals, difficulty
- `ProfileResponse` — adds id, user_id, all score fields

### Challenge Schemas (`schemas/challenge.py`)
- `ChallengeResponse` — question, options, type, difficulty (no answer exposed)
- `ChallengeSubmit` — challenge_id, user_answer
- `ChallengeResult` — is_correct, correct_answer, time_taken, message

---

## 6. Frontend Implementation

### 6.1 Project Structure

```
frontend/src/
├── pages/        # Login, Register, Dashboard, Alarms, Challenges, Profile, Analytics, AdminPanel
├── components/   # Layout, Sidebar, StatCard
├── context/      # AuthContext (JWT state)
├── services/     # api.js (Axios client)
└── hooks/        # (reserved for custom hooks)
```

### 6.2 API Client (`services/api.js`)

- Axios instance with `baseURL: "/api"`
- Request interceptor: attaches `Authorization: Bearer <token>` from localStorage
- Response interceptor: on 401, auto-refreshes token using refresh_token, retries original request; on failure, clears storage and redirects to `/login`

Exported API modules:

| Module | Methods |
|--------|---------|
| `authAPI` | register, login, me, logout |
| `profileAPI` | get, create, update, habitScore |
| `alarmAPI` | list, create, get, update, delete, toggle, sessions, snooze |
| `challengeAPI` | generate, submit |
| `analyticsAPI` | dashboard, trend, adminOverview |

### 6.3 Auth Context (`context/AuthContext.jsx`)

- Stores `user` state globally
- On mount: checks localStorage for token, calls `/api/auth/me` to restore session
- `login(email, password)` — calls API, stores tokens, fetches user
- `logout()` — clears localStorage, resets user state
- `loading` flag prevents flash of unauthenticated content

### 6.4 Routing & Layout (`App.jsx`, `components/Layout.jsx`)

- `BrowserRouter` with protected routes wrapped in `<Layout />`
- `Layout` checks `user` from AuthContext — redirects to `/login` if unauthenticated
- `RoleRoute` component — redirects to `/dashboard` if role not in allowed list
- `<Toaster />` from `react-hot-toast` for global notifications (dark theme styled)

### 6.5 Pages

#### Login (`pages/Login.jsx`)
- `react-hook-form` for validation
- Calls `useAuth().login()`, navigates to `/dashboard` on success
- Shows toast on error

#### Register (`pages/Register.jsx`)
- Full name, username, email, password, confirm password fields
- Password match validation via `watch()`
- Navigates to `/login` after successful registration

#### Dashboard (`pages/Dashboard.jsx`)
- Loads dashboard stats, 14-day wake-up trend, and habit score in parallel (`Promise.all`)
- Stat cards: Total Alarms, Success Rate, Avg Snoozes, Challenge Accuracy
- Line chart: Dismissed vs Snoozed over 14 days (Chart.js)
- Doughnut chart: Habit score breakdown by component
- Habit score progress bar

#### Alarms (`pages/Alarms.jsx`)
- Lists all user alarms with time, type, challenge info
- Toggle switch (on/off) per alarm
- Edit (modal) and Delete per alarm with confirmation
- `AlarmModal` component handles both create and edit with full form fields
- All 7 alarm types and all 7 challenge types selectable

#### Profile (`pages/Profile.jsx`)
- Displays user avatar (initial), name, email, role badge
- Sleep schedule: wake time, sleep time, duration goal, timezone
- Challenge difficulty: radio button selection (beginner → expert)
- Productivity goals: multi-select tag buttons
- Habit preferences: multi-select tag buttons
- Saves via PUT (update) or POST (create) depending on profile existence

### 6.6 Components

**Sidebar (`components/Sidebar.jsx`)**
- Navigation links: Dashboard, Alarms, Challenges, Profile, Analytics
- Role-based extra links: Admin Panel (admin), Coach Panel (wellness_coach)
- Active link highlighted with `NavLink` `isActive`
- User info footer with username, email, sign out button

**StatCard (`components/StatCard.jsx`)**
- Reusable card with icon, label, value, optional sub-text
- 5 colour variants: blue, green, yellow, red, purple

**Layout (`components/Layout.jsx`)**
- Auth guard — redirects to `/login` if no user
- Loading spinner while auth state resolves
- Sidebar + main content flex layout

---

## 7. Infrastructure

### Docker Compose (`docker-compose.yml`)

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| `postgres` | postgres:16-alpine | 5432 | Health check with `pg_isready` |
| `mongo` | mongo:7 | 27017 | Persistent volume |
| `redis` | redis:7-alpine | 6379 | Cache layer |
| `backend` | Custom (./backend) | 8000 | Depends on postgres health |
| `frontend` | Custom (./frontend) | 3000 | Depends on backend |

- Backend waits for PostgreSQL health check before starting (`condition: service_healthy`)
- Persistent volumes: `postgres_data`, `mongo_data`
- Environment variables injected at runtime (no secrets in image)

---

## 8. Milestone 1 Deliverables Checklist

| Deliverable | Status | Details |
|-------------|--------|---------|
| User Registration | ✅ | Email + username uniqueness check, auto profile creation |
| User Login | ✅ | bcrypt verification, JWT access + refresh tokens |
| Token Refresh | ✅ | Refresh token type validation, new pair issued |
| Role-Based Access | ✅ | user, wellness_coach, admin roles enforced |
| User Profile CRUD | ✅ | GET, POST, PUT with sleep schedule and goals |
| Habit Score API | ✅ | Weighted formula with 4-component breakdown |
| Alarm CRUD | ✅ | Create, Read, Update, Delete with ownership enforcement |
| Alarm Toggle | ✅ | PATCH endpoint flips is_active |
| Alarm Snooze | ✅ | Session-based snooze with limit enforcement |
| Alarm Sessions | ✅ | Last 30 sessions per alarm |
| DB Migrations | ✅ | Alembic configured, all models registered |
| Login UI | ✅ | Form validation, error toasts, redirect |
| Register UI | ✅ | Password confirmation, navigates to login |
| Dashboard UI | ✅ | Stats, line chart, doughnut chart, habit score bar |
| Alarms UI | ✅ | List, create/edit modal, toggle, delete |
| Profile UI | ✅ | Sleep schedule, difficulty, goals, habits |
| Sidebar Navigation | ✅ | Role-aware links, active state, sign out |
| Auth Context | ✅ | JWT state, session restore, auto-refresh |
| Docker Compose | ✅ | All 5 services, health checks, volumes |

---

## 9. How to Run

### Docker (Recommended)
```bash
docker-compose up --build
```

### Manual
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
```

### Access
| URL | Description |
|-----|-------------|
| http://localhost:3000 | React Frontend |
| http://localhost:8000 | FastAPI Backend |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |

---

## 10. Next — Milestone 2

M2 builds on this foundation with:
- Cognitive Challenge Engine (Math, Logic, Memory, Word Game, Pattern, Riddle, Quiz)
- Adaptive difficulty engine (ML-based)
- Wake-up verification flow
- Challenge analytics (MongoDB)
- Snooze pattern analytics

---

*Report generated for Milestone 1 — CognitiveAlarm Platform*
