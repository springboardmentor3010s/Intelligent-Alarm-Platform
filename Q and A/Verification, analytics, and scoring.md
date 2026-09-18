# Wake-Up Verification, Analytics, and Habit Scoring — Q&A

> Implementation audit — CerebroKognit Intelligent Cognitive Alarm Platform.
> Evidence: static source reading. Runtime claims unverified (tests are cited where present).

---

## Q14. Wake-up verification and dismissal authorization

### 14.1 Can a user dismiss an alarm without completing the challenge?

**No — dismissal is hard-gated server-side.** The dismiss endpoint verifies three things before it will disable the alarm:

```python
# backend/app/services/verification_service.py:14-37
def verify_finished_attempt(db, user_id, attempt_id):
    attempt = db.query(ChallengeAttempt).filter(id==attempt_id, user_id==user_id).first()
    if not attempt:                          # not owned / missing
        raise HTTPException(404, "Challenge attempt not found")
    if not attempt.completed or attempt.correct_answers < attempt.total_questions:
        raise HTTPException(400, "...All questions must be answered correctly.")
    return attempt
```

The vulnerability check: it requires the attempt to be **(a) owned by this user (404 otherwise), (b) `completed=True`, and (c) `correct_answers == total_questions` (400 otherwise)**. There is **no bypass** — no "skip", no admin override, no time-out auto-dismiss on the backend.

### 14.2 The dismiss gate flow

```
POST /api/v1/alarms/{id}/dismiss
  → alarm_service.dismiss_alarm            (alarm_service.py:225-273)
      1. _find_owned_alarm(...)            → 404 if alarm not owned or missing
      2. if not alarm.is_enabled:          → 400 "Alarm already dismissed"
      3. verify_finished_attempt(...)      → 404/400 gate (see above)
      4. alarm.is_enabled = false
      5. recurring → recompute next_trigger + re-enable; One-Time stays disabled
      6. refresh_habit_score(...)          (habit_scoring_service.py:287)
```

**Test evidence** (`backend/tests/test_challenges.py`):
- `test_dismiss_full_flow_after_completed_attempt` (`:155-168`) — 200 only for a fully-solved attempt.
- `test_dismiss_rejects_incomplete_and_unknown_attempts` (`:171-201`) — wrong-answer attempt → **400**; attempt id `9999999` → **404**.

### 14.3 Challenge completion validation

`ChallengeService.submit_attempt` (`challenge_service.py:411-457`) is **server-authoritative**:
- Loads the attempt by `(attempt_id, user_id, challenge_id)` → 404 via `LookupError` if missing (route maps to HTTPException at `api/challenges.py:92-93`).
- Rejects already-completed attempts (`challenge_service.py:434`).
- Compares each submitted answer against the **stored** `expected_answers` via `_answers_match` (`:211-218`).
- `completed = (correct == len(expected))` — **every question must be right** (`challenge_service.py:443-446`).
- Records `user_answers`, `correct_answers`, `end_time`, `time_taken_seconds` into the attempt row.

### 14.4 Multi-step challenges — implemented

- `_question_count_for` maps difficulty → count: Beginner=1, Easy=1-2, Medium=2, Hard=3, Expert=3-5 (`challenge_service.py:184-192`). Supports explicit `question_count` override (1-5).
- `test_multi_step_challenge_count` (`test_challenges.py:136-152`) verifies 2 questions → submit `user_answers: [a1, a2]` → `completed=True`.
- Client payload includes `total_questions` and `timeout_seconds` (`payload_for`, `challenge_service.py:227-233`).

### 14.5 Consecutive correct answers — not a gate, but tracked

There is **no consecutive-correctness requirement** to dismiss (each question simply must be correct; `completed` is per-attempt all-correct). What exists:
- `compute_streak_length` (`habit_scoring_service.py:93-107`) counts consecutive **completed** attempts → feeds the challenge_completion **streak bonus** (`:88-89`) and the ML difficulty feature.
- Adaptive difficulty uses a `streak_break` in `_adaptive_difficulty` (`challenge_service.py:271-276`).

### 14.6 Time-based challenges — timeout sent to client, not enforced server-side

- Per-type timeouts: Math 60, Logic 90, Memory 45, Word 90, Pattern 60, Riddle 90, QuickQuiz 60, default 90 (`challenge_service.py:41-50`).
- Returned in `puzzle_payload.timeout_seconds`; mobile `AlarmScreen` renders a countdown and disables submit at 0 (`mobile/src/screens/AlarmScreen.jsx:55-59,206-209`).
- **Gap**: the server does **not** reject submissions whose `time_taken_seconds` exceeds the timeout — that's client-side enforcement only. An attacker could POST `time_taken_seconds: 10` with the real answers and still pass.

### 14.7 Cognitive accuracy checks — per-question exact match

- `_normalize_answer` (strip/lowercase/trailing-`0`), `_normalize_sequence` (digit-only), `_answers_match` fallback compare — `challenge_service.py:198-218`.
- Wrong answers tested: `test_wrong_answer_is_rejected` (`test_challenges.py:118-133`) → `correct=False, completed=False`.

### 14.8 Attempt limits — none

Capture: no quota/attempt limit on submissions per pending attempt; the only protection is the **single-use** rule — an attempt may be submitted once (attempt 2... N would 404 `already completed`/missing). Re-arming is implicit: after a failed attempt, the client fetches a **fresh** challenge (`LoadFlow` in `AlarmScreen.jsx:93`), and abandoned pending snapshots are garbage-collected (`challenge_service.py:359-363`).

### 14.9 Snooze handling — capped

- `snooze_alarm`: max 5 snoozes (`alarm_service.py:206-208`), then `400 "Maximum snooze limit reached"`.
- Postpones `next_trigger` to `max(now, scheduled) + 5min` (`alarm_service.py:214-218`).
- Snooze counts feed the snooze_reduction scorer (Q16) and the `snooze_count` difficulty feature.

### 14.10 Bottom line

The dismiss gate is sound: **non-owners, unknown attempts, incomplete attempts, and partially-correct attempts are all rejected with explicit 404/400.** Residual soft spots: timeout is client-enforced only; no per-user daily attempt quota; challenge content is deterministic code (not AI-generated prose).

---

## Q15. Behavioral analytics

All in `backend/app/services/behavior_analytics_service.py` (235 lines) + facade `analytics_service.py`. It reads only real DB rows; no mixed fake defaults are used unless genuinely no data exists.

### 15.1 Snooze pattern analysis (implemented — direct + derived)

| Signal | Implementation | File:line |
|---|---|---|
| Average snooze count | `SELECT AVG(alarms.times_snoozed)` per user → exposed at `/analytics/me` as `average_snooze_count` | `behavior_analytics_service.py:206-211` |
| Snooze reduction scorer | Weekly rolling ratio (see Q16) | `habit_scoring_service.py:110-152` |
| Snooze-count feeds difficulty + recs | `snooze_count` feature for ML; `total_snoozes >= 3` triggers wake-up recommendation | `challenge_service.py:330-332`; `recommendation_service.py:141-154` |

### 15.2 Wake-up behavior tracking

| Signal | Implementation | File:line |
|---|---|---|
| Wake-up consistency trend | Half-vs-half mean comparison of `HabitScore.wake_up_consistency`, 5-point tolerance → `"improving"\|"stable"\|"declining"` | `behavior_analytics_service.py:97-125` |
| Successful dismissals | `COUNT(attempts WHERE completed)` | `behavior_analytics_service.py:142-151` |
| Days with alarm activity | `COUNT(DISTINCT date(next_trigger))` last 7 days | `:135-141` |
| Per-type challenge accuracy + solve time | `GROUP BY challenge_type`: attempts, `avg(correct)/avg(total)`, `avg(time_taken_seconds)` | `:159-180` |

### 15.3 Productivity correlation — NOT implemented

There is **no productivity field, no goal tracking, and no productivity-vs-behavior correlation** anywhere (no `productivity` column, metric, or API key). Spec gap (existing goal prefs were also never seeded — see Q6).

### 15.4 Habit consistency monitoring

- HabitScore rows (per user per day) + 7-day `get_habit_score_history` with honest gaps (`None` on missing days) — `habit_scoring_service.py:326-354`.
- Charted on web Dashboard/Home (4 pillars) and mobile Insights tab.

### 15.5 Sleep pattern analytics

| Signal | Implementation | File:line |
|---|---|---|
| Sleep duration estimate | Priority: (1) user `sleep_duration_minutes` setting → (2) mean overnight gap between consecutive days' first/last alarms over 14 days, only gaps in `[3h, 16h]` → (3) fixed 7.5h default only if no data | `behavior_analytics_service.py:42-94` |
| Sleep schedule adherence scorer | std-dev of trigger hours over 7 days (`1 - std/3h`) | `habit_scoring_service.py:155-191` |

### 15.6 Data source → aggregation → storage → dashboard usage

```
Raw rows (Alarm.created/next_trigger, ChallengeAttempt.*, HabitScore.*)
  → SQL aggregation in behavior_analytics_service / habit_scoring_service
  → Serialized score rows in HabitScore (per-day cache of the 4 + composite)
  → GET /api/v1/habits/score|history (habits.py)
  → GET /api/v1/analytics/me (analytics.py:17-23)
  → web Dashboard.jsx (telemetry cards, telemetry grid), Home.jsx (stat strip),
    mobile tabs/HomeTab.jsx + tabs/InsightsTab.jsx
```

The `analytics_service.py` facade re-exports both modules so API layer imports one object (`api/analytics.py`).

---

## Q16. Habit score: the actual formula

### 16.1 Spec weights vs implementation — **exact match**

```python
# habit_scoring_service.py:194-198
def compute_habit_composite(wake_up, challenge, snooze, sleep):
    return int(wake_up * 0.35 + challenge * 0.25 + snooze * 0.20 + sleep * 0.20)
```

- 35% wake-up consistency ✅ · 25% challenge completion ✅ · 20% snooze reduction ✅ · 20% sleep schedule adherence ✅

### 16.2 Component formulas (each 0–100, computed from real data)

**1) Wake-up consistency (35%)** — `:19-53`
```
alarms today = alarms with next_trigger in [date, date+1d)
if none → 70 (default/no-data)
on_time_rate  = # alarms with times_snoozed == 0 / total
snooze_penalty = min(sum of times_snoozed, total*5) / (total*3), capped at 1.0
score = (on_time_rate*100) × (1 − 0.3 × snooze_penalty)   → clamp [0,100]
```

**2) Challenge completion (25%)** — `:56-90`
```
attempts today = attempts created in [date, date+1d)
if none → 50 (default)
completion_rate = completed / total
accuracy        = correct_all / total_questions_all
score = completion_rate×60 + accuracy×40             # base 0–100
streak_bonus = min(streak_length / 7, 1.0)           # full at 7-day streak
score = score×0.9 + score×0.1×streak_bonus           # +up to 10% component
```

**3) Snooze reduction (20%)** — `:110-152`
```
today_snoozes   = sum(times_snoozed) for alarms today
week_snoozes    = sum(times_snoozed) for alarms last 7d
days_with_alarms = distinct trigger dates in window
avg_daily = week_snoozes / days_with_alarms
if week empty → 70;  if avg_daily == 0 → 100
reduction_ratio = 1 − (today / (avg_daily × 2))
score = reduction_ratio×100  → clamp [0,100]        # 2× your average = 0
```

**4) Sleep schedule adherence (20%)** — `:155-191`
```
week_alarms = enabled alarms with next_trigger in last 7d
if none → 60; if <2 → 70
trigger_hours = hour + minute/60 for each
std_dev = population std
consistency = max(0, 1 − std_dev/3.0)                # ±3h spread = 0, 0 spread = 100
score = consistency×100  → clamp [0,100]
```

### 16.3 Missing-data handling (honest, no fabrication)

- `get_or_compute_habit_score` (`:213-284`): if **no alarms AND no attempts** exist for the user → returns `{..., overall_score: 0}` and writes **no row** (new accounts show zero until real activity).
- Component defaults (70/50/70/60) only apply per-component when *today* has no data, but the user has historical activity.
- History endpoint returns `None` components for days with no stored score (`:345-352`) → charts render gaps, not invented values.

### 16.4 When is it recomputed & stored?

| Trigger | Path |
|---|---|
| On every successful alarm dismissal | `refresh_habit_score` (`alarm_service.py:266` → `habit_scoring_service.py:287-323`), upsert `(user_id, date)` |
| On-demand read | `get_or_compute_habit_score` computes + upserts if missing (`:213-284`); race safe via IntegrityError catch |
| Stored | `HabitScore` table (`Models.py:134-150`), unique `(user_id, date)` in migration/DDL |

### 16.5 Example output

For user with: 1 alarm dismissed on-time, 0 snoozes today, 2/2 challenge questions correct, schedule std-dev 0.5h:
```
wake  = 100      (on_time_rate=1, penalty=0)
chall = ~93      ((1×60 + 1×40)=100 then ×(0.9+0.1×streak_ratio))
snooze= 100      (week avg 0)
sleep = ~83      (1 − 0.5/3 = 0.833)
overall = int(100×.35 + 93×.25 + 100×.20 + 83×.20) ≈ int(94.o)
```
Returned via `GET /api/v1/habits/score` → shown as the composite ring on web Home/Dashboard and mobile HomeTab, with the four pillars charted over 7 days.

---

## Q17. Dashboard feature state per role

### 17.1 Endpoint inventory (backend)

| Endpoint | Auth | Status |
|---|---|---|
| `GET /api/v1/dashboard/users` | **staff_only** (Administrator, Wellness Coach) | ✅ `dashboard.py:61-67` → `admin_service.list_users` |
| `GET /api/v1/dashboard/analytics` | **admin_only** (Administrator) | ✅ `dashboard.py:70-76` → `admin_service.platform_analytics` |
| `GET /api/v1/dashboard/reports/{habits,wake-up,challenges}` | any authed user | ✅ `dashboard.py:79-124` |
| `GET /api/v1/dashboard/reports/status/{job_id}` | any authed user | ✅ `dashboard.py:52-58` (async jobs) |
| `GET /api/v1/habits/score`, `/history` | any authed | ✅ `habits.py:15-31` |
| `GET /api/v1/analytics/me`, `/recommendations`, `/ml-status` | any authed | ✅ `analytics.py:17-40` |

### 17.2 User role (web pages — all wired to real APIs)

| Page | Content | Source file |
|---|---|---|
| **Home** (command center) | Composite score ring, Next Alarm countdown card, stat strip (4 pillars), weighted progress bars, 7-day trend, timeline, quick actions | `web/src/pages/Home.jsx` (real `/habits/score`, `/habits/score/history`, `/alarms`) |
| **Analytics** | Composite score + weighted formula, cognitive telemetry grid (total alarms, dismissals, avg snooze, accuracy), personalized AI recommendations (priority-sorted), 4 pillar charts with "About/Recommended" notes, honest "X of 7 days" note | `web/src/pages/Dashboard.jsx` + `chartUtils.js` |
| **Alarms** | List, status pill, follow-time display, snooze/delete, structured create form | `web/src/pages/AlarmManagement.jsx` |
| **Challenges** | Type cards with per-type Start (`/challenges/next?type=&difficulty=`), difficulty hierarchy | `web/src/pages/ChallengeGenerator.jsx` |
| **Reports** | Score summary + CSV/PDF/Excel/JSON exports with honest trend state (<2 days) | `web/src/pages/Reports.jsx` |
| **Profile/Settings** | Profile fields (name/tz/difficulty) + settings toggles + 12/24h format + theme | `Profile.jsx`, `Settings.jsx` |
| Mobile equivalents | HomeTab (score ring + next window + alarm queue), InsightsTab (weighted pillars + 7-day track), ProfileTab | `mobile/src/screens/tabs/*` |

### 17.3 Wellness Coach role — **MISSING**

- Backend: RBAC role AND `staff_only` guard exist, and `GET /dashboard/users` works for coaches (`deps.py` + `dashboard.py:22-23`).
- **No coach cohort view**: no filtering of users by coach assignment/cohort, no per-user drill-down for a coach, no coach-specific analytics UI screen. `FR-DD-002 (Wellness Coach Dashboard) = Not implemented` (spec-discrepancy matrix confirms).

### 17.4 Administrator role — **implemented** (RBAC-gated)

`web/src/pages/Admin.jsx` renders (real `/dashboard/analytics` + `/dashboard/users`; 403 → "Access Restricted" panel):
- Metric strip: **Total Users · Active Today · New This Week · Dismissal Success Rate · Platform Avg Habit Score · System Uptime**
- **Top Challenge Types** table (type + attempt count + distribution bars)
- **Users Directory** table (ID, email, role badge, active LED, verification, joined date)
- Backend `admin_service.py` computes alert statuses from real data; **`system_uptime_percentage=99.9` is a hard-coded placeholder** (`admin_service.py:86`).

### 17.5 Requirement-by-requirement

| FR | Feature | Status |
|---|---|---|
| FR-DD-001 | User dashboard | ✅ (Home/Dashboard web + mobile tabs) |
| FR-DD-002 | Wellness Coach dashboard | ❌ (role + guard exist, no UI/cohort logic) |
| FR-DD-003 | Admin dashboard | ✅ (page + RBAC + users + platform analytics) |
| Alarm history | | ⚠️ partial — recent alarms list + wake-up report exist; no full alarm-history timeline page |
| Wake-up statistics | | ✅ (analytics telemetry + trend) |
| Habit score | | ✅ (`/habits/score` + history charts) |
| Challenge performance | | ✅ (per-type accuracy breakdown + attempts reports) |
| Productivity insights | | ❌ (no productivity module; see Q15.3) |
| User management (admin) | | ⚠️ read-only list — no edit/deactivate/role-change actions in UI |
| Platform analytics | | ✅ (metrics + top challenge types) |
| Recommendation monitoring | | ⚠️ recommendations rendered live, but no persistence/history of past recommendations |

---

## Q18. Notifications, reminders, reports, and exports

### 18.1 Notifications & reminders — mostly **NOT delivered**

Given no FCM/APNs provider (Q8 in the prior file) and **no local notification scheduling on mobile**, none of these reach a device:

| Reminder type | Spec | Actual |
|---|---|---|
| Bedtime reminders | FR spec | ❌ Not implemented (no scheduling, no push) |
| Wake-up reminders | FR spec | ❌ `next_trigger` exists but nothing delivers it. Mobile has **no** `scheduleNotificationAsync` / notification channel / AlarmManager |
| Habit alerts | FR spec | ❌ None |
| Challenge reminders | FR spec | ❌ None |
| Progress notifications | FR spec | ❌ None |

**What does exist on the notifications front:**
- `push_tokens` table + **registry API**: `POST/DELETE /api/v1/notifications/register`, `GET /api/v1/notifications/tokens` (`api/notifications.py`; `notification_service.py:19-72`) — idempotent, ownership-reassign, scope-checked, 9 tests.
- Mobile Expo-token capture wired into login (`mobile/src/hooks/useAuth.jsx:130-155`, `mobile/src/notifications/registerPush.js`) — **Expo-Go guard skips it**, token only stored server-side.
- **Delivery = `NoopProvider`: `send()` raises `NotImplementedError`** (`integrations/messaging.py:24-27`). Reminders cannot be sent end-to-end today.

### 18.2 Reports & exports — **fully implemented**

| Exported report | Endpoint | Data source | Formats |
|---|---|---|---|
| Habit score report | `GET /dashboard/reports/habits?format=…&days=N` | HabitScore rows (per-day) | **csv · json · pdf · excel** |
| Wake-up report | `GET /dashboard/reports/wake-up?format=…&days=N` | Alarm rows (id, title, type, next_trigger, snoozes, enabled) | csv · json · pdf · excel |
| Challenge report | `GET /dashboard/reports/challenges?format=…&days=N` | ChallengeAttempt rows (+type/difficulty/accuracy/solve time) | csv · json · pdf · excel |

- Validation: `format` pattern `^(csv|json|pdf|excel)$`, `days` in `[1, 365]` (`dashboard.py:79-124`).
- **Sync vs async**: `?async=0` (default) builds inline; `?async=1` submits to `workers.job_queue` and returns `{job_id, status:"queued", endpoint}`; poll `GET /dashboard/reports/status/{job_id}` (`dashboard.py:26-49`, `workers/job_queue.py`).
- **File generation logic** (`report_service.py` + `report_export.py`):
  - CSV: `csv.DictWriter` (header from record keys).
  - PDF: **reportlab** `SimpleDocTemplate` (landscape A4) with title + styled table (dark header, zebra rows) `report_export.py:67-111`.
  - Excel: **openpyxl** `Workbook`, header + rows on sheet "report" `report_export.py:114-129`.
  - JSON: envelope `{report_type, days, data, generated_at}`.
  - `StreamingResponse` with `Content-Disposition: attachment; filename=…` so browsers download.
- **Tested**: `tests/test_analytics.py` asserts PDF starts with `%PDF` (`application/pdf`), Excel starts with `PK` + `spreadsheetml` content-type.
- **Web UI**: `Reports.jsx` triggers real downloads on the 3 endpoints with format buttons.

### 18.3 End-to-end verdict

| Feature | Backend | Mobile/Web | End-to-end working? |
|---|---|---|---|
| Token registration | ✅ | ✅ (Expo Go skips) | ✅ (registration only) |
| Push/notification **delivery** (all reminder types) | ❌ NoopProvider raises | ❌ no local scheduling | ❌ **Not working** |
| Bedtime/wake-up/habit/challenge/progress reminders | ❌ | ❌ | ❌ |
| Report generation (CSV/JSON/PDF/Excel) | ✅ sync + async | ✅ web downloads | ✅ working |
| Habit/wake-up/challenge data reports | ✅ from real DB | ✅ | ✅ |

**Q18 summary**: report/export functionality is complete and tested; the reminders/notifications side is a **registry-only** implementation — no reminder can currently reach a physical device.

---

*Backlog carry-over: FCM/APNs delivery, on-device local alarm scheduling, coach dashboard, productivity module, attempt quotas, server-side timeout enforcement.*