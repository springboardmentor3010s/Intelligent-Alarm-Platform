# Wakeful — Intelligent Cognitive Alarm Platform

Wakeful is a web-based, AI-assisted cognitive alarm and habit-tracking platform. Instead of dismissing an alarm with a single tap, a user completes a cognitive challenge. Wakeful records wake-up behavior, tracks habits, and uses that history to personalize challenge difficulty and recommendations.

This README is based on the supplied `wakeful-v2` source archive and the supplied *AI – Intelligent Cognitive Alarm Platform* requirements PDF. It distinguishes features implemented in this codebase from items listed in the requirements but not included in this web build.

## Contents

- [Project goals](#project-goals)
- [Implemented features](#implemented-features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Run locally with Docker](#run-locally-with-docker)
- [Configuration](#configuration)
- [Accounts and roles](#accounts-and-roles)
- [Alarm and challenge behavior](#alarm-and-challenge-behavior)
- [Analytics and habit score](#analytics-and-habit-score)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Known limitations and requirements not included](#known-limitations-and-requirements-not-included)
- [Troubleshooting](#troubleshooting)
- [Project requirements mapping](#project-requirements-mapping)

## Project goals

The requirements document describes a platform intended to improve wake-up consistency, reduce oversleeping, and encourage healthier sleep routines. Users configure alarms and sleep goals, then solve personalized puzzles, riddles, memory tasks, logic problems, or math exercises to dismiss an alarm. Difficulty and recommendations can adapt to observed performance, snoozing, sleep schedules, and engagement.

The requirements name three roles:

- **User / Member**
- **Wellness Coach**
- **Administrator**

## Implemented features

### Authentication and account management

- Registration and login.
- Short-lived JWT access tokens and rotating refresh tokens.
- Optional Google OAuth sign-in when OAuth credentials are configured.
- Role-based access for members, wellness coaches, and administrators.
- Profile and preference editing, password changes, and account deletion.
- Account lockout after repeated failed logins.
- Coach applications require administrator approval.
- A member must accept a coach invitation before that coach can access the member's analytics.
- Administrative user management, role changes, account activation/deactivation, account unlocking, and audit records.

### Alarm scheduling and wake-up workflow

- Multiple alarms per account.
- Create, edit, activate/deactivate, and delete alarms.
- Daily, weekday, weekend, one-time, and smart-adaptive alarm types.
- Custom repeat days, sound, volume, challenge types, difficulty, snooze limits, and snooze duration.
- Time-zone-aware scheduling.
- A test-ring/practice workflow that does not count toward normal habit statistics.
- Server-side answer validation and wake-session tracking.
- A full-screen ringing challenge in the web interface.
- Snoozing can increase the next challenge's difficulty.

### Cognitive challenge engine

Seven challenge categories are supported:

1. Math problems
2. Logic puzzles
3. Memory challenges
4. Word games
5. Pattern recognition
6. Riddles
7. Quick quizzes

The code generates several challenge categories procedurally and uses a curated question bank for others. Correct answers are kept server-side rather than sent to the browser. Challenge difficulty has five levels: **Beginner, Easy, Medium, Hard, Expert**.

### Wake-up verification

The configured verification method determines what must be completed before an alarm session can be dismissed:

| Method | Requirement |
|---|---|
| Puzzle | Solve one challenge |
| Multi-step | Solve three challenges of different types |
| Consecutive | Get three correct answers in a row; a wrong answer resets the streak |
| Timed | Solve a challenge under a tighter time limit |
| Accuracy check | Answer five questions with at least four correct |

### Personalization, analytics, and recommendations

- User preferences for wake time, bedtime, sleep duration, time zone, productivity goals, challenge types, and difficulty.
- Sleep logs, sleep trends, wake-up statistics, snooze patterns, streaks, challenge performance, and productivity correlations.
- Adaptive difficulty using a scikit-learn logistic-regression model.
- Per-user challenge-type selection using a Thompson-sampling bandit approach.
- Explanatory, rule-based recommendations for sleep, wake-up behavior, habits, productivity, and challenge preferences.
- Habit-score history and dashboards for members, coaches, and administrators.

### Notifications and reports

- In-app notifications and browser notifications.
- Bedtime and wake-up reminders, habit/progress notifications, and administrator announcements.
- PDF and Excel exports for habit, wake-up, challenge, productivity, and sleep reports.
- An administrator system report.

### Interface

- React single-page web application.
- Member, coach, and administrator areas with role-aware navigation.
- Light, dark, and system/adaptive theme options.
- Responsive page layouts, charts, animated interactions, and reusable UI components.

## Technology stack

| Area | Technologies used by this project |
|---|---|
| Frontend | React 18, JavaScript, Vite, React Router, Axios |
| Styling and interaction | Tailwind CSS, PostCSS, Framer Motion, Lucide React |
| Charts | Recharts |
| Backend API | Python 3.11, FastAPI, Uvicorn, Pydantic |
| ORM and primary database | SQLAlchemy 2, PostgreSQL 16 |
| Event storage | MongoDB 7 via PyMongo for challenge event logging |
| Authentication/security | PyJWT, bcrypt, HttpOnly refresh cookies, role checks |
| Scheduling and time zones | APScheduler, Python `zoneinfo`, `tzdata` |
| Adaptive logic and analytics | scikit-learn, NumPy, pandas |
| Report generation | ReportLab, openpyxl |
| Frontend web server | Nginx unprivileged image |
| Containers | Docker, Docker Compose |
| Automated checks | pytest, Vitest, Testing Library, GitHub Actions CI |
| Development tools mentioned in the requirements | VS Code, Git/GitHub, Postman |

**Important distinction:** React Native, Firebase Cloud Messaging, Android Alarm Manager, iOS local notifications, XGBoost, TensorFlow, PyTorch, Chart.js, Plotly, AWS, and Azure appear in the requirements or architecture discussion, but are not implemented as part of this supplied web application. Recharts is used for charts.

## Architecture

```text
Browser
  |
  | HTTP on localhost:5173 (local setup)
  v
Nginx frontend container
  |-- serves the built React application
  |-- proxies /api requests
  v
FastAPI backend container
  |-- authentication and role authorization
  |-- alarm scheduler and wake-session verification
  |-- challenge generation, analytics, recommendations
  |-- PDF/Excel reports
  |-- SQLAlchemy
  |       v
  |    PostgreSQL container (persistent volume)
  |
  |-- PyMongo event logging
          v
       MongoDB container (persistent volume)
```

The backend scheduler runs inside the FastAPI process, so the backend is intentionally configured to use **one worker**. The PostgreSQL and MongoDB ports are not published to the host by the supplied Compose configuration; the browser reaches the API through Nginx.

## Project structure

```text
wakeful/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions backend tests + frontend build
├── backend/
│   ├── app/
│   │   ├── core/                  # Settings, database, security, middleware, dependencies, time zones
│   │   ├── routers/               # API routes for auth, OAuth, users, alarms, wake, sleep,
│   │   │                          # insights, notifications, coaches, admins, and reports
│   │   ├── services/              # Scheduling, challenge generation, verification, analytics,
│   │   │                          # adaptive difficulty, recommendations, reminders, reports, event logs
│   │   ├── main.py                # FastAPI application and startup lifecycle
│   │   ├── models.py              # SQLAlchemy database models and supported enum values
│   │   ├── schemas.py             # Request validation schemas
│   │   └── views.py               # Response/view helpers
│   ├── tests/                    # Backend security, feature, and ringing tests
│   ├── requirements.txt           # Pinned Python dependencies
│   ├── pytest.ini
│   └── Dockerfile
├── frontend/
│   ├── public/                    # Favicon and early theme initialization
│   ├── src/
│   │   ├── api/                   # API client and session refresh behavior
│   │   ├── components/            # App shell, alarm overlay, theme, notifications, UI
│   │   ├── context/               # Authentication, alarm, and theme state
│   │   ├── lib/                   # Sound and formatting helpers
│   │   ├── pages/
│   │   │   ├── member/            # Dashboard, alarms, sleep, insights, history, reports, settings
│   │   │   ├── coach/              # Coach overview and member detail
│   │   │   └── admin/              # Overview, users, approvals, recommendations, audit, system
│   │   ├── App.jsx                # Routes and client-side role guards
│   │   ├── main.jsx               # React entry point
│   │   └── smoke.test.jsx         # Frontend smoke/UI tests
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── nginx.conf
│   └── Dockerfile
├── docs/
│   └── USER_GUIDE.md              # Short guide for members, coaches, and administrators
├── scripts/
│   └── make_env.ps1               # Creates a local .env with generated secrets if none exists
├── .env.example                   # Configuration template; replace example values before use
├── .gitignore
├── docker-compose.yml             # PostgreSQL, MongoDB, backend, and frontend
├── start.bat                      # Windows startup helper
├── stop.bat                       # Stops containers without deleting named volumes
├── reset.bat                      # Destructive reset; deletes named Docker volumes
└── start.sh                       # macOS/Linux startup helper
```

## Run locally with Docker

### Requirements

- Windows with Docker Desktop, or macOS/Linux with Docker Engine and the Docker Compose plugin.
- Docker must be running before starting the project.
- A modern browser.

### Windows (recommended for this package)

1. Extract the ZIP archive.
2. Open the extracted `wakeful` folder — the folder that contains `docker-compose.yml`.
3. Start Docker Desktop and wait until it reports that Docker is running.
4. Double-click **`start.bat`**.
5. On first run, the helper creates a local `.env` file with generated secrets if `.env` does not already exist, then builds and starts the containers. The initial build may take several minutes.
6. Keep the generated administrator credentials private. The startup helper prints them; they are also written to `.env`.
7. Open **http://localhost:5173** if the browser does not open automatically.

### macOS / Linux

From the extracted `wakeful` project directory:

```bash
chmod +x start.sh
./start.sh
```

### Manual Docker Compose start

From the directory containing `docker-compose.yml`, create `.env` from `.env.example`, replace all placeholder passwords/secrets with strong unique values, then run:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Open `http://localhost:5173`.

Useful commands, run from the same directory:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
docker compose logs -f mongo
docker compose ps
docker compose down
```

`docker compose down` stops and removes the containers but keeps the named database volumes. **Do not run `reset.bat` or `docker compose down -v` unless you intentionally want to delete stored database data.**

## Configuration

The `.env` file is for local/private configuration and should not be committed to Git. `.env.example` is only a template; its sample values are not production secrets.

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Password for the PostgreSQL service |
| `MONGO_PASSWORD` | Password for the MongoDB root account |
| `SECRET_KEY` | Secret used to sign JWT access tokens; production requires a strong value of at least 32 characters |
| `ADMIN_EMAIL` | Email for the initial administrator account |
| `ADMIN_NAME` | Display name for the initial administrator |
| `ADMIN_PASSWORD` | Initial administrator password, used when bootstrapping an administrator |
| `SEED_DEMO_DATA` | Enables/disables demo accounts and sample history |
| `DEMO_PASSWORD` | Password shared by seeded demo accounts |
| `PUBLIC_URL` | Public base URL used for OAuth/cookie/CORS configuration |
| `WEB_PORT` | Host port exposed by the frontend container (default `5173`) |
| `COOKIE_SECURE` | Set to `true` when serving over HTTPS; local HTTP uses `false` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth credentials |

For real use, set `SEED_DEMO_DATA=false`, use unique strong secrets, and keep `.env` private. When deploying over HTTPS, set `PUBLIC_URL` to the HTTPS origin and `COOKIE_SECURE=true`. Configure the Google OAuth redirect URI as:

`<PUBLIC_URL>/api/auth/google/callback`

The startup script creates `.env` only when it does not already exist. If you already have a `.env`, it will not overwrite it.

## Accounts and roles

- **Member/User:** manages their own profile, alarms, sleep logs, challenge history, notifications, analytics, and reports.
- **Wellness Coach:** must be approved by an administrator. A coach can invite members, but the member must accept before their data is shared. Members can revoke sharing.
- **Administrator:** manages accounts and roles, approves coaches, monitors recommendations/system status, reviews audit records, and sends announcements.

On a new local installation, the initial admin is configured through `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Demo accounts are created only when `SEED_DEMO_DATA=true`; their password is the value in `DEMO_PASSWORD`. The local startup helper currently defaults demo seeding to `true`; turn it off in `.env` before using the installation with real personal data. Avoid publishing or sharing generated credentials.

## Alarm and challenge behavior

- The scheduler checks for due alarms at a short interval and creates wake sessions.
- The browser tab polls for active sessions, plays the configured sound, and displays the challenge overlay.
- The server validates answers and controls dismissal; the browser does not receive the stored correct answer.
- The browser must remain open for a web alarm to ring reliably. This version does not provide native mobile alarms when the browser is closed or the device is locked.
- Browser sound and notifications may require permission or an initial user interaction in the browser.
- A test ring is intended for practice and is excluded from normal statistics.

## Analytics and habit score

The habit score follows the weighting in the requirements PDF:

| Component | Weight |
|---|---:|
| Wake-up consistency | 35% |
| Challenge completion success | 25% |
| Snooze reduction | 20% |
| Sleep schedule adherence | 20% |

The code can renormalize the score when a component has insufficient data. Dashboards also include wake-up success, missed alarms, snoozes, streaks, challenge accuracy and timing, sleep patterns, and productivity correlations.

### How the adaptive logic should be described

The adaptive-difficulty model starts from **synthetic, rule-labelled bootstrap examples** because no real behavior history exists for a new user. It can retrain on real sessions when sufficient labeled data is available. The challenge-type selector uses a per-user Thompson-sampling bandit. Recommendations are generated by a transparent rule-based engine. These are adaptive/ML-assisted features, but they should not be described as a large model trained on external human datasets.

## Testing

### Backend

The backend tests are in `backend/tests/` and cover authentication/security, feature behavior, and ringing/verification workflows. The supplied suite contains **44 backend test functions**; the project owner has reported that all 44 pass in the current Docker setup.

For a native Python test environment:

```bash
cd backend
pip install -r requirements.txt
python -m pytest -v
```

Or, when the test files are available inside the running backend container:

```bash
docker compose exec backend python -m pytest /app/tests -v
```

The backend Dockerfile copies the application code but not the test directory. If `/app/tests` is not present in the container, run the tests from the host `backend` folder or copy the tests into the container for a temporary test run. Pytest cache permission warnings can occur in the unprivileged container; those warnings do not themselves mean a test failed.

### Frontend

The frontend uses Vitest and Testing Library. From `frontend/`, install the dependencies and run:

```bash
npm install
npm test
npm run build
```

### Continuous integration

`.github/workflows/ci.yml` defines GitHub Actions jobs for backend pytest and a frontend production build on pushes and pull requests. Review the workflow results in GitHub after pushing the repository.

## Security notes

This project includes several defensive measures in code, including password hashing, short-lived access tokens, refresh-token rotation and reuse detection, server-side role checks, rate limiting/lockout logic, security headers, and restricted container privileges. These measures are helpful but do not constitute a formal security audit.

Before any public deployment:

1. Set `SEED_DEMO_DATA=false` and remove demo credentials/data from the environment.
2. Use HTTPS and set `COOKIE_SECURE=true`.
3. Generate unique production secrets; never reuse example or demo passwords.
4. Keep `.env`, database dumps, tokens, and personal data out of GitHub and screenshots.
5. Review dependencies for known vulnerabilities and update pinned versions deliberately.
6. Configure backups and test restoring them.
7. Add production monitoring, log retention, and incident-response procedures.
8. Perform a separate security review and end-to-end authorization testing against the deployed configuration.

The included configuration exposes the frontend port on the host and keeps database/backend ports internal to the Compose network. For an internet deployment, place the app behind a correctly configured HTTPS reverse proxy/firewall and review host exposure, backups, secrets, and cookie settings.

## Known limitations and requirements not included

The requirements PDF describes a broader target platform than this repository implements. The following items are **not included in this web build** or are not represented as implemented code:

- React Native mobile app.
- Native Android Alarm Manager and iOS local notifications.
- Firebase Cloud Messaging / mobile push notifications.
- Cloud deployment automation for AWS or Azure. Docker Compose is included; cloud deployment must still be configured and verified.
- TensorFlow, PyTorch, and XGBoost models.
- Chart.js and Plotly charts; the frontend uses Recharts.
- A distributed microservice deployment, Redis, Elasticsearch, vector storage, or a time-series database from the architecture diagram.
- Reliable ringing after the browser has been closed or the device has been locked.

The app's scheduler runs inside the FastAPI process and is configured for one worker. A multi-replica production deployment would need a separate, coordinated scheduler design to avoid duplicate alarm processing.

## Troubleshooting

### `no configuration file provided`

The terminal is not in the directory containing `docker-compose.yml`. Change directory to the extracted `wakeful` project root, then retry.

### Docker engine / named-pipe connection error

Open Docker Desktop, wait until it is fully running, then retry `docker compose ps`.

### Missing environment variable errors

Make sure `.env` exists next to `docker-compose.yml`, and that `POSTGRES_PASSWORD`, `MONGO_PASSWORD`, and `SECRET_KEY` have non-empty values. Run `docker compose config --quiet` to validate Compose configuration. Do not paste secret values into support chats.

### Frontend opens but API requests fail / show 502

Check service status and backend logs:

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 db
docker compose logs --tail=100 mongo
```

Resolve backend startup or database errors before restarting the frontend. Do not share `.env` contents in bug reports.

### Port 5173 is already in use

Set `WEB_PORT` to another free host port in `.env` (for example, `5174`) and restart the Compose stack. The app URL then becomes `http://localhost:5174`.

### Resetting the installation

`stop.bat` stops containers without intentionally deleting database volumes. `reset.bat` runs `docker compose down -v` after a confirmation prompt and **deletes the named database volumes**. Use it only if you deliberately want a fresh database.

## Project requirements mapping

| Requirements PDF module | Status in this repository |
|---|---|
| 1. Authentication and role-based access | Implemented: registration/login, JWT, optional Google OAuth, member/coach/admin roles and profile management |
| 2. User profile and habit management | Implemented: sleep/wake preferences, goals, time zone, challenge preferences and reminders |
| 3. Alarm scheduling system | Implemented in web app: recurring, one-time, smart-adaptive, multiple and customizable alarms |
| 4. Cognitive challenge engine | Implemented: seven challenge types and server-side answer validation |
| 5. Adaptive difficulty engine | Implemented with bootstrap-trained scikit-learn logistic regression and adaptive challenge-type selection |
| 6. Wake-up verification | Implemented: five verification methods and snooze-aware workflows |
| 7. Behavioral analytics | Implemented: wake-up behavior, snoozes, sleep, challenge and productivity analytics |
| 8. Habit scoring | Implemented with the specified 35/25/20/20 weights |
| 9. Recommendation engine | Implemented as transparent rule-based recommendations |
| 10. Dashboards and analytics | Implemented for members, coaches, and administrators |
| 11. Notifications and reminders | In-app/browser notifications and reminders; native mobile push is not included |
| 12. Reports and exports | PDF and Excel exports |
| 13. Integration, testing and deployment | Docker Compose, health checks, tests, logging and CI workflow included; public cloud deployment and production monitoring still require setup |

## License

No license file was present in the supplied archive. Add a `LICENSE` file before distributing the project publicly if you want to specify reuse, modification, and distribution terms.
