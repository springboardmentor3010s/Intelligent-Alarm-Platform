# PRD.md - Product Requirements Document

## Vision
To build an AI-powered Intelligent Cognitive Alarm Platform that helps users develop consistent wake-up habits by requiring them to solve personalized puzzles, riddles, memory challenges, logic problems, or math exercises before dismissing alarms. The platform adapts challenge difficulty based on user behavior, wake-up performance, snooze patterns, sleep schedules, and cognitive engagement levels to improve productivity, reduce oversleeping, and encourage healthy sleep routines.

> **Document Status (2026-09-05)**: Sections below describe the intended product. The **Current Implementation Status** and **Known Gaps** sections at the end reflect actual codebase state from a deep analysis. See `HierarchicalRemediationPlan.md` for the prioritized fix roadmap.

### Success Metrics
- **Wake-up Improvement**: Reduce snooze frequency and improve successful wake-up rates.
- **Cognitive Engagement**: Increase challenge completion and cognitive engagement during wake-up routines.
- **Habit Formation**: Improve wake-up consistency and long-term habit adherence.
- **Productivity Enhancement**: Encourage productive daily routines through intelligent alarm interactions.
- **Platform Performance**: Support large-scale alarm scheduling and behavioral analytics workflows while maintaining stable performance and responsiveness.

---

## Target User Personas

### 1. Students (Primary)
- **Goals**: Consistent wake-up for classes, reduced snoozing, alert start to day.
- **Pain Points**: Hitting snooze repeatedly, grogginess, missing early classes.
- **Needs**: Math/Logic challenges that are difficult enough to wake up but not frustrating; sleep schedule tracking.

### 2. Professionals (Primary)
- **Goals**: Productive morning start, time-efficient wake-up, reduced snooze dependency.
- **Pain Points**: Rushed mornings, stress-based snoozing, wanting to start work quickly.
- **Needs**: Quick cognitive challenges (pattern recognition, quick quizzes); productivity correlation analytics.

### 3. Fitness Enthusiasts
- **Goals**: Consistent wake-up for training, sleep quality tracking, habit adherence.
- **Pain Points**: Irregular sleep schedules, oversleeping past training windows.
- **Needs**: Sleep adherence scoring; wake-up consistency monitoring; integration with fitness apps.

### 4. Wellness Platform Partners
- **Goals**: Integrate habit scoring and sleep analytics into their ecosystems.
- **Pain Points**: Need standardized data formats, API access, reliable telemetry.
- **Needs**: Wellness Coach dashboard; API export (JSON/CSV); MongoDB secondary data sync.

---

## Core Functional Modules

### 1. Cognitive Alarm Engine
- **Trigger**: Alarm rings at configured time.
- **Action**: User must complete a cognitive challenge to dismiss.
- **Challenge Types**:
  - Math Problems (basic arithmetic, algebra)
  - Logic Puzzles (deductive reasoning, pattern completion)
  - Memory Challenges (sequence recall, pattern matching)
  - Word Games (anagram solving, vocabulary)
  - Pattern Recognition (visual patterns, series completion)
  - Riddles (linguistic puzzles, lateral thinking)
  - Quick Quizzes (mixed-type, adaptive count)
- **Adaptive Selection**: Based on user's difficulty preference, past performance, and time-of-day engagement levels.

### 2. Difficulty Adaptation Engine
- **Inputs per alarm dismissal**:
  - Correct/incorrect answer count
  - Time taken to complete
  - Snooze count before successful dismissal
  - Historical wake-up consistency
  - Current difficulty level (Beginner→Expert)
- **Adjustment Logic**:
  - If user consistently solves correctly → increase difficulty (next level up)
  - If user fails 3+ times in a row → decrease difficulty (next level down)
  - If user completes quickly (< 30s) → maintain or increase
  - If user takes very long (> 2min) → decrease or keep same
- **5 Difficulty Levels**: Beginner → Easy → Medium → Hard → Expert

### 3. Offline Puzzle Solver
- **Challenge Cache**: Downloaded challenges stored locally via AsyncStorage/Expo SQLite.
- **Offline-First**: App functions fully offline; challenges cached with expiration.
- **Sync on Reconnect**: Pending challenge results uploaded when connectivity restored; idempotent upsert to PostgreSQL.
- **Cache Schema**: See `mobile/src/schemas/offline-cache-schemas.ts`.

### 4. Sleep/Wake Telemetry
- **Tracked Metrics**:
  - Wake-up timestamps (successful dismissals)
  - Snooze counts per alarm
  - Time between alarm and first successful dismissal
  - Bedtime reminders adherence
  - Morning routine completion
- **Data Storage**: PostgreSQL primary; MongoDB for flexible event logging.
- **Background Sync**: Firebase Cloud Messaging for bedtime/wake-up reminders; Android Alarm Manager for native wake-up even when app closed.

### 5. Habit Scoring Engine
- **Composite Score** (0-100), calculated daily:
  - **Wake-Up Consistency** (35%): % of days woken without snooze, consistent time (±15min)
  - **Challenge Completion Success** (25%): % of alarm challenges completed successfully
  - **Snooze Reduction** (20%): Reduction in average snooze count vs. baseline
  - **Sleep Schedule Adherence** (20%): Bedtime vs. target bedtime consistency
- **Overall Score Formula**:
  ```
  overall_score = (wake_up_consistency * 0.35) +
                  (challenge_completion * 0.25) +
                  (snooze_reduction * 0.20) +
                  (sleep_schedule_adherence * 0.20)
  ```
- **Visualization**: User dashboard line charts, weekly trends, milestone celebrations.

### 6. Recommendation Engine
- **Sleep Improvement Recommendations**: Based on sleep schedule patterns, suggest bedtime adjustments.
- **Wake-Up Optimization**: Suggest optimal wake-up times based on historical performance.
- **Habit Improvement Guidance**: Personalized tips (e.g., "Your snooze count increased 20% this week").
- **Challenge Recommendations**: Based on difficulty history, suggest new challenge types to try.
- **Productivity Correlations**: Link wake-up success to daily productivity markers (if user logs them).

### 7. Dashboard & Analytics
- **User Dashboard**: Personal habit scores, alarm history, wake-up statistics, challenge performance.
- **Wellness Coach Dashboard**: User behavior insights, habit adherence analytics, sleep trend reports, progress monitoring for coached users.
- **Admin Dashboard**: User management, platform analytics, recommendation monitoring, system reports.

### 8. Notification & Reminder System
- **Bedtime Reminders**: Configurable countdown to target bedtime.
- **Wake-Up Reminders**: Customizable alarm tones, snooze behavior prompts.
- **Habit Alerts**: "You've maintained 7-day streak!" or "Your snooze count increased this week."
- **Challenge Reminders**: If alarm dismissed without challenge (e.g., snoozed), prompt on next ring.

### 9. Reports & Export System
- **Habit Reports**: PDF export of daily/weekly/monthly habit scores with trend analysis.
- **Wake-Up Reports**: PDF/CSV of wake-up timestamps, snooze counts, success rates.
- **Challenge Performance Reports**: PDF/Quiz analysis - types attempted, accuracy, difficulty progression.
- **Productivity Reports**: Correlation of wake-up consistency with user-defined productivity goals.
- **Sleep Analytics Reports**: Bedtime/wake-time trends, sleep duration analysis.
- **Export Formats**: PDF (pretty-printed), Excel (.xlsx) for data analysis.

### 10. Final Integration, Testing & Deployment
- **Frontend and Backend Integration**: REST API consumption, JWT auth flow, real-time data synchronization.
- **API Validation and Testing**: Unit tests, integration tests, Postman collection validation.
- **End-to-End Workflow Testing**: Full alarm dismissal flow from mobile app to habit score update.
- **Security Testing**: JWT validation, SQL injection prevention, XSS prevention in dashboards.
- **Performance Optimization**: API response time targets, dashboard loading speed, concurrent user handling.
- **Docker Containerization**: Multi-service orchestrator (docker-compose.yml).
- **Production Deployment**: AWS Elastic Beanstalk / Azure App Service / Docker Swarm.
- **Monitoring and Logging**: Structured logs, health checks, error tracking (Sentry).
- **Documentation and User Guides**: Updated PRD, SRS, user onboarding docs.

---

## Performance Benchmarks

| Metric | Target | Threshold | Notes |
|---|---|---|---|
| **API Response Time** (p95) | < 200ms | < 500ms | Includes JWT validation + DB query |
| **Challenge Generation Latency** | < 100ms | < 300ms | PyTorch inference + preprocessing |
| **Alarm Dismissal Success Rate** | > 95% | > 90% | % of alarms where user completes challenge |
| **Wake-Up Verification Accuracy** | > 98% | > 95% | Correct challenge completion detection |
| **Sync Idempotency** | 100% upsert | N/A | No duplicate records on retry |
| **Dashboard Loading Time** (p95) | < 2s | < 5s | Full page with charts |
| **Concurrent User Capacity** | ≥ 1000 users | ≥ 500 users | Per Docker-compose scaling |
| **Mobile App Startup** | < 3s | < 5s | Time to first alarm display |
| **Notification Delivery** | > 99% | > 95% | FCM / Android Alarm Manager |

---

## Release Milestones

| Milestone | Duration | Key Deliverables | Actual Status (2026-09-05) |
|---|---|---|---|
| **M1: Foundation** | Weeks 1–2 | Project initialization, auth system, DB schema, user profiles, basic alarm scheduling | ⚠️ Partial — auth works end-to-end; RBAC not enforced; profile update endpoints missing |
| **M2: Cognitive Engine** | Weeks 3–4 | Challenge engine operational, puzzle generation workflows, wake-up verification mechanisms, challenge evaluation | ⚠️ Partial — 7 types + adaptive selection work; answers leaked in payload; no submit endpoint; mobile dismiss broken |
| **M3: Adaptive Intelligence** | Weeks 5–6 | Adaptive difficulty engine functional, habit scoring system operational, recommendation workflows completed, habit tracking dashboards | ⚠️ Partial — habit scoring works; adaptive difficulty falls back to rules (no model file); analytics has hardcoded placeholders |
| **M4: Deployment** | Weeks 7–8 | Executive dashboards operational, reports and visualization modules, end-to-end workflow demonstrated, production deployment via Docker, final documentation and presentation | ❌ Not started — zero tests, no CI/CD, Docker deployment broken, web charts mocked, no admin UI |

---

## Offline-First Strategy
- **Local Caching**: All cognitive challenges cached on mobile device via Expo SQLite/AsyncStorage. ⚠️ **Not implemented** — `offline-cache-schemas.ts` defines types only; no storage engine wired.
- **Idempotent Sync**: Background telemetry sync uses PostgreSQL `ON CONFLICT (upsert)` to handle duplicate records. ⚠️ **Server side implemented** (`/sync/pending`, `/sync/pull`); **mobile never calls these endpoints**.
- **Offline Functionality**: App usable offline; challenges downloaded on demand; results uploaded on reconnect. ❌ **Not implemented** — app requires network for all flows.
- **Conflict Resolution**: Server-first policy for versioned data; local changes merged only if server has no newer version. ❌ **Not implemented**.

---

## Current Implementation Status (2026-09-05)

> Deep codebase analysis result. Status legend: ✅ Complete · ⚠️ Partial · ❌ Not Implemented · 🔴 Broken

### Core Modules

| PRD Module | Status | Notes |
|---|---|---|
| Cognitive Alarm Engine | ⚠️ Partial | 7 challenge types + adaptive selection work; answers leaked in payload; Logic/Word/Pattern templates have random-mismatch bugs |
| Difficulty Adaptation Engine | ⚠️ Partial | Rule-based fallback always active (no trained model file); no `/challenges/submit` endpoint |
| Offline Puzzle Solver | ❌ Not implemented | Schemas only; no caching, no sync engine |
| Sleep/Wake Telemetry | ⚠️ Partial | Adherence/snooze computation exists; analytics has hardcoded placeholder values |
| Habit Scoring Engine | ✅ Complete | 35/25/20/20 weighted composite computed from real attempt data |
| Recommendation Engine | ⚠️ Partial | Scored via habit metrics; limits not implemented |
| Dashboard & Analytics | ⚠️ Partial | Backend endpoints exist; web charts use hardcoded mock data; no admin UI page |
| Notification & Reminder System | ❌ Not implemented | No push registration endpoint, no local scheduling, token never registered |
| Reports & Export System | ⚠️ Partial | CSV export works; PDF/Excel not implemented |
| Final Integration, Testing & Deployment | ❌ Not started | Zero tests, no CI/CD, Docker deployment broken |

### Cross-Cutting Status

| Concern | Status | Detail |
|---|---|---|
| Security | 🔴 Critical | Hardcoded JWT secret; admin auth bypass; CORS `*`; challenge answers leaked |
| Mobile integration | 🔴 Broken | Dismiss payload mismatch; 3 calls to nonexistent endpoints |
| Error handling | ⚠️ Partial | `{"detail"}` only; no `error_code`/`timestamp` envelope |
| Database | ⚠️ Partial | 8 tables; Alembic migration stale vs models; env import bug |
| Testing | ❌ None | Zero test files; deleted failing test artifact |
| CI/CD | ❌ None | No pipeline, no commits |

### Estimated Overall Completion: **~42%**

---

## Known Gaps (from Deep Analysis)

1. **Mobile alarm-dismiss flow is fundamentally broken** — mobile sends `{challenge_result}` while backend `AlarmDismissReq` requires `{challenge_attempt_id, correct_answers, total_questions, time_taken_seconds}`. No `ChallengeAttempt` creation path exists. The mobile also auto-fills the correct challenge answer.
2. **No server-side challenge verification** — `/challenges/next` returns the correct answer in `puzzle_payload`; there is no `POST /challenges/submit` to create and verify attempts server-side.
3. **Missing user profile endpoints** — `PUT /users/profile` and `PUT /users/{key}` called by mobile do not exist in the backend.
4. **Admin authorization is a no-op** — `_require_admin()` in `dashboard.py` always returns `True`; `is_superuser` never checked.
5. **Hardcoded JWT secret** (`auth.py:17`) — tokens forgeable by anyone with repo access.
6. **`load_dotenv(override=True)` in `database.py:11`** — overrides Docker-injected `DATABASE_URL`, so containers connect to SQLite.
7. **Dockerfile CMD is wrong** — `uvicorn app:app` should be `uvicorn app.main:app`.
8. **Database schema drift** — Alembic migration missing `full_name`, `timezone`, `difficulty_preference`, `generated_at` columns and the `alarm_roles` table.
9. **`migrations/env.py` imports `app.models` (lowercase)** — breaks on Linux/Docker case-sensitive FS.
10. **Web dashboard masks errors with mock data** — Home/Dashboard/Reports silently render hardcoded scores (70) when the API fails; charts use hardcoded weekly data from `chartUtils.js`.
11. **Mobile `overist_score` typo** — `HomeScreen.jsx:69`; habit score always renders 0.
12. **Zero tests and no CI/CD** — nothing catches regressions; a previously-deleted `test_api.py` was recorded as failing.