# Wakeful — Intelligent Cognitive Alarm Platform

An AI-assisted alarm platform that makes you solve a cognitive challenge to dismiss an alarm, adapts the difficulty to how
you actually wake up, and turns your mornings into a measurable habit. Built to the project specification
(*AI – Intelligent Cognitive Alarm Platform*): **FastAPI + React + PostgreSQL + MongoDB + Docker**.

## Run it on Windows (no experience needed)

1. Install **Docker Desktop** and start it (wait until it says it is running).
2. Unzip this folder, open it, and **double-click `start.bat`**.
   - The first run takes 5–15 minutes (it downloads and builds everything).
   - It creates a private `.env` file with freshly generated random passwords and **prints your login details** — copy them.
3. Your browser opens **http://localhost:5173**. Sign in through the portal that matches your account:

| Portal | Account | Where the password is |
|---|---|---|
| Admin | `admin@example.com` | printed by `start.bat`, also `ADMIN_PASSWORD` in `.env` |
| Coach | `coach@demo.example.com` | `DEMO_PASSWORD` in `.env` |
| Member | `aarav@demo.example.com` (also `meera@`, `rohan@`) | `DEMO_PASSWORD` in `.env` |

   The demo members come with four weeks of history so every dashboard has data. You can also register a brand-new account.
4. `stop.bat` stops it. `reset.bat` **erases all data** and starts fresh.

> **Upgrading from the earlier version?** The database layout changed. Run `reset.bat` once (or `docker compose down -v`).
>
> **macOS/Linux:** run `./start.sh`.   **Manual:** `docker compose up --build -d` after creating `.env` from `.env.example`.

## How the alarm actually rings

* A background scheduler checks every **2 seconds** and opens a ringing session at the scheduled time (per the user's time zone).
* The open browser tab polls from a Web Worker (not throttled in background tabs), plays the alarm through the Web Audio API
  (4 sounds, gradual volume ramp), shows a full-screen challenge, flashes the tab title and raises a browser notification.
* The **server** decides everything: correct answers never reach the browser, each question is answered once, time limits are
  enforced server-side, and an alarm is only dismissed when the chosen verification method is satisfied.
* **Test ring** (Alarms page or Dashboard) rings immediately without affecting your statistics.

**Honest limitation:** a website can only ring while its browser tab is open (it may be in the background). For alarms that ring
with the phone locked or the browser closed you need the **React Native mobile app** from the spec (Android Alarm Manager / iOS
local notifications / FCM). That app is not part of this build.

## Features by specification module

| # | Spec module | Implemented |
|---|---|---|
| 1 | Authentication & RBAC | Register/login, JWT access tokens + rotating refresh tokens, **Google OAuth2**, 3 roles with **separate portals and sidebars**, profile management, password change, account deletion |
| 2 | Profile & habit management | Wake time, bedtime, sleep duration, time zone, productivity goal, wake-up streak goal, difficulty preference, challenge-type preferences, reminders |
| 3 | Alarm scheduling | Create / **edit** / pause / delete; daily, weekday, weekend, one-time, **smart adaptive** (sleep-cycle aware); custom repeat days, sound, volume, snooze rules; multiple alarms |
| 4 | Cognitive challenge engine | 7 types (math, logic, memory, word, pattern, riddle, quiz), procedurally generated, personalised selection, server-side validation, performance tracking |
| 5 | Adaptive difficulty engine | 5 levels; scikit-learn model + Thompson-sampling bandit (a simple reinforcement-learning method) for challenge-type selection |
| 6 | Wake-up verification | Puzzle, multi-step, consecutive-correct, time-based, accuracy-check; anti-snooze (each snooze raises difficulty); alertness score; dismissal validation |
| 7 | Behavioural analytics | Snooze patterns, wake behaviour, habit consistency, sleep analytics, **productivity correlation** |
| 8 | Habit scoring | Exact spec weights: consistency 35 / challenge success 25 / snooze reduction 20 / sleep adherence 20, plus adherence, productivity and sleep-routine sub-scores |
| 9 | Recommendations | Sleep, wake-up, habit, productivity and personalised-challenge advice with explanations |
| 10 | Dashboards | User, **Wellness Coach** and **Admin** dashboards (see below) |
| 11 | Notifications | Bedtime reminders, wake-up alerts, habit alerts, progress updates, platform announcements, browser notifications |
| 12 | Reports | Habit, wake-up, challenge, productivity and sleep reports as **PDF and Excel**; admin system report |
| 13 | Integration, testing, deployment | Docker Compose, nginx reverse proxy, health checks, request logging, **72 automated tests**, CI workflow, documentation |

**Member:** alarm history, wake-up statistics, habit score, challenge performance, productivity insights, sleep log.
**Coach:** behaviour insights, habit-adherence analytics, sleep trend reports, progress monitoring, messaging — only for members who *accepted* their invitation.
**Admin:** user management, role changes, coach approvals, platform analytics, recommendation monitoring, audit log, system health, announcements.

Light, dark and **adaptive** (follows your device) themes are available everywhere.

## Security

* Passwords hashed with bcrypt (12 rounds); minimum 10 characters with letter + number.
* Access token (15 min) lives only in memory; the refresh token is an **HttpOnly, SameSite=Strict** cookie, stored hashed,
  **single-use with reuse detection** (a replayed token revokes every session).
* Account lockout after 5 failed logins, per-IP rate limiting, identical errors for unknown emails.
* Roles are re-checked from the database on every request. Coach applications need admin approval; coaches see only members who consented.
* Admins cannot demote/deactivate themselves or the last admin. All sensitive actions go to an **audit log**.
* Strict Content-Security-Policy, no third-party scripts/fonts, security headers, API docs disabled in production.
* The database ports are **not published**; containers run unprivileged with all Linux capabilities dropped.
* Secrets are generated per install and never committed. The app refuses to start in production without a strong `SECRET_KEY`.

## Deploying to the internet (AWS / Azure)

1. Create a small Linux VM (AWS Lightsail/EC2 or an Azure VM), install Docker, copy this folder.
2. In `.env` set `PUBLIC_URL=https://your-domain`, `COOKIE_SECURE=true`, `SEED_DEMO_DATA=false`, and remove `ADMIN_PASSWORD` after first sign-in.
3. Put HTTPS in front (e.g. Caddy or nginx + Let's Encrypt) forwarding to port 5173, then enable the HSTS line in `frontend/nginx.conf`.
4. `docker compose up --build -d`. Back up the `pgdata` volume regularly.

Google sign-in: create OAuth credentials in Google Cloud Console, add redirect URI `PUBLIC_URL/api/auth/google/callback`, then fill `GOOGLE_CLIENT_ID/SECRET` in `.env`.

## Development & tests

```
cd backend  && pip install -r requirements.txt && python -m pytest          # 44 tests (security, real-time ringing, verification, analytics…)
cd frontend && npm install && npm test && npm run dev                          # 28 UI tests render every page for all 3 roles
```
`uvicorn app.main:app --reload` (backend, port 8000) and `npm run dev` (frontend, port 5173, proxies `/api`).

## Scope notes (what differs from the spec)

* **Not built:** React Native mobile app, FCM push, TensorFlow/PyTorch/XGBoost models, Redis/Elasticsearch/vector/time-series stores
  from the architecture diagram. The "microservices" are modules of one FastAPI service (simpler to run and test).
* **Charts** use Recharts instead of Chart.js/Plotly.
* **The "AI":** the difficulty model starts from rule-labelled synthetic data (there is no real user history on day one) and can retrain on real sessions; recommendations are transparent rules. Describe them that way in your report.
* MongoDB stores the raw challenge event log; the app works without it.
* Single backend worker on purpose (the scheduler runs in-process).
* Docker could not be run in the authoring environment; the backend, scheduler, UI and all tests were verified directly (see the test suites).
