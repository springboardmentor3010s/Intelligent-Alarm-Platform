# API Reference — CerebroKognit (Phase 9)

Base URL: `/api/v1` (local prod: `http://localhost:8000/api/v1`). Auth:
`Authorization: Bearer <access_token>` unless noted. Interactive docs:
`/docs`, machine schema: `/openapi.json`. Health (no auth): `GET /health` →
`{status, uptime_seconds, db_connected, total_requests, failed_requests,
success_rate_percent, measured_at}`.

Errors (all): `{detail, error_code, timestamp, status_code}`; `detail` text
is stable for clients. Challenge verification uses explicit codes:
400 malformed/incomplete, 404 unknown/cross-user, 409 already submitted or
consumed, 410 expired.

## Auth (`/auth`) — no auth except where noted
| Method & Path | Auth | Body / Notes | Response |
|---|---|---|---|
| POST `/auth/register` | — | `email, password (≥8), full_name?, timezone?` | `AuthRes` (`access_token`, refresh, user) |
| POST `/auth/login` | — | `email, password` | `AuthRes` |
| GET `/auth/me` | Bearer | — | profile + role |
| POST `/auth/refresh` | — (refresh token) | rotation | new token pair |
| POST `/auth/password-reset/request` | — | generic reply (no enumeration) | message |
| POST `/auth/password-reset/confirm` | — | token + new password | message |
| POST `/auth/verify-email/request` | Bearer | idempotent | message |
| POST `/auth/verify-email/confirm` | — | token | verified flag |
| PUT `/users/profile` | Bearer | `full_name?, timezone?, difficulty_preference?` | profile |
| GET/PUT `/users/settings` | Bearer | settings JSON | settings |
| POST `/users/deactivate` | Bearer | revokes refresh tokens | flag |

## Alarms (`/alarms`)
| Method & Path | Notes |
|---|---|
| GET/POST `/alarms` | list own; create `{title, type, time, challenge_type, difficulty, recurrence?, question_count?}` |
| PUT/DELETE `/alarms/{id}` | owner only (404 otherwise) |
| POST `/alarms/{id}/snooze` | +5 min, cap 5 (6th → 400) |
| POST `/alarms/{id}/dismiss` | `{challenge_attempt_id, correct_answers, total_questions, time_taken_seconds}`; requires completed all-correct unconsumed attempt; recurring alarms reschedule |
| POST `/alarms/{id}/notify` | owner only; server-side push fan-out summary |

## Challenges (`/challenges`)
| Method & Path | Notes |
|---|---|
| GET `/challenges` (+ `?difficulty=&challenge_type=`) | catalog |
| GET `/challenges/next` (+ `?challenge_type=&difficulty=&question_count=`) | creates pending expiring attempt; payload has prompts/options/instructions only — never answers |
| POST `/challenges/submit` | server-authoritative verify; per-question `results` (explanations only for correct answers) + message |

## Habits, analytics, productivity
| Method & Path | Notes |
|---|---|
| GET `/habits/score` (`?date=`) | 35/25/20/20 composite; zeros for no-activity accounts |
| GET `/habits/score/history` (`?days=` 1..365) | most-recent-first; unscored days are `None` gaps |
| GET `/analytics/me` | totals, snooze avg, accuracy, trend, per-type breakdown |
| GET `/analytics/ml-status` | `model_version`, `training_data: synthetic`, fallback, `feature_contract`, `last_training` |
| GET `/analytics/recommendations` | max 6, priority-sorted; every rec has `reason` + `source_metric` |
| GET `/analytics/anomalies` | gated baseline; `available:false` under 5 scored days |
| GET `/analytics/forecast` | gated baseline trend; `available:false` under 4 scored days |
| POST `/productivity/log` (201) | `{score 0-100, date?, note?}`; same-day upsert; `source: user-entered` |
| GET `/productivity/log|/history|/trend|/correlation` | owner only; trend/correl
...[truncated 911 chars]