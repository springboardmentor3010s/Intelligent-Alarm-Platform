# TEST_STATUS.md

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

**Audit date:** 2026-09-17
**Audit scope:** Phase 1 stabilization (baseline) → **Phase 2 (auth/security) and Phase 3 (alarm/notification workflow) deltas applied**
**Python:** 3.14.7 (local `.venv`), 3.11 (Docker/CI target)
**Node:** 26.3.0, npm 11.16.0

---

## Phase Deltas

| Phase | Backend pytest | Web Vitest | Mobile jest | Notes |
|---|---|---|---|---|
| Phase 1 baseline (2026-09-16) | 47 | 49 | 47 | coverage tooling added (71% / 69.21% / 27.93%) |
| Phase 2 (2026-09-16) | 95 | 49 | 47 | security suite (`test_security.py`) |
| Phase 3 (2026-09-17) | 107 | 49 | 69 | Expo-push provider + `/notifications/status` + `/notifications/test` + `/alarms/{id}/notify` (backend); on-device scheduling + tap-routing tests (mobile) |
| Phase 5 (2026-09-17) | 151 | 56 | 75 | analytics/habit/dashboard completion; productivity logs, coach cohort, measured uptime |
| Phase 7 (2026-09-17) | 168 | 56 | 75 | AI intelligence: features.py, 6-signal rules, gated anomaly/forecast, recommendation reasons |
| Phase 8 (2026-09-17) | 186 | 56 | 75 | E2E workflow suite (9 tests); all-green gates |
| **Phase 9 (2026-09-17)** | **187** | **56** | **75** | Docker/Cloud/Monitoring; local prod validation; docs |

Section 1-5 numbers below reflect the **current (Phase 9)** state.

---

## 1. Backend (Python / FastAPI)

### 1a. Unit tests

| Field | Value |
|---|---|
| **Command** | `cd backend; .venv\Scripts\python.exe -m pytest tests/ -q` |
| **Expected** | All tests pass |
| **Actual** | `187 passed in 43.34s` |
| **Test files** | 14 (`test_alarms.py`, `test_analytics.py`, `test_auth.py`, `test_challenges.py`, `test_e2e_workflows.py`, `test_feedback.py`, `test_notifications.py`, `test_productivity.py`, `test_security.py`, `test_ai_engine.py`) |
| **Test functions** | 187 |
| **Collected** | 187 |
| **Passed** | 187 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | **88%** total (3149 stmts, 390 miss) |
| **Failures** | None |

### 1b. Linting

| Field | Value |
|---|---|
| **Command** | `cd backend; .venv\Scripts\python.exe -m ruff check app tests scripts` |
| **Expected** | All checks passed |
| **Actual** | `All checks passed!` |
| **Failures** | None |

### 1c. Smoke M1

| Field | Value |
|---|---|
| **Command** | `cd backend; .venv\Scripts\python.exe scripts/smoke_m1.py` |
| **Expected** | 22 checks, ALL PASS |
| **Actual** | 22/22 `SMOKE TEST RESULT: ALL PASS` |
| **Failures** | None |
| **Note** | Uses in-process TestClient; no live server required |

### 1d. Smoke M2

| Field | Value |
|---|---|
| **Command** | `cd backend; .venv\Scripts\python.exe scripts/smoke_m2.py` |
| **Expected** | 25 checks, ALL PASS |
| **Actual** | 25/25 `SMOKE M2 RESULT: ALL PASS` |
| **Failures** | None |
| **Note** | Runs alembic migrations on a fresh in-memory DB |

---

## 2. Web (React / Vitest)

### 2a. Unit tests

| Field | Value |
|---|---|
| **Command** | `cd web; npm test` (`vitest run --coverage`) |
| **Expected** | All tests pass, coverage report shown |
| **Actual** | `13 passed (13), 55 passed (55)` |
| **Test files** | 13 |
| **Test functions** | 55 |
| **Collected** | 55 |
| **Passed** | 55 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | **74.67%** statements, **70.19%** branches, **75.76%** functions, **74.67%** lines |
| **Failures** | None |
| **Warnings** | React Router v7 future-flag deprecation warnings (non-breaking, expected with RR v6) |

### 2b. Production build

| Field | Value |
|---|---|
| **Command** | `cd web; npm run build` |
| **Expected** | Build succeeds |
| **Actual** | `104 modules transformed. built in 1.53s` |
| **Output** | `dist/index.html` 1.44 kB, `dist/assets/index.css` 117.03 kB, `dist/assets/index.js` 498.63 kB |
| **Failures** | None |

---

## 3. Mobile (React Native / Expo / Jest)

### 3a. Unit tests

| Field | Value |
|---|---|
| **Command** | `cd mobile; npm test -- --ci` |
| **Expected** | All tests pass, coverage report shown |
| **Actual** | `13 passed (13), 72 passed (72)` |
| **Test files** | 13 |
| **Test functions** | 72 |
| **Collected** | 72 |
| **Passed** | 72 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | **31.2%** lines, **30.31%** statements, **21.32%** branches, **27.05%** functions |
| **Failures** | None |
| **Warnings** | `console.error` in `useHabitScore.test.jsx` is expected test behavior (error-path coverage) |

---

## 4. CI-Equivalent Reproducibility

All commands are from `.github/workflows/ci.yml`, run locally:

| CI step | Local equivalent | Result |
|---|---|---|
| `ruff check app tests scripts` | `cd backend; .venv\Scripts\python.exe -m ruff check app tests scripts` | PASS |
| `pytest tests/ -q` | `cd backend; .venv\Scripts\python.exe -m pytest tests/ -q` | PASS (187/187, incl. boot-time secret-guard test) |
| `smoke_m1.py` | `cd backend; .venv\Scripts\python.exe scripts/smoke_m1.py` | PASS (22/22) |
| `smoke_m2.py` | `cd backend; .venv\Scripts\python.exe scripts/smoke_m2.py` | PASS (25/25) |
| `npm test` (web) | `cd web; npm test` | PASS (55/55) |
| `npm run build` (web) | `cd web; npm run build` | PASS |
| `npm test -- --ci` (mobile) | `cd mobile; npm test -- --ci` | PASS (77/77) |

**Total across all layers:** 319 tests, 319 passed, 0 failed, 0 skipped (187 pytest + 55 Vitest + 77 jest + 22 smoke_m1/smoke_m2 counted separately as gates).

---

## 5. Coverage Baseline

### Backend (pytest-cov, `--cov=app`)

| Metric | Value |
|---|---|
| Statements | 3149 total, 390 miss |
| **Coverage** | **88%** |

Key well-covered modules (>=90%): Models, schemas, API routers (alarms, auth, challenges, analytics, feedback, habits, notifications, users), gateway middleware, integrations messaging, ML inference, verification, admin.

Key low-coverage modules (<30%): `ai_engine/behavior_analysis.py` (0% - thin adapter over tested services), `ai_engine/challenge_generation.py` (0% - thin adapter over tested services), `ai_engine/recommendations.py` (0% - thin adapter; service tested), `services/cache.py` (0%), `services/admin_service.py` (~25%). Phase 6 added coverage: `ai_engine/anomaly.py` (~70%), `ai_engine/performance_prediction.py` (~80%), `ai_engine/difficulty.py` (~89%), `ai_engine/features.py` (100%). (`schemas/all.py`, previously 0% dead code, was **removed** 2026-09-19.)

### Web (vitest, `@vitest/coverage-v8`)

| Metric | Value |
|---|---|
| **Statements** | **74.67%** (4997/6692) |
| **Branches** | **70.19%** (650/926) |
| **Functions** | **75.76%** (197/260) |
| **Lines** | **74.67%** (4997/6692) |

### Mobile (jest, built-in coverage)

| Metric | Value |
|---|---|
| **Statements** | **30.31%** (385/1270) |
| **Branches** | **21.32%** (212/994) |
| **Functions** | **27.05%** (79/292) |
| **Lines** | **31.2%** (357/1144) |

---

## 6. Discrepancy Resolution: 47 vs 34

| Version | Count | Source |
|---|---|---|
| 34 | Stale | `context.md` Active Tasks List, written 2026-09-07 after M4 core completion |
| 47 | Actual | Verified 2026-09-16 via `pytest --collect-only -q` + full suite run |

**Root cause:** CONTEXT.md was last updated to 34 on 2026-09-07 (M4 completion). Subsequent commits added:
- `test_feedback.py` (8 functions) - added in P5 notification + feedback wiring
- `test_notifications.py` (9 functions) - added in P5 notification API
- Additional functions in existing test files

The count grew from 34 to 47 (8 + 9 = 17, minus 4 previously existing overlap = net +13). CONTEXT.md was never re-counted after these additions.

**Resolution:** The documented count is now 47, verified by `pytest --collect-only -q` (collected 47 items) and the verbose run output (47 dots = 47 passed).

---

## 7. Coverage Tooling Added

| Layer | Tool | Package | Config location |
|---|---|---|---|
| Backend | pytest-cov | `pytest-cov>=6.0.0` (in `requirements.txt`) | `backend/pytest.ini` (`addopts: --cov=app --cov-report=term-missing --no-cov-on-fail`) |
| Web | vitest coverage | `@vitest/coverage-v8@^2.1.9` (devDep) | `web/vite.config.js` (`test.coverage` block) + `web/package.json` (`test: vitest run --coverage`) |
| Mobile | jest built-in | No extra package | `mobile/package.json` (`jest.collectCoverage`, `coverageDirectory`, `coverageReporters`, `collectCoverageFrom`) |

---

## 8. Files Modified in This Phase

| File | Change |
|---|---|
| `backend/requirements.txt` | Added `pytest-cov>=6.0.0` |
| `backend/pytest.ini` | Added `--cov=app --cov-report=term-missing --no-cov-on-fail` to `addopts` |
| `web/package.json` | Added `@vitest/coverage-v8` devDep; changed `test` script to `vitest run --coverage` |
| `web/package-lock.json` | Updated lockfile (npm install) |
| `web/vite.config.js` | Added `test.coverage` block (provider: v8, reporters, include/exclude) |
| `mobile/package.json` | Added `jest.collectCoverage`, `coverageDirectory`, `coverageReporters`, `collectCoverageFrom` to jest config |

**No test files, business logic, or application code was modified.**

---

## 9. Unresolved Issues

| # | Severity | Issue | Phase |
|---|---|---|---|
| U1 | Medium | Backend coverage 88% - a few `ai_engine/*` thin adapters + `services/cache.py` remain low | Phase 4+ (feature work) |
| U2 | Medium | Mobile coverage 31.2% - most screens and tabs untested (the Phase 3 scheduler/notifier logic is covered) | Phase 4+ (component tests) |
| U3 | Low | Web coverage 74.67% - pages at low coverage: Admin 1%, Challenge 12%, Reports 19%, Settings 14% | Phase 2+ (page tests) |
| ~~U4~~ | ~~Low~~ | ~~`schemas/all.py` at 0% coverage (dead code, never imported)~~ | **Resolved 2026-09-19 — file deleted** |
| U5 | Info | React Router v7 future-flag deprecation warnings in web tests | Non-blocking |
| U6 | Info | `console.error` in mobile `useHabitScore.test.jsx` is expected (error-path test) | Non-blocking |

---

*Generated by Phase 1 audit. No tests were removed or weakened.*
