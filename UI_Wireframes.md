# UI Wireframes & Workflow Planning

Milestone 1, Task 3 deliverable. Low-fidelity wireframes for the Web Dashboard and Mobile app, plus workflow maps covering the core cognitive-alarm flows. Screens match the implemented routes, schemas, and API contract registry in `SRS.md` / `context.md`.

---

## 1. Screen Inventory

### Web Dashboard (`web/`)
| Screen | Route | Component |
|---|---|---|
| Auth (Login / Register) | `/` (unauthenticated) | `src/pages/Auth.jsx` |
| Dashboard | `/dashboard` | `src/pages/Dashboard.jsx` |
| Alarm Management | `/alarms` | `src/pages/AlarmManagement.jsx` |
| Challenge Generator | `/challenges` | `src/pages/ChallengeGenerator.jsx` |
| Settings / Profile | `/settings` | `src/pages/Settings.jsx` |
| Reports | `/reports` | `src/pages/Reports.jsx` |

### Mobile (`mobile/`)
| Screen | Navigation key | Component |
|---|---|---|
| Login | `Login` | `src/screens/LoginScreen.jsx` |
| Home (Dismiss Challenge) | `Home` | `src/screens/HomeScreen.jsx` |
| Alarm | `Alarm` | `src/screens/AlarmScreen.jsx` |
| Challenge | `Challenge` | `src/screens/ChallengeScreen.jsx` |
| Profile | `Profile` | `src/screens/ProfileScreen.jsx` |
| Settings | `Settings` | `src/screens/SettingsScreen.jsx` |

---

## 2. Web Dashboard Wireframes

### 2.1 Auth (Login / Register)

```
+------------------------------------------------------------------+
|  🧠 CerebroKognit                  [Login] [Register]           |
+------------------------------------------------------------------+
|  Win your mornings with a        |  Register card:              |
|  smarter alarm.                  |  • Full name      [____]     |
|                                  |  • Difficulty    [Medium v]  |
|  • Adaptive difficulty            |  • Timezone       [UTC v]    |
|  • 7 challenge types              |  • Email         [____]     |
|  • Habit scoring & insights       |  • Password      [____]     |
|                                  |  [Create Account]            |
|                                  |  ---- or ----                |
|                                  |  [Login with Demo Account]   |
+------------------------------------------------------------------+
Output: POST /api/v1/auth/register | POST /api/v1/auth/login
Store: localStorage token + user
```

### 2.2 Dashboard (Habit Analytics)

```
+ Top bar: 🧠 CerebroKognit   [Dashboard][Alarms][Challenges][Reports][Settings]  [Sign out]
+------------------------------------------------------------------------------------------+
|  Dashboard                                      +----------------+                        |
|  Habit analytics & personal insights            | Overall Score  |                        |
+-------------------------------------------------+   [  71 /100 ] |                        |
| +----------------+----------------------------+ +----------------+                        |
| | Total Alarms   | Successful Dismissals      | Avg Snooze | Challenge Accuracy        |
| |      12        |        9                   |    0.5     |        75%                |
| +----------------+----------------------------+            +                          |
|                                                                                        |
| +-----------------------------+  +-----------------------------+                       |
| | Wake-up Consistency    71   |  | Challenge Completion    42   |                       |
| |  ▁▂▃▂▄▅▆ (Line chart 7d)   |  |  ▁▃▄▂▅▆▆                 |                       |
| +-----------------------------+  +-----------------------------+                       |
| +-----------------------------+  +-----------------------------+                       |
| | Snooze Reduction       64   |  | Sleep Schedule Adherence 88 |                       |
| |  ▂▁▃▄▃▄▅                 |  |  ▅▅▆▆▅▆▆                   |                       |
| +-----------------------------+  +-----------------------------+                       |
+------------------------------------------------------------------------------------------+
Data: GET /api/v1/habits/score (today) + GET /api/v1/habits/score/history?days=7 (charts)
```

### 2.3 Alarm Management

```
+------------------------------------------------------------------------------------------+
|  Alarm Management                        [+ New Alarm]                                  |
|  Create, snooze, and manage your wake-up alarms                                           |
+------------------------------------------------------------------------------------------+
|  New Alarm card (shown when [+ New Alarm] toggled):                                       |
|  [Title________] [Daily v] [07:30] [Math v] [Medium v] [none v]  [Create Alarm]          |
|    (text)        (type)    (time)  (challenge)(difficulty) (recurrence)                   |
+------------------------------------------------------------------------------------------+
|  Alarm rows:                                                                              |
|  +----------------------------------------------------------------------+                |
|  | 🌅 Morning Boost              Next: Tue 07:30  [ENABLED] [Daily]      |                |
|  |                               Challenge: Math/Medium · Recur: weekdays [Snooze][Del]  |
|  +----------------------------------------------------------------------+                |
|  | ⏰ One-off meeting           Next: Fri 09:00  [ENABLED] [One-Time]    |                |
|  |                               Challenge: Logic/Easy                  [Snooze][Del]  |
|  +----------------------------------------------------------------------+                |
+------------------------------------------------------------------------------------------+
API: GET/POST /api/v1/alarms, POST /api/v1/alarms/{id}/snooze, DELETE /api/v1/alarms/{id}
```

### 2.4 Settings / Profile

```
+------------------------------------------------------------------------------------------+
|  Settings                           Personalize alarm & notification preferences          |
+------------------------------------------------------------------------------------------+
|  +------------------------------+  +------------------------------+                     |
|  | Profile                      |  | Alarm Behavior               |                     |
|  | Full name     [Alex Morgan]  |  | [x] Alarm notifications      |                     |
|  | Timezone      [Asia/Kolkata v]|  | [ ] Auto-dismiss on challenge|                     |
|  | Difficulty    [Medium v]     |  | [x] Haptic feedback          |                     |
|  | [Save Changes]               |  +------------------------------+                     |
|  +------------------------------+  +------------------------------+                     |
|                                   | Appearance                   |                     |
|                                   | [x] Dark theme               |                     |
|                                   +------------------------------+                     |
+------------------------------------------------------------------------------------------+
API: PUT/PATCH /api/v1/users/profile (persisted to backend)
```

---

## 3. Mobile Wireframes (Expo / React Native)

### 3.1 Login

```
+--------------------+
|    CerebroKognit   |      💡 Intelligent Cognitive Alarm
|                    |
|  [ Email________ ] |
|  [ Password_____ ] |
|  [     Login     ] |
+--------------------+
API: POST /api/v1/auth/login → AsyncStorage: cerebro_token / cerebro_user
```

### 3.2 Home (Triggered Alarm → Active Challenge)

```
+--------------------+
| ⏰ Time to wake up |
| 07:30 AM           |
| Solve the challenge|
| to dismiss the     |
| alarm.             |
|                    |
|  [ Start Challenge ]  --> navigates to Challenge screen
+--------------------+
```

### 3.3 Challenge (Dismiss Verification)

```
+--------------------+
| Math · Medium      |
| 23 + 47 = ?        |
| [ 7 ] [ 70 ] [ 8 ] |
|  Question 1 of 3   |
|  Timer: 00:45      |
+--------------------+
API: GET /api/v1/challenges/next → POST /api/v1/alarms/{id}/dismiss
Body: challenge_attempt_id, correct_answers, total_questions, time_taken_seconds
```

### 3.4 Profile

```
+--------------------+
|      Your Profile  |
| Email   a@b.c (ro) |
| Full name [_______]|
| Timezone [_______] |
| Difficulty [Medium v] |
| [ Save Changes ]   |
| [ Log Out ]        |
+--------------------+
API: PUT /api/v1/users/profile
```

### 3.5 Settings

```
+--------------------+
|     Preferences    |
| [x] Push Notifications  Receive reminders        |
| [ ] Auto-Dismiss       Dismiss alarm instantly   |
| [x] Haptic Feedback    Vibrate during challenges |
| Connectivity: ● Online / Offline Mode            |
| [ Sign Out ]           |
+--------------------+
API: PUT /api/v1/users/{settings_key} (persisted to backend settings JSON)
```

---

## 4. Core Workflow Maps

### 4.1 Onboarding Workflow

```
Register ──► AuthService hashes pw (bcrypt 12) ──► User created ──► Role "User" assigned (UserRole)
     │
     └──► JWT access+refresh tokens issued ──► stored (web: localStorage / mobile: AsyncStorage)
                │
                ▼
        GET /api/v1/auth/me  ◄── profile loaded into Home/Dashboard
```

### 4.2 Alarm Scheduling Workflow

```
Create Alarm (title, type, time, challenge_type, difficulty, recurrence)
   │
   ▼
Backend computes next_trigger (timezone-aware, based on type + time)
   │
   ├─ Daily   → next day at time
   ├─ Weekday → next Mon–Fri at time
   ├─ Weekend → next Sat/Sun at time
   └─ OneTime → given date+time (disables after dismissal)
   │
   ▼
Challenge row linked (type+difficulty)  ──► alarm.challenge_id set
   │
   ▼
Update / Delete / Snooze (+5 min, cap 5)  ──► tracked for habit scoring
```

### 4.3 Dismissal & Habit Score Workflow

```
Alarm rings ──► GET /challenges/next (adaptive) ──► user solves challenge
     │
     ▼
POST /alarms/{id}/dismiss {challenge_attempt_id, correct, total, time_taken}
     │  verify attempt belongs to user & completed (all correct)
     ▼
Alarm disabled; recurring alarms recompute next_trigger (preserving user's time)
     │
     ▼
Habit score recomputed live (35% wake-up, 25% challenge, 20% snooze, 20% sleep adherence)
     │
     ▼
GET /habits/score + /habits/score/history?days=7 ──► Web Dashboard charts
```

### 4.4 Offline / Sync (implemented 2026-09-07 — matches wireframe)

```
Mobile offline cache ──► background sync ──► POST /api/v1/sync/pending (idempotent upsert)
                                              GET  /api/v1/sync/pull (delta download)
```
- Implemented: `mobile/src/sync/offlineStore.js` (AsyncStorage) + `syncEngine.js` + `useSync` hook; Home caches alarms + habit score, Challenge caches payload + attempt; sync on focus + offline banner. On-device E2E transition pending (dev build).

---

## 5. Design Tokens (Web)

- **Palette:** `--accent` gold / `--accent-2` coral / `--accent-3` violet on dark `--surface-*` grays.
- **Type:** display font for headings, system stack for body.
- **Charts:** Chart.js `Line` charts via `react-chartjs-2`, fed from `/habits/score/history`.
- **Alarm rows:** `pill` status chips (Enabled=green, Disabled=amber, type + challenge metadata).