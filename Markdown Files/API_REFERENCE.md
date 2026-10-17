# API Reference — CerebroKognit (Phase A–D)

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

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
| GET `/productivity/log|/history|/trend|/correlation` | owner only; trend gated under 2 logs; correlation gated under 4 paired days (association-only message) |

## Reports & dashboard (`/dashboard`)
| Method & Path | Auth | Notes |
|---|---|---|
| GET `/dashboard/reports/productivity` | Bearer | user-entered logs; `format=csv\|json\|pdf\|excel` |
| GET `/dashboard/reports/habits` | Bearer | `format=csv\|json\|pdf\|excel`; `?async=1` returns a job id |
| GET `/dashboard/reports/wake-up` | Bearer | tz-aware ordered builder |
| GET `/dashboard/reports/challenges` | Bearer | per-type breakdown |
| GET `/dashboard/reports/status/{job_id}` | Bearer | `queued\|running\|completed\|failed` |
| GET `/dashboard/users` | Bearer (staff+) | admin: all; coach: assigned cohort only |
| PUT `/dashboard/users/{user_id}/role` | Bearer (Admin) | `RoleUpdateReq`; can't change own; audited |
| GET `/dashboard/analytics` | Bearer (Admin) | platform metrics; measured uptime via `system_status` |
| POST `/dashboard/coach/assignments` | Bearer (Admin) | assign user to cohort; 201; 409 duplicate |
| DELETE `/dashboard/coach/assignments` | Bearer (Admin) | `?coach_id=&user_id=` |
| GET `/dashboard/coach/users` | Bearer (staff+) | cohort roster (coach: assigned; admin: all) |
| GET `/dashboard/coach/users/{user_id}` | Bearer (staff+) | scoped detail; 403 outside cohort |

## Notifications (`/notifications`)
| Method & Path | Notes |
|---|---|
| POST `/notifications/register` | register push token (idempotent; reassigns on ownership change) |
| DELETE `/notifications/register` | deregister push token |
| GET `/notifications/tokens` | list caller's push tokens |
| GET `/notifications/status` | push provider + configured + registered-token count |
| POST `/notifications/test` | send a test push to the caller's tokens |
| POST `/notifications/triggers/bedtime` | server-computed bedtime-reminder payload (device schedules locally) |
| POST `/notifications/triggers/challenge` | server-computed challenge-reminder payload |
| POST `/notifications/triggers/habit` | server-computed habit-alert payload |
| POST `/notifications/triggers/progress` | server-computed progress-notification payload |

## Announcements (`/announcements`)
| Method & Path | Auth | Notes |
|---|---|---|
| GET `/announcements/public` | — | active feed (window-filtered, priority-ordered) |
| GET `/announcements` | Administrator | list all |
| POST `/announcements` | Administrator | create (201) |
| GET `/announcements/{id}` | Administrator | fetch one (404 if missing) |
| PUT `/announcements/{id}` | Administrator | update |
| DELETE `/announcements/{id}` | Administrator | delete (204) |

## OAuth2
| Method & Path | Auth | Notes |
|---|---|---|
| GET `/auth/oauth/google/login` | — | returns consent `url` + signed CSRF `state`; 503 when unconfigured |
| POST `/auth/oauth/google/callback` | — | exchange code, verify `id_token`, link-or-create user, issue `AuthRes` |
| POST `/auth/oauth/google/mobile` | — | native PKCE: verify mobile `id_token`, issue `AuthRes` |

## Sync (`/sync`)
| Method & Path | Notes |
|---|---|
| POST `/sync/pending` | upload offline changes (idempotent upsert) |
| GET `/sync/pull` (`?since=`) | download changes since timestamp |