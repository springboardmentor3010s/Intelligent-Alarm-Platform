# End-to-End Test Report — Phase 8 (Full Integration)

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

Date: 2026-09-17 · App: CerebroKognit Intelligent Cognitive Alarm Platform
Executors: backend integration suite (`backend/tests/test_e2e_workflows.py`),
existing suites (pytest/Vitest/jest), smoke scripts. No workflow below is
marked passed on source inspection alone — every PASS row names the executed
test and its observed result.

## Suite totals (executed this phase)

| Layer | Command | Result |
|---|---|---|
| Backend pytest (incl. 9 new E2E workflow tests) | `cd backend; .venv\Scripts\python.exe -m pytest -q` | **187/187 PASS** |
| Ruff | `ruff check app tests scripts` | clean |
| smoke_m1 / smoke_m2 | `scripts/smoke_m1.py`, `scripts/smoke_m2.py` | 22/22, 25/25 PASS |
| Web Vitest | `cd web; npm run test -- --run` | 56/56 PASS |
| Web build | `cd web; npm run build` | clean |
| Mobile jest | `cd mobile; npx jest` | 75/75 PASS |
| **Total** | | **339/339 PASS** |

Browser-driven E2E (Playwright/Cypress) is intentionally not introduced: no
browser harness exists in the repo or CI, and web behavior is covered by 56
component/integration tests plus API-contract tests below. Real-device mobile
alarm/notification firing cannot execute in this environment — see W17.

## Workflow results

### W01 — Registration and login — PASS
- Preconditions: fresh isolated DB.
- Actions: POST `/auth/register` → duplicate register → POST `/auth/login` (good + bad password) → GET `/auth/me`.
- Expected: 200 + tokens; duplicate 400; bad password 401; `/me` returns the email.
- Actual: exactly as expected.
- Evidence: `test_e2e_workflows.py::test_w01_registration_and_login` PASS.

### W02 — Role-based access — PASS
- Preconditions: plain user, coach, admin fixtures.
- Actions: plain user GETs `/dashboard/analytics`, `/dashboard/users`, `/dashboard/coach/users`.
- Expected: all 403.
- Actual: all 403.
- Evidence: `test_w02_w18_w19_w20_role_boundaries` PASS (also `test_security.py` RBAC classes).

### W03 — Profile update — PASS
- Actions: PUT `/users/profile` `{full_name, timezone}` → GET profile.
- Expected: 200; persisted values reflected.
- Actual: `full_name=E2E User`, `timezone=Asia/Kolkata` round-tripped.
- Evidence: `test_w03_profile_update` PASS.

### W04 — Alarm creation — PASS
- Actions: POST `/alarms` One-Time 06:00; GET `/alarms`.
- Expected: 200, enabled, `next_trigger` set, listed.
- Actual: as expected.
- Evidence: `test_w04_w05_alarm_creation` PASS.

### W05 — Recurring alarm — PASS
- Actions: POST `/alarms` Daily 07:00; GET `/alarms`.
- Expected: enabled Daily alarm with computed `next_trigger`.
- Actual: as expected.
- Evidence: `test_w04_w05_alarm_creation` PASS.

### W06 — Snooze behavior — PASS
- Actions: snooze ×2 (check count + trigger shift), snooze to cap, one more.
- Expected: `times_snoozed` 1 then increments; `next_trigger` moves; 6th → 400.
- Actual: as expected (`Maximum snooze limit reached`).
- Evidence: `test_w06_snooze_behavior_and_cap` PASS.

### W07 — Challenge generation — PASS
- Actions: GET `/challenges/next` (Math/Easy/1).
- Expected: 200, attempt id, no `expected_answers` anywhere in payload.
- Actual: as expected.
- Evidence: `test_w07_to_w11_challenge_and_dismissal_journey` PASS (+ `test_challenge_hardening.py` 7×5 matrix).

### W08 — Wrong answer — PASS
- Actions: submit garbage answer.
- Expected: 200, `completed=False`, attempt recorded.
- Actual: as expected.
- Evidence: same journey test PASS.

### W09 — Correct answer — PASS
- Actions: solve served prompt, submit.
- Expected: 200, `completed=True`, all-correct counts.
- Actual: as expected.
- Evidence: same journey test PASS.

### W10 — Incomplete challenge — PASS
- Actions: serve 2-question challenge; dismiss an alarm with an incomplete/submitted-wrong attempt.
- Expected: partial answers never pass; dismissal gate returns 400/409.
- Actual: as expected.
- Evidence: same journey test PASS (+ `test_dismiss_rejects_incomplete_and_unknown_attempts`).

### W11 — Alarm dismissal — PASS
- Actions: dismiss with the completed all-correct attempt; reuse attempt on a second alarm.
- Expected: first 200 `successfully_dismissed=True`; replay rejected.
- Actual: as expected (replay → 409 via `consumed_at`).
- Evidence: same journey test PASS (+ `test_completed_attempt_can_dismiss_only_one_alarm`).

### W12 — Habit score update — PASS
- Actions: GET `/habits/score` after the dismissal journey.
- Expected: `overall_score > 0` and exactly equal to the 35/25/20/20 composite of components.
- Actual: as expected.
- Evidence: `test_w12_w13_w14_downstream_updates` PASS (+ `test_phase5_analytics.py` formula tests).

### W13 — Analytics update — PASS
- Actions: GET `/analytics/me`.
- Expected: `challenge_accuracy > 0`, Math breakdown attempts ≥ 1.
- Actual: as expected.
- Evidence: same test PASS.

### W14 — Recommendation generation — PASS
- Actions: GET `/analytics/recommendations`.
- Expected: list; every rec has `reason` + `source_metric`.
- Actual: as expected.
- Evidence: same test PASS (+ `test_ai_engine.py` rec tests).

### W15 — Report export — PASS
- Actions: habits report JSON/CSV/PDF for 7 days.
- Expected: today's row `overall_score` equals `/habits/score`; CSV contains the score; PDF magic bytes.
- Actual: as expected — dashboard and export values match.
- Evidence: `test_w15_report_export_matches_dashboard` PASS.

### W16 — Push-token registration — PASS
- Actions: POST `/notifications/register` → GET `/tokens` → GET `/status`.
- Expected: `registered=True`; token listed; status count ≥ 1.
- Actual: as expected.
- Evidence: `test_w16_push_token_registration` PASS (+ 21 notification tests).

### W17 — Notification delivery — CONDITIONAL (server PASS, device MANUAL)
- Executed: provider ticket parsing, dead-token pruning (`DeviceNotRegistered`), dedupe suppression, `POST /alarms/{id}/notify` ownership + summary — all PASS in `test_notifications.py` (mocked transport).
- NOT executed here: real Expo Push delivery and on-device alarm firing — requires credentials, a dev build, and a physical device.
- Manual evidence path: `Markdown Files/REAL_DEVICE_CHECKLIST.md` (step-by-step repro: register token → schedule → background/kill app → observe → tap routing).
- Defect reference: none (no failure observed); tracking: device pass pending.

### W18 — Coach dashboard access — PASS
- Actions: promote → assign → coach roster (exactly the member) → scoped detail (all 7 sections) → outsider detail (403) → telemetry (403).
- Expected/Actual: as expected.
- Evidence: role-boundary test PASS (+ `test_phase5_analytics.py` cohort lifecycle, `Admin.test.jsx` coach-mode UI tests).

### W19 — Admin dashboard access — PASS
- Actions: admin GET `/dashboard/analytics` + scoped outsider detail.
- Expected: 200 with measured uptime fields.
- Actual: as expected.
- Evidence: role-boundary test PASS (+ `test_uptime_is_measured_not_hardcoded`).

### W20 — Unauthorized resource access — PASS
- Actions: coach PUT another user's alarm; coach snooze another user's alarm; coach detail outside cohort; user on staff endpoints.
- Expected: 403/404 everywhere; no data leaked.
- Actual: as expected.
- Evidence: role-boundary test PASS.

## Defects found this phase
None — all 20 workflows passed (W17 device leg explicitly manual). Two test-authoring mistakes were fixed during execution (wrong-fixture users in new tests); no product defects.

## Coverage notes
- Web flows (dashboard values, coach cohort UI, reports/productivity forms, empty states): 56 Vitest tests, incl. `Admin.test.jsx` and `Reports.test.jsx` added in Phase 7.
- Mobile flows (challenge submit incl. 409/410, habit score, sync, alarm scheduling units): 75 jest tests; on-device firing manual per checklist.
- API contracts: every workflow above asserts status codes + response shapes; `schemas/` enforced via `response_model`.
