# PRD.md - Product Requirements Document

## Vision
To build an AI-powered Intelligent Cognitive Alarm Platform that helps users develop consistent wake-up habits by requiring them to solve personalized puzzles, riddles, memory challenges, logic problems, or math exercises before dismissing alarms. The platform adapts challenge difficulty based on user behavior, wake-up performance, snooze patterns, sleep schedules, and cognitive engagement levels to improve productivity, reduce oversleeping, and encourage healthy sleep routines.

> **Document Status (2026-09-06, post-M2)**: Sections below describe the intended product. The **Current Implementation Status** and **Known Gaps** sections at the end reflect actual codebase state from a deep analysis. See `HierarchicalRemediationPlan.md` for the prioritized fix roadmap.

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

| Milestone | Duration | Key Deliverables | Actual Status (2026-09-06) |
|---|---|---|---|
| **M1: Foundation** | Weeks 1–2 | Project initialization, auth system, DB schema, user profiles, basic alarm scheduling | ✅ **Complete** — auth+RBAC, profiles/settings, tz-aware alarms, regenerated migration `732e5cb49bcf`, 22/22 smoke test |
| **M2: Cognitive Engine** | Weeks 3–4 | Challenge engine operational, puzzle generation workflows, wake-up verification mechanisms, challenge evaluation | ✅ **Complete** — server-authoritative engine, `POST /challenges/submit`, no-answer-leak `/next`, mobile E2E dismiss, `smoke_m2.py` 25/25 |
| **M3: Adaptive Intelligence** | Weeks 5–6 | Adaptive difficulty engine functional, habit scoring system operational, recommendation workflows completed, habit tracking dashboards | ✅ **Complete** — analytics service refactor (real sleep/wake estimates), trained `difficulty_model.pt` (`ml-status model_loaded=true`), recommendation engine (sleep/wake-up/habit/challenge), web real-data wiring; smokes 22/22 + 25/25 green |
| **M4: Deployment** | Weeks 7–8 | Executive dashboards operational, reports and visualization modules, end-to-end workflow demonstrated, production deployment via Docker, final documentation and presentation | ✅ **Core delivered (2026-09-07)** — pytest suite (32 tests, 3.11+3.14), error envelope, GitHub Actions CI, Docker up-tested, admin UI, PDF/Excel reports, **architecture alignment P1–P7 landed** (gateway hardening, service modularization, `ai_engine`, infra scaffolds, push-token notification API, §21 web nav). **M4 backlog delivered (2026-09-07/08)**: mobile offline sync + push registration, web Vitest (18) + mobile jest (31) coverage, web sidebar/theme UI pass, Profile page, shared-auth mobile fix, `run_all` one-terminal launcher, final presentation + Milestone 3/4 notes. Remaining: cloud deployment, on-device E2E (native push) |

---

## Offline-First Strategy
- **Local Caching**: All cognitive challenges cached on mobile device via Expo SQLite/AsyncStorage. ✅ **Implemented (2026-09-07)** — `mobile/src/sync/offlineStore.js` (AsyncStorage table store) + `mobile/src/sync/syncEngine.js`; Home caches alarms + habit score, Challenge caches challenge payload + completed attempt.
- **Idempotent Sync**: Background telemetry sync uses PostgreSQL `ON CONFLICT (upsert)` to handle duplicate records. ✅ **Implemented** — `POST /sync/pending` (idempotent upsert) + `GET /sync/pull`; mobile calls them via `syncEngine.js` on screen focus / reconnect.
- **Offline Functionality**: App usable offline; challenges downloaded on demand; results uploaded on reconnect. ✅ **Implemented** — offline cache fallback with an offline banner on Home; pending records queued with `synced` flag.
- **Conflict Resolution**: Server-first policy for versioned data; local changes merged only if server has no newer version. ✅ **Implemented** — server-side upsert resolves duplicates by timestamp; sync marks accepted rows synced.

> ⚠️ **On-device E2E pending**: offline + push flows are jest-tested (31) and Metro-bundled, but a native **dev build** is required to exercise remote push (Expo Go disables FCM) and on-device offline transition.

---

## Current Implementation Status (2026-09-08, post-M4)

> Deep codebase analysis result, refreshed after each milestone. Status legend: ✅ Complete · ⚠️ Partial · ❌ Not Implemented · 🔴 Broken

### Core Modules

| PRD Module | Status | Notes |
|---|---|---|
| Cognitive Alarm Engine | ✅ Complete (M2) | 7 challenge types × 5 difficulties, deterministic templates, on-demand Challenge creation, server-authoritative verification, multi-step + timeouts |
| Difficulty Adaptation Engine | ✅ Complete (M3) | Trained `difficulty_model.pt` loaded via `MLInferenceService` (`ml-status model_loaded=true`); rule-based fallback retained for robustness |
| Offline Puzzle Solver | ✅ Implemented (2026-09-07) | AsyncStorage table store + idempotent sync engine wired to `/sync/pending`/`/sync/pull`; Home/Challenge cache + offline banner; jest-tested |
| Sleep/Wake Telemetry | ✅ Complete (M3) | Adherence/snooze computation exists; sleep window estimated from alarm gaps; real trends + recent activity |
| Habit Scoring Engine | ✅ Complete | 35/25/20/20 weighted composite + streak bonus (≤10% of component) from real attempt data |
| Recommendation Engine | ✅ Complete (M3) | `GET /api/v1/analytics/recommendations` — sleep/wake-up/habit/challenge, priority-sorted |
| Dashboard & Analytics | ✅ Complete (M4) | Backend endpoints + RBAC enforced; web charts wired to real data (M3); **admin UI page** (users table, platform metrics, RBAC-gated 403 panel) |
| Notification & Reminder System | ✅ P5 channel + mobile wired | **Push-token registration API + `push_tokens` table (P5)**; mobile registers Expo token on login (`notifications/registerPush.js`); FCM/APNs delivery via `integrations/messaging.py` provider (NoopProvider) still needs a native dev build |
| Reports & Export System | ✅ Complete (M4) | CSV/JSON/PDF/Excel via `/dashboard/reports/{habits,wake-up,challenges}`; async `?async=1` + status endpoint (P4) |
| Final Integration, Testing & Deployment | 🟡 M4 core+backlog | pytest (32) + CI + Docker up-tested; mobile offline/notifications + web/mobile tests + presentation + docs all delivered; **cloud deployment + on-device E2E pending** |

### Cross-Cutting Status

| Concern | Status | Detail |
|---|---|---|
| Security | 🟡 M1+M2+P1-fixed | Env-driven JWT secret + CORS, RBAC enforced, answer leak fixed (M2), **rate limiting + request-id/logging (P1)** |
| Mobile integration | 🟡 M2-wired + M4-backlog | Alarm-dismiss E2E matches backend contract (`/next` → `/submit` → `/dismiss`); profile/settings wired; **offline cache + sync + push registration wired (2026-09-07)**; shared-auth `AuthProvider` fixes login-stuck (2026-09-08); on-device E2E pending |
| Error handling | ✅ Complete (M4) | Global envelope `{detail, error_code, timestamp, status_code}` |
| Database | ✅ Good | 9 tables (+`push_tokens`); migration chain 0→head verified on fresh DB; SQLite local dev, PostgreSQL via Docker |
| Testing | ✅ M4-backed | pytest (32) + smoke_m1 (22) + smoke_m2 (25) + **web Vitest (18) + mobile jest (31)** gates |
| CI/CD | ✅ Complete (M4) | GitHub Actions: ruff + pytest + smokes + web test (Vitest) + web build + mobile jest; pushed to `origin/main` |

### Architecture alignment (P1–P7, approved `plan.md`, landed 2026-09-07)
Gateway hardening · 12 domain service modules · `ai_engine/` package · optional Redis/worker scaffolds · push-token notification API · §21 grouped web nav · docs audit. Full mapping: **`ARCHITECTURE.md`** (✅ implemented · 🟡 scaffold · 🟥 planned).

### UI & app-shell pass (web, 2026-09-07/08)
Sidebar navigation (collapsible 248/76px) with §21 groups · global Light/Dark theme (`theme.js` → `data-theme` + `ck-theme`, cross-tab sync) · auth design system (`components/auth/*`) · `login-bg.svg` hero · new **Profile** page (`PUT /users/profile`) · honest/theme-aware charts (`makeChartOptions`).

### Estimated Overall Completion: **~92%**

---

## Known Gaps (from Deep Analysis — post-M2)

1. **Analytics placeholders (M3)** — `sleep_duration_avg = 7.5` hardcoded; ✅ resolved — M3 analytics service returns real sleep/wake estimates + trends.
2. **Web mock fallbacks (M3)** — Home page renders hardcoded chart data; ✅ resolved — M3 wired real data; 2026-09-07 pass removed remaining hardcoded series.
3. **No trained ML model file (M3)** — ✅ resolved — `difficulty_model.pt` trained + loaded (`ml-status model_loaded=true`).
4. **Zero tests and no CI/CD (M4)** — ✅ resolved — pytest 32 + Vitest 18 + jest 31 + GitHub Actions.
5. **Docker container up-test pending (M4)** — ✅ resolved — compose up-tested end-to-end (Postgres + migrations + lean image, PDF/Excel verified in container).
6. **Offline sync & notifications (M4)** — ✅ resolved 2026-09-07 — mobile sync engine + push-token registration wired and jest-tested.
10. **Notifications & offline sync not wired (M4)** — ✅ resolved — see #6.

### Remaining gaps (post-M4)
1. **Cloud deployment** — Docker compose works locally; no real cloud host yet.
2. **On-device E2E (native push)** — requires an Expo development build; Expo Go disables remote push and local alarm scheduling.
3. **FCM/APNs delivery provider** — `integrations/messaging.py` ships a NoopProvider protocol; real provider adoption pending.
4. **Settings persistence** on web dashboard is implemented via `/users/settings` + `/users/{key}`; iPhone local alarm scheduling remains native work.

> ⚠️ **Resolved in M1:** hardcoded JWT secret; admin auth bypass; CORS `*`; `load_dotenv` overriding Docker `DATABASE_URL`; wrong Dockerfile CMD — plus missing `PUT /users/profile` / `PUT /users/{key}` / settings endpoints now exist and are wired in the mobile app.