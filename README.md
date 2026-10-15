# Intelligent Cognitive Alarm Platform

An alarm platform that makes you prove you are awake. It uses cognitive challenges,
adaptive difficulty, habit scoring and recommendations. A FastAPI + PostgreSQL backend and
a React frontend.

```
backend/   FastAPI API, models, services, tests, Dockerfile, seed script
frontend/  React source (src/), Dockerfile, nginx.conf
docker-compose.yml   PostgreSQL + API + web app
```

## Passwords and secrets you must provide

| Value | Where | What to do |
|---|---|---|
| `DB_PASSWORD` | `.env` | The password of your PostgreSQL user. **Required.** |
| `ADMIN_JWT_SECRET` | `.env` | A long random secret that signs login tokens. **Required.** Create one with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `SEED_*_PASSWORD` | `.env` | Optional. Passwords for the first admin, coach and demo accounts. If empty, `scripts/seed.py` generates random ones and prints them once. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `.env` | Optional. Only for "Continue with Google". Create an OAuth client in Google Cloud Console and add the redirect URI from `.env.example`. Leave empty to hide the button. |

Copy `backend/.env.example` to `backend/.env` (or `.env.example` values into a root `.env` for Docker)
and fill these in. Never commit `.env`.

## Run without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then edit it
python -m scripts.seed                                 # creates tables and the first accounts
uvicorn app.main:app --reload
```

```bash
cd frontend        # use your project's package.json, index.html and vite config here
npm install
npm run dev        # http://localhost:5173
```

The API is at http://127.0.0.1:8000 (interactive docs at `/docs`). The frontend reads
`VITE_API_URL` (default `http://127.0.0.1:8000`).

Tables and new columns are created automatically when the API starts
(`AUTO_CREATE_TABLES=true`). Existing data is never dropped.

## Run with Docker

```bash
cp backend/.env.example .env      # fill DB_PASSWORD and ADMIN_JWT_SECRET
docker compose up --build
docker compose exec backend python -m scripts.seed
```

Web app: http://localhost:8080 · API: http://localhost:8000

## Roles

- **User**: alarms, challenges, wake-up verification, analytics, reports, settings.
- **Wellness Coach**: dashboard for assigned users (an admin assigns them).
- **Administrator**: user management, platform analytics, announcements, coach assignments.

Self-registration always creates a *User*. Only an administrator can promote someone.

## What was added to the existing project

- **Authentication**: registration, login (JWT), OAuth2 password flow (Swagger), Google OAuth2,
  change password, login throttling, role-based access on every user-data endpoint.
- **Profile and habits**: preferred wake-up time, sleep duration, time zone, productivity goals,
  difficulty preference, habit preferences, wake-up goal tracking.
- **Alarms**: edit, one-time / daily / weekday / weekend / smart adaptive types, next ring time,
  snooze with a daily limit, dismissal only after a successful verification, alarm history.
- **Challenges**: pattern recognition, riddles and quick quizzes; five levels
  (beginner to expert) across every type.
- **Verification**: puzzle, multi-step, consecutive-correct, time-based and accuracy checks,
  judged by the server from recorded answers.
- **Tracking**: sleep logs, productivity check-ins and recommendation views/actions. These feed
  the snooze, sleep and productivity analytics that previously showed "no data".
- **Habit score**: 35% wake-up consistency, 25% challenge completion, 20% snooze reduction,
  20% sleep schedule adherence. A part with no recorded data is left out and the other weights
  are scaled up, so missing data is never counted as zero.
- **Notifications**: automatic bedtime and wake-up reminders, habit / challenge / progress alerts.
- **Reports**: habit, wake-up, challenge, productivity and sleep reports as PDF or Excel.
- **Frontend**: login/register, live dashboard, alarms, challenges, verification, analytics,
  reports, notifications, settings, coach and admin dashboards. Colors are unchanged: the
  original `App.css` rules were not edited, new styles were only appended and use the existing palette.
- **Deployment**: Dockerfiles, `docker-compose.yml`, `.env.example`, seed script, unit tests.

## Tests

```bash
cd backend
pytest
```

The unit tests cover the challenge engine, verification rules, alarm scheduling, tracking
metrics, report rendering and the login limiter. They do not need a database.
The older `test_*.py` scripts in `backend/` talk to a live database and are run by hand.

## Known limits

- The login limiter and request timings are in memory (per process). Use a shared store such as
  Redis if you run several API workers.
- Alarms ring only while Cognitive Alarm is open in a browser tab (the tab may be in the
  background, but the browser must be running and the computer awake). Click the page once
  after opening it so the browser allows sound. A closed browser, a sleeping computer or a
  phone that freezes background tabs will not ring. Ringing when the app is closed needs a
  mobile app or web push, which is not included.
- Sleep and productivity data are entered by the user. They are not read from a wearable.
