# AI Features — Purpose, Contract, Evaluation (Phase 6)

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

> Every AI feature below has a defined purpose and a measurable evaluation.
> Nothing here is trained on real user data. The single shipped weight file
> (`backend/ml_models/difficulty_model.pt`) is **synthetic-trained**; the
> remaining "AI" is deterministic rules/statistics over real user rows, which
> is stated explicitly per feature. Unsupported claims from earlier docs
> (e.g. "PyTorch/Scikit-learn inference") are corrected: scikit-learn and
> XGBoost are declared dependencies but **unused in code**.

## 1. Adaptive difficulty prediction

| Field | Value |
|---|---|
| Feature name | `difficulty` (`app/ai_engine/difficulty.py`) |
| Business purpose | Pick the next challenge difficulty so wake-up drills stay solvable but non-trivial; never strand a groggy user at Expert or bore a strong user at Beginner |
| Input features | Frozen 4-vector: `success_rate` [0,1], `avg_time_minutes`, `snooze_count/5`, `streak/10` (capped). Rule path additionally uses 6 measured signals: recent accuracy, avg solve time, snooze frequency, failed-attempt count, recent difficulty, wake-up consistency |
| Output | `(predicted_difficulty ∈ Beginner…Expert, method ∈ ml\|rule_based)`; callers clamp to ±1 step of the anchor |
| Algorithm | Feedforward 4→16→5 PyTorch net (v1.0.0); transparent tiered vote (`rule_based_v2`) otherwise |
| Fallback | `rule_based_v2` — monotonic per-signal tiers, neutral vector scores exactly 0; active whenever torch/weights are missing (e.g. lean Docker image) or inference throws |
| Evaluation metric | Held-out **synthetic** accuracy (fresh seed 1234, n=4000) ≥ 0.80; success-sweep monotonicity; extreme-profile sanity (strong≠Beginner, weak≠Expert). Measured 2026-09-17: **0.935**, monotonic 1→3, Hard/Easy extremes — `scripts/evaluate_difficulty_model.py` |
| Current status | Implemented; synthetic-trained, advisory-only, always band-clamped |

## 2. Personalized recommendations

| Field | Value |
|---|---|
| Feature name | `recommendations` (`app/ai_engine/recommendations.py` → `services/recommendation_service.py`) |
| Business purpose | Turn analytics into next actions across sleep / wake-up / habit / challenge |
| Input features | Sleep-window estimate, snooze totals, 14-day consistency trend, attempt matrix (per-type/per-difficulty accuracy, unattempted types), week-over-week completion rates, streak |
| Output | Priority-sorted (max 6) `RecommendationRes`: category, priority, title, message, suggested action, metrics — plus **`reason`** (why it fired) and **`source_metric`** (`{key, value}` audit pointer) |
| Algorithm | Deterministic threshold rules (FR-RE-001..004): 7–9h sleep band, 3+ snooze intervention, declining trend, ±20% completion swing, 60% struggle / 80% mastery bands |
| Fallback | N/A (rules are the implementation; empty data yields zero recs, never fabricated ones) |
| Evaluation metric | Contract tests: every returned rec has category ∈ 4, priority ∈ 3, non-empty title/**reason**/**source_metric**; threshold unit tests (e.g. snoozes≥3 fires wake-up/high) |
| Current status | Implemented (rule-based by design; a learned ranker is future work) |

## 3. Challenge generation & verification

| Field | Value |
|---|---|
| Feature name | `challenge_generation` (`app/ai_engine/challenge_generation.py` → `services/challenge_service.py`) |
| Business purpose | Serve solvable, answer-leak-free cognitive drills for the alarm dismissal gate |
| Input features | User history (anchor difficulty), requested type/difficulty/count |
| Output | `(Challenge, pending ChallengeAttempt)`; client payload holds prompts/options/timeout/instructions only |
| Algorithm | Deterministic seeded templates per type × difficulty; server-authoritative single-use expiring verification |
| Fallback | N/A (no ML in the path) |
| Evaluation metric | `test_challenge_hardening.py`: 7 types × 5 difficulties solvable end-to-end; no-leak sweep; replay/expiry/cross-user rejection |
| Current status | Implemented |

## 4. Behavior analysis

| Field | Value |
|---|---|
| Feature name | `behavior_analysis` (`app/ai_engine/behavior_analysis.py` → `services/behavior_analytics_service.py`) |
| Business purpose | Derive sleep estimate, consistency trend, and per-type accuracy from real rows for dashboards/coach/exports |
| Input features | Alarms (triggers, snoozes), attempts (correct/total/time), habit scores, user settings/timezone |
| Output | `/analytics/me` summary (backward-compatible keys) |
| Algorithm | Closed-form derivations (overnight-gap sleep estimate, half-split trend with 5-pt band, grouped accuracy over **submitted** attempts only — pending unsubmitted snapshots are activity, not failures) |
| Fallback | Explicit documented defaults only when no data exists (7.5h sleep, "stable" trend) — never fabricated confidence |
| Evaluation metric | `test_analytics.py` + Phase-5 consistency tests (report ≡ dashboard values) |
| Current status | Implemented |

## 5. Anomaly detection (baseline)

| Field | Value |
|---|---|
| Feature name | `anomaly_detection` (`app/ai_engine/anomaly.py`), surfaced at `GET /analytics/anomalies` |
| Business purpose | Flag genuinely unusual mornings (snooze spike, schedule disruption, accuracy collapse) for the user/coach |
| Input features | 30-day habit history, 14-day alarm triggers, 14-day attempts |
| Output | `{"available", "reason", "scored_days", "method": "baseline", "anomalies": [...]}` |
| Algorithm | Fixed statistical checks with minimum-sample gates (snooze > max(2, 2×avg); >2h from median trigger with n≥5; recent accuracy < ½ prior with n≥5) |
| Fallback | The method *is* the fallback: with <5 scored days it returns `available: False` + reason |
| Evaluation metric | Gate tests (insufficient → unavailable; seeded spike/outlier/collapse → flagged with correct type) |
| Current status | Implemented **(baseline)** — explicitly not a trained model |

## 6. Performance forecasting (baseline)

| Field | Value |
|---|---|
| Feature name | `performance_prediction` (`app/ai_engine/performance_prediction.py`), surfaced at `GET /analytics/forecast` |
| Business purpose | Show the near-term habit-trajectory direction so users/coaches can act early |
| Input features | Scored habit days in the trailing 30 days |
| Output | `{"available", "trend", "slope_per_day", "confidence", "horizon_days": 7, "predicted_next_week", "method": "baseline-linear"}` |
| Algorithm | Ordinary least-squares slope on overall_score; |slope|<1.5 pts/day → stable; heuristic confidence (n≥7 & steep → high; n≥5 → medium; else low) |
| Fallback | With <4 scored days returns `available: False` + reason |
| Evaluation metric | Gate tests; synthetic-series unit tests (rising → improving, flat → stable, falling → declining); slope math verified against closed form |
| Current status | Implemented **(baseline)** — explicitly not a trained model |

## Limitations (applies to all six)

1. The difficulty weights are synthetic-trained (seed 42, 20k rows, val acc ~0.937 at train time). They encode the hand-built skill rule, **not** real user behavior. Do not retrain-claim, personalization-claim, or production-learning-claim them.
2. The model file is gitignored and absent from fresh clones and the lean Docker image; those environments run `rule_based_v2` exclusively — by design, not by failure.
3. Served difficulty moves at most ±1 step per challenge regardless of what the model says (safety clamp in `ChallengeService`).
4. Anomaly/forecast baselines need 5/4 scored days respectively; new users honestly receive `available: False`.
5. Inference logging records only method + difficulty transition — never features, user ids, or answers.
6. scikit-learn / XGBoost appear in requirements but are **unused**; no feature depends on them.
