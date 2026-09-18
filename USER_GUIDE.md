# User Guide — CerebroKognit (Phase 9)

CerebroKognit is a cognitive alarm platform: to dismiss a morning alarm you
must solve a short puzzle (math, logic, memory, word, pattern, riddle, or
quick quiz). Consistent wake-ups build your habit score.

## 1. Getting started

1. Open the web app (or Expo mobile app) and **register** with email +
   password (min 8 chars), timezone, and display name.
2. **Log in**. Sessions last 60 minutes; the app re-validates automatically
   and returns you to login on expiry — you never get stuck on stale data.
3. Complete your **Profile** (full name, timezone, 12/24-hour clock) and
   **Settings** (theme, difficulty preference).

## 2. Alarms

- **Create**: title, time, type (One-Time, Daily, Weekdays), challenge type,
  difficulty, question count. Daily/Weekday alarms reschedule automatically.
- **Snooze**: postpones 5 minutes, up to 5 snoozes per alarm — then the alarm
  insists on the challenge.
- **Dismiss**: fetch the challenge, answer every question correctly, submit
  within the time budget. One solved attempt dismisses one alarm occurrence;
  attempts expire and cannot be reused.

## 3. Habit score (35 / 25 / 20 / 20)

Your daily composite: **wake-up consistency 35%** (snooze-free dismissals),
**challenge completion 25%** (accuracy + completion, streak bonus),
**snooze reduction 20%** (vs your 7-day average), **sleep adherence 20%**
(wake-time regularity). New accounts show zeros until real activity exists —
never placeholder scores. Charts show honest gaps for unscored days.

## 4. Productivity tracking (you log it)

The app **cannot measure productivity**, so any productivity number you see
is one you typed: log a daily 0–100 score (+ optional note) on the Reports
page. Trends plot only logged days. The wake-up/productivity figure is a
computed **association** (needs 4+ paired days) — steadier mornings do not
prove higher output. Productivity exports contain only logged days.

## 5. Challenges, analytics, recommendations

- **Challenges** page: browse the catalog by type/difficulty, practice with
  the simulator, or set a challenge as your Daily "wake gate".
- **Analytics** page: composite score, telemetry (alarms, dismissals, snooze
  average, accuracy), four pillar charts with plain-language explanations,
  and personalized recommendations — each states its **reason** and the
  **source metric** behind it.
- **Reports** page: habit trajectory, wake-up timeline, productivity section,
  and CSV/PDF/Excel exports that match the on-screen data for the selected
  7/14/30-day range.

## 6. Roles: User, Wellness Coach, Administrator

- **Users** see only their own data; cross-user URLs are rejected.
- **Wellness Coaches** (assigned by an admin) see a **Coaching Cohort** page:
  assigned users only, with per-user profile, adherence, alarm, challenge,
  sleep, and progress detail. An empty cohort shows guidance instead of data.
- **Administrators** see platform telemetry, the user directory, and role
  management (they cannot change their own role).

## 7. Mobile app notes

- Works offline for cached alarms/scores and syncs when reconnected.
- Alarm firing on-device uses local notifications; remote push needs a
  development build (Expo Go cannot receive push tokens) and the server's
  `PUSH_PROVIDER=expo`. Follow the in-app prompts to enable notifications.
