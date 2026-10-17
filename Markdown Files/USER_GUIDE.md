# User Guide — CerebroKognit (Phase 9)

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

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

Three demo accounts are seeded on a local (SQLite) database. The web login page
also has one-click **"Sign in as ..."** buttons for each.

| Role | Email | Password |
|---|---|---|
| User | `user@gmail.com` | `User@123` |
| Wellness Coach | `coach@gmail.com` | `Coach@123` |
| Administrator | `admin@gmail.com` | `Admin@123` |

Each seeded account also ships with sample history so no screen is blank on a
first run: three demo alarms, ten days of habit scores, a daily challenge
attempt, five productivity logs, and two platform announcements. Seeding fills
only missing days, so it never duplicates what you have already recorded.

The sidebar adapts to the signed-in role:

- **Users** see the personal sections only (no **Administration** entry); all
  data is their own and cross-user URLs are rejected.
- **Wellness Coaches** see the personal sections plus a **Coaching** entry
  (`/coach`) listing only their assigned cohort: per-user profile, adherence,
  sleep trends, challenge performance and progress. Users outside the
  assignment return 403 from the backend.
- **Administrators** see an **Admin** entry (Administration section): platform
  telemetry, the full user directory, and role management (they cannot change
  their own role).

Everything else (Dashboard, Analytics, Alarms, Challenges, History, Profile,
Settings) is shared by all three roles and shows only the signed-in user's data.

### Sign-up: choose User or Wellness Coach

On the **Sign up** tab you pick the account type, **User** or **Wellness Coach**,
before creating the account. The normal Login tab then signs in any role.

- **Administrator is never offered at sign-up** - admin accounts are provisioned
  by the developers (the seeded `admin@gmail.com` is one).
- The register form no longer asks for a preferred difficulty; new accounts start
  at **Medium** and you can change it any time under Profile.

## 7. Mobile app notes

- Works offline for cached alarms/scores and syncs when reconnected.
- Alarm firing on-device uses local notifications; remote push needs a
  development build (Expo Go cannot receive push tokens) and the server's
  `PUSH_PROVIDER=expo`. Follow the in-app prompts to enable notifications.
