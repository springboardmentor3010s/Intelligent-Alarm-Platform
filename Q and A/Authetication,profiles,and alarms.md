# Cognitive Challenges, Authentication, and Alarm Scheduling — Q&A

> Implementation audit — CerebroKognit Intelligent Cognitive Alarm Platform.
> Evidence: static source reading (no runtime verification this session; runtime claims marked *Unverified*).

---

## Q5. Authentication & Role-Based Access Control

### 5.1 Registration

| Aspect | Status | Evidence |
|---|---|---|
| Endpoint | ✅ **Implemented** | `POST /api/v1/auth/register` — `backend/app/api/auth.py:15-64` |
| Email validation + normalization | ✅ | `AuthRegisterReq.email: EmailStr` (`backend/app/schemas/auth.py:9`); route lowercases/strips (`auth.py:21`) |
| Password policy | ✅ (basic) | `password: str = Field(..., min_length=8)` (`schemas/auth.py:10`) — **min length only; no complexity/breach check** |
| Password hashing | ✅ | `AuthService._hash_password` → bcrypt `gensalt()` (`backend/app/services/user_service.py:33-36`) |
| Duplicate email rejection | ✅ | `auth.py:22-24` → 400 "Email already registered" |
| Default role assignment | ✅ | `get_or_create_role(db, "User")` + `UserRole` insert (`auth.py:38-41`; `backend/app/api/deps.py:96-103`) |
| Token issuance | ✅ | `_create_access_token` (60 min) + `_create_refresh_token` (30 days) (`user_service.py:43-63`) |

### 5.2 Login

| Aspect | Status | Evidence |
|---|---|---|
| Endpoint | ✅ **Implemented** | `POST /api/v1/auth/login` — `auth.py:67-102` |
| Credential verification | ✅ | Email lookup + `bcrypt.checkpw`; failure → `401` with `WWW-Authenticate: Bearer` (`auth.py:74-80`) |
| Token response | ✅ | `access_token`, `refresh_token`, `token_type: bearer`, `expires_in: 3600`, `user` (`auth.py:96-102`) |

### 5.3 OAuth2 / JWT scheme

| Aspect | Status | Evidence |
|---|---|---|
| OAuth2 scheme | ✅ | `OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")` (`backend/app/api/deps.py:17`) |
| JWT algorithm | ✅ | HS256, claims `sub`/`exp`/`iat`/`jti` (`user_service.py:28-30,44-63`) |
| Secret sourcing | ✅ (env) | `SECRET_KEY = os.getenv(...)` (`user_service.py:26-28`) — **⚠️ hard-coded dev fallback string remains in source** |
| Token decode/validation | ✅ | `_decode_token` catches `ExpiredSignatureError` / `InvalidTokenError` → None (`user_service.py:65-74`) |

### 5.4 Token validation & protected routes

| Aspect | Status | Evidence |
|---|---|---|
| `get_current_user` dependency | ✅ | Decodes token → checks `sub` → loads user → 401 on bad token, 404 on missing user, 403 on `is_active=False` (`backend/app/api/deps.py:20-66`) |
| Protected routers | ✅ | Alarms, challenges, habits, analytics, dashboard, sync, notifications, feedback, users — all depend on `get_current_user` |

### 5.5 Role permissions (RBAC)

| Aspect | Status | Evidence |
|---|---|---|
| Role model + seed | ✅ | `Role`/`UserRole` tables (`backend/app/Models.py:21-65`); SQLite bootstrap seeds Administrator / Wellness Coach / User (`backend/app/services/bootstrap.py`) |
| `require_roles(...)` guard | ✅ | DB query of user's role names; role intersection check → `403` (`deps.py:69-93`) |
| Admin endpoints | ✅ | `dashboard.py` — `admin_only = require_roles("Administrator")` (platform analytics), `staff_only = require_roles("Administrator", "Wellness Coach")` (users list) |
| Registration default role | ✅ | New users get "User" only |

### 5.6 User profile management

| Endpoint | Status | Evidence |
|---|---|---|
| `GET /api/v1/users/profile` | ✅ | `users.py:17-22` → `user_service.to_profile` |
| `PUT /api/v1/users/profile` | ✅ | Updates `full_name`, `timezone`, `difficulty_preference` (`users.py:25-32`; `user_service.py:166-179`) |
| `GET /api/v1/users/settings` | ✅ | Returns `notifications`, `auto_dismiss`, `vibrate`, `time_format` with defaults (`user_service.py:182-193`) |
| `PUT /api/v1/users/{key}` | ✅ | Whitelisted keys `{notifications, auto_dismiss, vibrate, time_format}`; unknown → 400 (`user_service.py:196-223`) |
| `GET /api/v1/auth/me` | ✅ | Returns current profile (`auth.py:105-123`) |

### 5.7 Security gaps found

| # | Gap | Detail |
|---|---|---|
| 1 | **No refresh-token endpoint** | `refresh_token` is issued (30-day) but there is **no `POST /auth/refresh`** anywhere in `api/` — clients can never rotate tokens; a stolen 30-day refresh token is un-usable anyway (mobile/web only use access tokens). De facto 60-min expiry only. |
| 2 | **No email verification flow** | `is_verified` flag exists (default `False`) and is returned in profiles, but **no verify endpoint or email service** exists (only a diagnostic GET stub per context.md). Everyone is effectively un-verified. |
| 3 | **No password reset / change** | No `/auth/password` or reset flow. |
| 4 | **Weak password policy** | Only `min_length=8`; no complexity rules, no common-password/breach check. |
| 5 | **Hard-coded dev secret fallback** | `SECRET_KEY` default string lives in source (`user_service.py:27`); ignored when env is set (M1 compliancy), but the fallback risks deployment mistakes. |
| 6 | **No token revocation / logout server-side** | Logout is client-side only (clears storage); JWT stays valid until 60-min expiry. |
| 7 | **Rate limiting exists but weak on auth brute-force** | Gateway auth limiter is 60/min global in-memory (per-process) — resets on restart, single-node only (`gateway/rate_limit.py`). |
| 8 | **`is_superuser` unused** | Field exists (`Models.py:36`) but RBAC uses roles only; no code path references it (dead column). |
| 9 | **No account lockout / CAPTCHA / login attempt throttling per-account** | Only a global request limiter; brute-force per-user not prevented. |
| 10 | **Registration allows unverified logins** | Users can login immediately even though `is_verified=False`. |

---

## Q6. User Profile & Habit Management

### 6.1 Field-by-field: what exists vs what the spec asked for

| Spec field | Stored? | Storage | Updated/Validated | Used by |
|---|---|---|---|---|
| **Email** | ✅ | `User.email` (`Models.py:32`), unique + `ix_users_email_lower` lower index | Registration/login only; **no update endpoint** | Identity + lookup |
| **Full name** | ✅ | `User.full_name` (`Models.py:33`) | `PUT /users/profile` | Display |
| **Time zone** | ✅ | `User.timezone` (`Models.py:38`), IANA string, default `UTC` | `PUT /users/profile`; validated only implicitly as string (invalid → falls back UTC at use-site, `alarm_service.py:20-26`) | **Alarm next_trigger computation** (`_compute_next_trigger`) + alarm `time` display |
| **Preferred wake-up time** | ⚠️ **Not a user field** | Derived per-alarm via `Alarm` rows + `challenge`; alarm `time` (HH:MM) + `_compute_next_trigger` | Set/updated through **alarm** create/update (`alarm_service.py:131-188`) | Alarm scheduling |
| **Sleep duration (target)** | ❌ **Not stored** | No `sleep_duration`/`bedtime` columns on `User` | — | `sleep_duration_avg` is **estimated** from overnight alarm gaps (14-day) in `behavior_analytics_service.py:42-94`, fallback to 7.5h — it is a computed insight, not a user preference |
| **Productivity goals** | ❌ **Not stored** | No field anywhere | — | — (hardcoded coaching messages only) |
| **Difficulty preference** | ✅ | `User.difficulty_preference` (`Models.py:39`), default `Medium` | `PUT /users/profile`; no enum validation at the DB/update layer (schema is plain `str`) | Adaptive challenge selection — anchors difficulty in `ChallengeService.get_adaptive_challenge` (`challenge_service.py`) |
| **Habit preferences (settings)** | ✅ | `User.settings` **JSON** column (`Models.py:40`) — `notifications` (bool, default True), `auto_dismiss` (bool, default False), `vibrate` (bool, default True), `time_format` ("12"/"24", default "12") | `PUT /users/{key}` with whitelist + `time_format` value check (`user_service.py:196-223`) | ⚠️ `notifications`/`vibrate`/`auto_dismiss` are **stored but no runtime code consumes them** (no push delivery, no local scheduler); `time_format` drives web display (`timeFormat.js`) |

### 6.2 Habit scoring (behavioral, not stored prefs)

- Composite **35/25/20/20** computed from real activity in `habit_scoring_service.py:194-198`:
  - **wake_up_consistency (35%)** — alarm dismissal patterns
  - **challenge_completion (25%)** — attempt completion + accuracy + streak
  - **snooze_reduction (20%)** — 7-day rolling snooze average
  - **sleep_schedule_adherence (20%)** — alarm trigger-time consistency
- Stored per-user-per-date in `HabitScore` (`Models.py:134-150`), refreshed on dismissal (`refresh_habit_score`, `habit_scoring_service.py:287`).
- History with gap-filling (`get_habit_score_history`) feeds the web Home/Dashboard charts and reports.

**Summary**: the spec's "profile with wake-up time, sleep duration, timezone, productivity goals, difficulty, habit preferences" is only **~60%** met — timezone + difficulty + settings exist; preferred wake-up is alarm-centric (not a user attribute); sleep duration is inferred not configured; productivity goals are absent.

---

## Q7. Alarm Scheduling Functionality

### 7.1 Alarm types

| Type | Support | Where |
|---|---|---|
| **Daily** | ✅ | `_compute_next_trigger` default branch (`alarm_service.py:66-67`) — next occurrence after now |
| **Weekday** (Mon–Fri) | ✅ | `alarm_service.py:48-55` |
| **Weekend** (Sat–Sun) | ✅ | `alarm_service.py:57-64` |
| **One-Time** | ✅ | `alarm_service.py:45-46` (stays disabled after dismiss) |
| **Recurring** | ⚠️ Partial | `Alarm.recurrence` column (`Models.py:78`) is stored + settable, but **recurrence logic is driven by `alarm_type`, not the `recurrence` string** — the field is informational only |
| **Multiple alarms** | ✅ | `list_alarms` returns all user alarms (`alarm_service.py:125-128`); web + mobile support queues |
| **Customized** | ✅ | Title, HH:MM time, type, challenge type, difficulty, question count — `AlarmCreateReq` (web `AlarmManagement.jsx`, mobile `AlarmFormScreen.jsx`) |
| **Smart adaptive** | ⚠️ Partial | Challenge *difficulty* adapts via ML/rule engine at `/challenges/next`; the alarm **trigger itself is not smart** (no ML trigger-time optimization, no sensor inputs) |

### 7.2 Alarm lifecycle

| Operation | Implementation | Evidence |
|---|---|---|
| **Create** | `POST /api/v1/alarms` → `create_alarm` — computes tz-aware `next_trigger` (`_compute_next_trigger(...).astimezone(UTC)`), links challenge via `_link_challenge`, stores UTC | `alarm_service.py:131-160`; `api/alarms.py` |
| **List** | `GET /api/v1/alarms` → `list_alarms` | `alarm_service.py:125-128` |
| **Update** | `PUT /api/v1/alarms/{id}` → `update_alarm` — recomputes next_trigger if time/type changed | `alarm_service.py:163-188` |
| **Delete** | `DELETE /api/v1/alarms/{id}` | `alarm_service.py:191-196` |
| **Snooze** | `POST /api/v1/alarms/{id}/snooze` — cap 5, `max(now, scheduled) + 5min` | `alarm_service.py:199-222` |
| **Dismiss** | `POST /api/v1/alarms/{id}/dismiss` — gated on all-correct challenge, re-arms recurring, refreshes habit score | `alarm_service.py:225-273`; `verification_service.py:14` |
| **Trigger** | ❌ **None** — see Q8 | — |

### 7.3 Database storage
`Alarm` table (`Models.py:68-84`): `user_id`, `title`, `alarm_type` (**String(50), no enum/CHECK constraint**), `next_trigger` (**UTC-aware datetime**), `is_enabled`, `challenge_id`, `times_snoozed`, `recurrence`, timestamps. Indexes: `ix_alarms_user_id`, `ix_alarms_next_trigger`.

### 7.4 Works on web / mobile / both
| Layer | Status |
|---|---|
| **Web** | ✅ Full CRUD + snooze in `web/src/pages/AlarmManagement.jsx` (calls real `/api/v1/alarms`) |
| **Mobile** | ✅ `AlarmsTab.jsx` (list + edit/delete), `AlarmFormScreen.jsx` (create/edit chips matching `AlarmCreateReq`), `AlarmScreen.jsx` (dismiss flow) |

### 7.5 Gaps
- `alarm_type` free-form string (no enum — spec FR-AS-001).
- No validation of `challenge_type`/`difficulty` against allowed sets at the schema layer.
- No server-side scheduler, no push delivery, no on-device scheduling → **an alarm never actually "rings"** (see Q8).

---

## Q8. How Does the Alarm Actually Trigger on a Real Device?

### 8.1 Current reality — **it does not trigger autonomously**

A thorough sweep shows **no mechanism that ever fires an alarm notification**, on any layer:

| Mechanism | Status | Evidence |
|---|---|---|
| **Server-side scheduler** | ❌ **None** | Only worker is `backend/app/workers/job_queue.py` — an **in-process registry for async report generation** (`/dashboard/reports/status/{id}`). No cron/APScheduler/Celery beat that scans `next_trigger`. |
| **Push delivery (FCM/APNs)** | ❌ **Noop** | `integrations/messaging.py:20-27` — `NoopProvider.send()` **raises `NotImplementedError("FCM/APNs provider is planned...")`**; `notification_service.send()` delegates to it (`notification_service.py:74-82`). |
| **Android AlarmManager** | ❌ **None** | No native module, no `AlarmManager` usage anywhere in `mobile/`. |
| **iOS local notifications** | ❌ **None** | No `scheduleNotificationAsync`, no `setNotificationHandler`, no notification channel/trigger code in `mobile/` — grep found **only** the Expo-token *acquisition* path (`mobile/src/notifications/registerPush.js:49-59`). Nothing is ever scheduled. |
| **expo-notifications scheduling** | ❌ **None** | Dependency declared (`mobile/package.json:23`) but never used to schedule; only `getExpoPushToken()` for registration. |
| **`next_trigger` role** | ⚠️ **Metadata only** | Computed, stored (UTC), displayed on web/mobile — **no consumer ever acts on it**. |

### 8.2 How the alarm is currently "used" (manual flow)

1. User opens the app → `AlarmScreen.jsx:23-47` fetches `GET /alarms`, picks the `is_enabled` alarm.
2. User manually starts the challenge via `useChallenge.fetchChallenge` → server creates a pending attempt.
3. User answers → `POST /challenges/submit` → all-correct → `POST /alarms/{id}/dismiss` → `alarm_service.dismiss_alarm` re-arms/recomputes next trigger + refreshes habit score.
4. **There is no "ring" step** — the user is expected to open the app at the right time. The platform is effectively an **arm-and-verify-on-demand** system, not an alarm clock with notifications.

### 8.3 What the spec promised vs what exists

| Spec item | Actual |
|---|---|
| Push notification "alarm rings on device" | ❌ Tokens are collected and stored (`push_tokens` + `/notifications/register`) but **no provider delivers anything** |
| Android Alarm Manager local scheduling | ❌ Backlog (Level 12/16) |
| iOS local notifications | ❌ Backlog |
| Server-side scheduler | ❌ None |

### 8.4 Failure-mode analysis (as designed today)

| Scenario | What happens now | Correct behavior needed |
|---|---|---|
| **App closed / backgrounded** | Nothing fires — user gets no alarm. Alarm only exists as a DB row + `next_trigger` timestamp. | On-device local notifications (AlarmManager / UNUserNotificationCenter) scheduled at `next_trigger`; or server push at trigger time |
| **Device offline** | Same as above (no trigger path at all). If the user *does* open the app offline, cached alarms/challenges from `offlineStore.js` render, but scoring/verify requires server (`challenges/submit` + `dismiss` are online-only). | Local alarm still fires; challenge could be verified offline first and synced later (partial — `syncEngine` exists but no local verify) |
| **Notification delivery fails (FCM/APNs)** | Not applicable — `NoopProvider.send()` **raises** before any delivery; there's no queue, retry, fallback, or silent-mode handling. | Provider adapter + retry/fallback (e.g., HTTP fallback), dead-token cleanup |
| **Server down at trigger time** | No trigger, no push; user unaware. | Local scheduling is the correct mitigation (server not in the ring path) |

### 8.5 What exists that could be reused

- ✅ `push_tokens` registry + idempotent register/deregister API (`notification_service.py`) — ready to be consumed by a real provider.
- ✅ Expo push-token acquisition client-side (`registerPush.js`) — already wired into `useAuth.login`.
- ✅ Precise `next_trigger` (UTC, tz-aware) as the scheduling anchor.
- ✅ `integration/messaging.py` Protocol — drop-in surface for an FCM/APNs implementation.
- ✅ `web/src/components/ui/LiveChallengeSimulator.jsx` — a **cosmetic demo** (confirms the UI narrative, not a real trigger).

### 8.6 Recommended path (matches context.md backlog)
1. Implement `FcmProvider` / `ApnsProvider` behind `MessagingProvider`; wire `notification_service.send` to it.
2. Add local scheduling on mobile: schedule local notification at `next_trigger` on alarm create/sync (`expo-notifications` `scheduleNotificationAsync` + channels), reschedule on snooze/dismiss.
3. Add a server-side sweep worker (APScheduler or Celery beat) for redundancy/analytics of missed alarms.

---

*Backlog rows impacted: FCM/APNs delivery provider, on-device local alarm scheduling (Levels 12/16), real cloud deployment. Auth/profile/alarm CRUD are solid; "actual alarm trigger" is the largest functional gap in the product.*