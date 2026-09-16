# TEST_STATUS.md

**Audit date:** 2026-09-16
**Audit scope:** Phase 1 - Test and Codebase Stabilization
**Python:** 3.14.7 (local `.venv`), 3.11 (Docker/CI target)
**Node:** 26.3.0, npm 11.16.0

---

## 1. Backend (Python / FastAPI)

### 1a. Unit tests

| Field | Value |
|---|---|
| **Command** | `cd backend; .venv\Scripts\python.exe -m pytest tests/ -q` |
| **Expected** | All tests pass |
| **Actual** | `47 passed in 15.38s` |
| **Test files** | 6 (`test_alarms.py`, `test_analytics.py`, `test_auth.py`, `test_challenges.py`, `test_feedback.py`, `test_notifications.py`) |
| **Test functions** | 47 |
| **Collected** | 47 |
| **Passed** | 47 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | **71%** total (2153 stmts, 617 miss) |
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
| **Actual** | `11 passed (11), 49 passed (49)` |
| **Test files** | 11 |
| **Test functions** | 49 |
| **Collected** | 49 |
| **Passed** | 49 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | **69.21%** statements, **74.15%** branches, **72.76%** functions, **69.21%** lines |
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
| **Actual** | `10 passed (10), 47 passed (47)` |
| **Test files** | 10 |
| **Test functions** | 47 |
| **Collected** | 47 |
| **Passed** | 47 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | **27.93%** lines, **27.21%** statements, **20.27%** branches, **26.42%** functions |
| **Failures** | None |
| **Warnings** | `console.error` in `useHabitScore.test.jsx` is expected test behavior (error-path coverage) |

---

## 4. CI-Equivalent Reproducibility

All commands are from `.github/workflows/ci.yml`, run locally:

| CI step | Local equivalent | Result |
|---|---|---|
| `ruff check app tests scripts` | `cd backend; .venv\Scripts\python.exe -m ruff check app tests scripts` | PASS |
| `pytest tests/ -q` | `cd backend; .venv\Scripts\python.exe -m pytest tests/ -q` | PASS (47/47) |
| `smoke_m1.py` | `cd backend; .venv\Scripts\python.exe scripts/smoke_m1.py` | PASS (22/22) |
| `smoke_m2.py` | `cd backend; .venv\Scripts\python.exe scripts/smoke_m2.py` | PASS (25/25) |
| `npm test` (web) | `cd web; npm test` | PASS (49/49) |
| `npm run build` (web) | `cd web; npm run build` | PASS |
| `npm test -- --ci` (mobile) | `cd mobile; npm test -- --ci` | PASS (47/47) |

**Total across all layers:** 143 tests, 143 passed, 0 failed, 0 skipped.

---

## 5. Coverage Baseline

### Backend (pytest-cov, `--cov=app`)

| Metric | Value |
|---|---|
| Statements | 2153 total, 617 miss |
| **Coverage** | **71%** |

Key well-covered modules (>=90%): Models, schemas, API routers (alarms, auth, challenges, analytics, feedback, habits, notifications, users), gateway middleware, integrations messaging, ML inference, verification, admin.

Key low-coverage modules (<30%): `ai_engine/anomaly.py` (0%), `ai_engine/behavior_analysis.py` (0%), `ai_engine/challenge_generation.py` (0%), `ai_engine/performance_prediction.py` (0%), `ai_engine/recommendations.py` (0%), `services/cache.py` (0%), `schemas/all.py` (0% - dead code), `api/sync.py` (32%), `services/admin_service.py` (21%).

### Web (vitest, `@vitest/coverage-v8`)

| Metric | Value |
|---|---|
| **Statements** | **69.21%** (4331/6257) |
| **Branches** | **74.15%** (571/770) |
| **Functions** | **72.76%** (187/257) |
| **Lines** | **69.21%** (4331/6257) |

### Mobile (jest, built-in coverage)

| Metric | Value |
|---|---|
| **Statements** | **27.21%** (276/1014) |
| **Branches** | **20.27%** (163/804) |
| **Functions** | **26.42%** (65/246) |
| **Lines** | **27.93%** (259/927) |

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
| U1 | Medium | Backend coverage 71% - several `ai_engine/*` and `services/cache.py` modules at 0% | Phase 2+ (feature work) |
| U2 | Medium | Mobile coverage 27.93% - most screens and tabs untested | Phase 2+ (component tests) |
| U3 | Low | Web coverage 69.21% - pages at low coverage: Admin 1%, Challenge 12%, Reports 19%, Settings 14% | Phase 2+ (page tests) |
| U4 | Low | `schemas/all.py` at 0% coverage (dead code, never imported) | Cleanup task |
| U5 | Info | React Router v7 future-flag deprecation warnings in web tests | Non-blocking |
| U6 | Info | `console.error` in mobile `useHabitScore.test.jsx` is expected (error-path test) | Non-blocking |

---

*Generated by Phase 1 audit. No tests were removed or weakened.*
