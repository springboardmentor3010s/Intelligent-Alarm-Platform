# Intelligent Cognitive Alarm Platform

This project delivers a full-stack intelligent wake-up assistant that combines alarm scheduling, habit tracking, cognitive challenge verification, and adaptive recommendation analytics. Its four milestones document implementation tasks; they are not user-facing product features. The platform includes a FastAPI backend, React frontend, PostgreSQL-ready schema, AI/analytics services, and Docker deployment configuration.

## 1. Project Objectives

- Reduce snooze frequency and improve successful wake-up rates.
- Increase cognitive engagement during wake-up routines.
- Improve long-term habit adherence and sleep consistency.
- Encourage productive daily routines through intelligent alarm interactions.
- Support large-scale alarm scheduling and behavioral analytics with stable performance.

## 2. System Overview

The platform is designed around a user-centered lifecycle:

1. Register or sign in with JWT authentication.
2. Configure a profile, role preference, sleep targets, and wake preferences.
3. Schedule smart alarms with difficulty, challenge type, and challenge counts.
4. Trigger the alarm and solve wake-up verification challenges.
5. Track habit performance, recommendation relevance, and challenge accuracy.
6. Review dashboard analytics and deployment-ready reporting output.

## 3. Architecture

### Frontend
- React + Vite application
- User auth, profiles, alarms, challenge flow, analytics, PDF/Excel reports, and notifications
- Role-specific wellness coach and administrator dashboards
- API integration for interacting with the backend

### Backend
- FastAPI application exposing REST endpoints for auth, alarms, challenges, profile, dashboard, notifications, reports, and users
- SQLAlchemy data layer with Postgres-ready configuration
- JWT-based access control and role-aware access system; privileged roles are assigned by administrators, not at public registration

### Database
- Primary relational database: PostgreSQL in Docker; SQLite is the local development default
- Schema contains users, alarms, notifications, activities, challenges, attempts, recommendations, and per-completion alarm performance
- MongoDB telemetry integration falls back to JSONL files when a MongoDB service is unavailable

### AI and recommendation modules
- Challenge engine for math, logic, memory, riddle, and word tasks
- Habit-scoring and analytics service
- Dashboard and post-completion recommendation generation from recorded behavior
- Adaptive difficulty logic for wake-up challenge personalization

## 4. Current implementation boundaries

- The included client is a React web application. A React Native mobile client and native Android/iOS alarm scheduling are not included; the API currently returns native scheduling payloads for a future mobile client.
- OAuth2 password-form login and JWT are implemented. Third-party social OAuth providers are not configured.
- FCM payload construction is implemented, but push delivery requires a Firebase project, device tokens, and service credentials.
- Docker Compose is configured for local PostgreSQL-backed deployment. AWS/Azure deployment and production credentials are not present in this repository.
- Charts currently use Recharts and the app's CSS design system rather than Chart.js/Plotly and Tailwind CSS.
- Performance metrics are reported from recorded data; API response latency, productivity impact, and concurrency capacity remain explicitly unmeasured until instrumented or load-tested.

## 5. Implementation Milestones

Milestones track the development work used to build the product. After signing in, each user works with their own profile, alarms, wake-up challenges, sleep target, snoozes, completions, and performance history.

### Milestone 1: Week 1 & 2 — Project Initialization, Design Process & Core Setup

Tasks:
- Define project objectives and cognitive alarm workflows.
- Design system architecture and database schema.
- Create UI wireframes and workflow planning.
- Set up frontend and backend environments.
- Implement authentication and role-based access.
- Build user profile and habit management.
- Develop alarm scheduling functionality.

Outcomes:
- Understand intelligent alarm and habit formation workflows.
- Learn system architecture and database design concepts.
- Build frontend and backend project initialization.
- Working authentication and alarm scheduling system.

### Milestone 2: Week 3 & 4 — Cognitive Challenges & Verification System

Tasks:
- Implement cognitive challenge engine.
- Build puzzle generation workflows.
- Develop wake-up verification mechanisms.
- Create challenge evaluation systems.
- Generate challenge analytics.

Outcomes:
- Cognitive challenge engine operational.
- Wake-up verification workflows functional.
- Challenge evaluation system completed.

### Milestone 3: Week 5 & 6 — Adaptive Intelligence & Recommendations

Tasks:
- Implement adaptive difficulty engine.
- Build behavioral analytics workflows.
- Develop habit scoring models.
- Generate recommendation engine outputs.
- Create habit tracking dashboards.

Outcomes:
- Adaptive difficulty engine operational.
- Habit scoring system functional.
- Recommendation workflows completed.

### Milestone 4: Week 7 & 8 — Analytics, Testing & Deployment

Tasks:
- Build executive dashboards.
- Add reports and visualization modules.
- Implement testing and validations.
- Deploy using Docker and cloud services.
- Prepare final documentation and presentation.

Outcomes:
- Local frontend/backend integration and end-to-end workflows are covered by tests.
- Docker Compose configuration is prepared for local deployment.
- Cloud production deployment and external-provider setup remain environment-specific.

## 6. Evaluation Criteria

### Milestone 1
- Project initialization completed.
- Authentication implemented.
- Alarm scheduling functional.
- User profile management operational.

### Milestone 2
- Cognitive challenge engine operational.
- Wake-up verification system functional.
- Challenge analytics implemented.

### Milestone 3
- Adaptive difficulty engine operational.
- Habit scoring functional.
- Recommendation workflows completed.

### Milestone 4
- Docker deployment configuration and integrated testing are available.
- Dashboards and reporting systems operational.
- End-to-end cognitive alarm workflow demonstrated.

## 7. Technology Stack

- Programming languages: Python, JavaScript
- Backend: FastAPI
- Frontend: React.js + Vite web application; Recharts and the included CSS design system
- Database: PostgreSQL (Docker), SQLite (local default), MongoDB telemetry with JSONL fallback
- AI/ML: Scikit-learn, XGBoost, Pandas, NumPy, and a Q-learning adaptation policy
- Adaptive intelligence: behavioral analytics, difficulty adaptation, and personalized recommendations
- Notifications: in-app notification lifecycle, FCM payload formatting, and native alarm payload generation
- Cloud and DevOps: Docker Compose configuration; AWS/Azure deployment requires platform credentials and setup
- Authentication: OAuth2 password-form login and JWT access tokens

## 8. Performance Metrics

### Alarm performance
- Alarm dismissal success rate
- Wake-up verification accuracy
- Snooze reduction rate

### Cognitive challenge metrics
- Challenge completion rate
- Challenge accuracy
- Difficulty adaptation effectiveness

### Habit formation metrics
- Habit score improvement
- Wake-up consistency rate
- Sleep schedule adherence

### Recommendation metrics
- Recommendation relevance
- User engagement improvement
- Productivity improvement rate

### System performance
- API response time
- Dashboard loading speed
- Challenge generation latency
- Concurrent user handling capacity

## 9. Example Quantitative Goals

- Wake-up improvement: reduce snooze frequency and increase successful wake-ups.
- Cognitive engagement: increase challenge completion and engagement during wake-up routines.
- Habit formation: improve wake-up consistency and long-term habit adherence.
- Productivity enhancement: encourage productive routines through intelligent interactions.
- Platform performance: support large-scale scheduling and analytics while maintaining stable responsiveness.

## 10. Project Output Summary

This repository contains the working project output for the Intelligent Cognitive Alarm Platform, including:
- backend API and service layer
- database schema and design artifacts
- frontend UI screens and dashboard views
- authentication and authorization flow
- smart alarm scheduling and challenge logic
- analytics and recommendation structure
- Docker deployment configuration
- milestone status evaluation used by the test suite

## 11. Quick Start

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker compose up --build
```

## 12. Role Dashboards and Admin Provisioning

### Initial administrator creation

Use the secure CLI helper to provision the first admin account before enabling privileged dashboard access:

```bash
Set-Location backend
$env:ADMIN_NAME = "Platform Admin"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "Use-a-unique-password-of-at-least-12-chars"
python -m scripts.create_admin
```

The script creates a single admin account only when no matching admin exists. It refuses to overwrite an existing administrator.

### Coach assignment workflow

Sign in with the provisioned account and open the **Admin** dashboard. Register coach and client accounts through the normal sign-up flow, then use **Users** to promote an account to `wellness_coach`. Promoting a coach automatically assigns currently unassigned users to the coach with the smallest roster. New users are assigned the same way when a coach is available; an existing user without an assignment is enrolled on their next successful sign-in. Admins can also use **Assign users without a coach** or manually change assignments from an account detail panel. If no coach exists yet, user accounts remain visibly marked as awaiting a coach. A user cannot be left without a coach while any coach account is available; assign the replacement before removing the final coach.

Coaches only receive access to users explicitly assigned to them; unassigned user detail requests return 404 to avoid disclosing data. Coaches can review the assigned user's recorded behavior and send personalized guidance, which is delivered through the user's in-app notification/recommendation flow.

### Admin login and participation history

Each successful sign-in is recorded with its timestamp. Admin user details include login history, profile goals, alarms, recent activity, and up to 50 recent challenge answers. The Admin roster shows login counts, last login, coach coverage, and alarm counts. The Admin account is also the system-wide Wellness Coach and can review every user in the **Wellness Coach** dashboard without a separate Coach account or per-user assignment. Login history starts when this feature is deployed; earlier sign-ins cannot be reconstructed. Passwords, IP addresses, and device details are not exposed or recorded by this feature.

The sign-in page can remember the email address on the current device and marks the password field for the browser's password manager. The application never stores a readable password; use the browser's built-in password manager if you want it to offer secure password autofill. The existing bearer-token session survives browser restarts until the access token expires (60 minutes by default).

### Completed alarm performance and follow-up

Each successful alarm completion creates a durable performance entry linked to its completion activity. Challenge sessions store actual question count, correct answers, accuracy, average successful response time, difficulty/type, and snoozes recorded during that alarm cycle when a trigger event is available. No challenge metrics are invented for alarms without submitted answers. The completion also creates and displays a recommendation based on those recorded results and an in-app notification. Users can open **Coach Recommendations** to review all saved recommendations and guidance; Admins can see the user's performance count in the roster and up to 100 recent entries in account details; Wellness Coaches can see all recommendations and up to 50 session-level entries in the client's behavior view.

### Dashboard data limits

The platform reports measured values only where real data exists. Sleep duration, sleep adherence, and readiness scores remain unavailable unless the application records that information. The UI explains these limitations instead of inventing a score.

## 13. Repository Structure

- backend/app: FastAPI application
- backend/tests: unittest suite for milestone and validation checks
- frontend/src: React application screens and dashboard
- database/schema.sql: PostgreSQL schema
- docker: deployment configuration
- ml: training and adaptive intelligence assets

## 14. Deployment Notes

The project is prepared for Docker-based deployment and cloud hosting. The backend uses environment-based configuration for database and secret settings, while the frontend is configured to talk to the FastAPI API through a VITE_API_BASE_URL override.
