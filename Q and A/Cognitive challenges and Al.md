# Cognitive Challenges and Adaptive AI — Q&A

> Implementation audit — CerebroKognit Intelligent Cognitive Alarm Platform.
> Evidence: static source reading of every challenge, AI, and recommendation file. Runtime claims unverified.

---

## Q9. Challenge types: what is actually implemented and how

All seven challenge types are implemented as **deterministic, random-parameter generators** inside `ChallengeService` (`backend/app/services/challenge_service.py:25-178`). Each generator receives a question count and returns `(questions: List[dict], answers: List[str])` — no external AI calls, no LLM, no templates from files, pure code.

### 9.1 Type-by-type breakdown

---

#### Math — `_gen_math` (`challenge_service.py:67-85`)

| Aspect | Detail |
|---|---|
| Generation | `random.choice` over operators `+`, `-`, `x` (multiply). Two operands: `a ∈ [1..50]`, `b ∈ [1..12]` (subtraction ensures `b ≤ a` by swapping). |
| Difficulty scaling | Same generator for all levels; difficulty controls **question count** (Beginner=1, Easy=1-2, Medium=2, Hard=3, Expert=3-5) via `_question_count_for` (`:185-192`). No operand range scaling by difficulty. |
| Question shape | `{"prompt": "a op b", "type": "numeric", "options": null}` — free-text input on mobile, no multiple-choice. |
| Answer | `str(compute(a, b))` — the computed integer. |
| Validation | `_normalize_answer` (`:198-205`): `str(v).strip().lower()`, strips trailing `.0`; `_answers_match` (`:211-218`) also compares digit-sequence fallback. |
| Stored in | `ChallengeAttempt.puzzle_payload` (questions list), `.expected_answers` (answers list) — both JSON columns. |

---

#### Logic — `_gen_logic` (`challenge_service.py:87-100`)

| Aspect | Detail |
|---|---|
| Generation | Pick step ∈ {2, 3, 5}, start `∈ [1..9]`, compute 4-term arithmetic sequence `[start, start+step, start+2*step, start+3*step]`; ask for the 5th term. |
| Question shape | `"Solve the pattern: 3, 5, 7, 9, ?"` — free-text numeric input. |
| Answer | `str(seq[-1] + step)` — the next term. |
| Difficulty | Same logic, count-driven only. |

---

#### Memory — `_gen_memory` (`challenge_service.py:102-113`)

| Aspect | Detail |
|---|---|
| Generation | 5 random digits `∈ [0..9]`, displayed once: `"Memorize this sequence: 4 7 2 9 1"`. |
| Question shape | `"type": "sequence"` — client displays the sequence then clears it (mobile `AlarmScreen` shows it as a prompt; no timed reveal is implemented client-side). |
| Answer | Space-separated digits, e.g. `"4 7 2 9 1"`. |
| Validation | `_normalize_sequence` (`:207-209`): strips all non-digits via `re.sub(r"\D", "", ...)` then exact string compare — so `"4 7 2 9 1"` and `"47291"` both match. |
| Timeout | 45 seconds (fastest of all types, `TIMEOUTS["Memory"] = 45`). |

---

#### Word — `_gen_word` (`challenge_service.py:115-128`)

| Aspect | Detail |
|---|---|
| Generation | Sample from a fixed 10-word vocabulary: `["morning", "alarm", "puzzle", "streak", "focus", "energy", "brain", "memory", "routine", "waking"]`. Scramble letters via `random.sample`; retries 20 times to ensure scrambled ≠ original (for 1-char words, falls back). |
| Question shape | `"Unscramble the word: laraem"` — free-text input. |
| Answer | The original word (lowercase). |
| Validation | `_normalize_answer` (lowercase + strip). |

---

#### Pattern — `_gen_pattern` (`challenge_service.py:130-152`)

| Aspect | Detail |
|---|---|
| Generation | Pick `cycle_len ∈ {2, 3}`, sample that many shapes from `["▲", "●", "■", "◆"]`, repeat twice (`cycle * 2` elements), ask for the next shape in the sequence. |
| Question shape | `"Pattern: ▲ ● ▲ ● ?"` — **multiple choice** with all 4 shapes as options (`"options": SHAPES`). |
| Answer | `(cycle * 3)[cycle_len * 2]` — the next shape (code has a comment noting a previous bug fix). |
| Bug note | Comment at `:139-145` documents a prior incorrect formula `cycle[2 * cycle_len % cycle_len]` that always returned `cycle[0]` by modular arithmetic; now fixed. |

---

#### Riddle — `_gen_riddle` (`challenge_service.py:154-159`)

| Aspect | Detail |
|---|---|
| Generation | Sample from a **fixed bank of 6 riddles** (`RIDDLES` at `:54-61`): e.g. "What has keys but can't open locks?" → "piano". |
| Question shape | Full riddle text — free-text answer. |
| Answer | The stored answer string (lowercase, single word). |
| Limitation | Only 6 riddles; Expert level (3-5 questions) will exhaust the bank in one session (no dynamic riddle generation). |

---

#### QuickQuiz — `_gen_quickquiz` (`challenge_service.py:161-168`)

| Aspect | Detail |
|---|---|
| Generation | Two operands `a, b ∈ [1..50]`; always addition. Trivially easy, intended as a warm-up. |
| Question shape | `"Quick Quiz: 12 + 37"` — free-text numeric input. |
| Answer | `str(a + b)`. |

---

### 9.2 Answer validation (cross-type)

```
ChallengeService._answers_match(expected, user)
  → _normalize_answer(str): strip().lower(), strip trailing ".0"
  → if exact match → True
  → else: _normalize_sequence → re.sub(r"\D", "", str) → digit-only exact compare
```

This handles: `"42"` == `"42.0"`, `"4 7 2"` == `"472"`, case-insensitive text. File: `challenge_service.py:198-218`.

### 9.3 Database storage

| Column | Content |
|---|---|
| `ChallengeAttempt.puzzle_payload` (JSON) | Questions list: `[{"prompt": ..., "type": ..., "options": [... or null]}, ...]` |
| `ChallengeAttempt.expected_answers` (JSON) | Answers list: `["42", "17", ...]` — **never sent to client** |
| `ChallengeAttempt.user_answers` (JSON) | Set at submission time; compared server-side |
| `Challenge.challenge_type` | One of the 7 types (String(50)) |
| `Challenge.difficulty` | One of 5 levels (String(20)) |

### 9.4 API endpoints

| Endpoint | Method | File | Purpose |
|---|---|---|---|
| `GET /api/v1/challenges` | LIST | `api/challenges.py:15-39` | List all active challenges, filter by type/difficulty |
| `GET /api/v1/challenges/next` | GET | `api/challenges.py:42-72` | **Core**: adaptive difficulty → create pending attempt → return puzzle (no answers) |
| `POST /api/v1/challenges/submit` | POST | `api/challenges.py:75-103` | Authoritative verify against stored `expected_answers` |

---

## Q10. The complete challenge generation pipeline (end-to-end)

Trace from alarm trigger to the user seeing questions.

### Stage 1: Trigger

**User action** (no automated trigger — see Q8 in prior file): user opens the app and navigates to the alarm/challenge screen.

### Stage 2: Adaptive difficulty selection

`GET /challenges/next?challenge_type=Math&difficulty=Medium` → `ChallengeService.get_adaptive_challenge` (`challenge_service.py:296-389`)

```
1. Load last 5 ended attempts (completed=True, end_time set)
2. Compute:
   - success_rate = total_correct / total_questions (across all 5)
   - avg_time = mean(time_taken_seconds) for attempts with time > 0
   - streak = consecutive completed attempts from most recent
3. If explicit difficulty provided → PIN it (skip ML)
4. Otherwise → _adaptive_difficulty(ended_attempts, snooze_count):
   a. No history → random.choice(["Beginner","Easy","Medium"])  [onboarding band]
   b. Otherwise:
      i.   anchor = difficulty of most recent ended attempt
      ii.  base_idx = DIFFICULTIES.index(anchor)
      iii. band = [base_idx-1, base_idx+1] (clamped 0..4)
      iv.  MLInferenceService.predict_difficulty(success_rate, avg_time, snoozes, streak, anchor)
      v.   CLAMP ML prediction into the band → max(band_low, min(pred, band_high))
```

### Stage 3: Challenge row selection

```
1. Query Challenge table for is_active + optional type filter + new_difficulty
2. Pick one at random (ORDER BY random())
3. If none exists → _get_or_create_challenge creates a new Challenge row on the fly
```

### Stage 4: Question generation

```
count = _question_count_for(difficulty, override)
    Beginner=1, Easy=1-2 random, Medium=2, Hard=3, Expert=3-5 random

questions, answers = GENERATORS[challenge_type](count)  # the 7 static methods
```

### Stage 5: Pending attempt creation (answer leak prevention)

```python
pending = ChallengeAttempt(
    user_id, challenge_id, attempt_number=last+1,
    completed=False,
    total_questions=count,
    puzzle_payload=questions,      # [{"prompt":..., "type":..., "options":...}]
    expected_answers=answers,      # ["42", "17", ...]  ← SERVER ONLY
    start_time=now_utc,
)
```

Also: garbage-collects abandoned incomplete attempts (`:359-363`).

### Stage 6: API response (no answer leakage)

`ChallengeService.payload_for(attempt)` (`:227-233`) strips to:
```json
{
  "questions": [...],        // prompts + options only
  "total_questions": 2,
  "timeout_seconds": 60
}
```

The `ChallengeRes` includes `challenge_attempt_id` (needed for submit) but **never** `expected_answers`.

### Stage 7: Frontend display

- **Mobile**: `useChallenge.fetchChallenge()` (`mobile/src/hooks/useChallenge.jsx:8-31`) → `AlarmScreen.jsx:165-204` renders questions with free-text `TextInput` or `TouchableOpacity` option buttons.
- **Web**: `ChallengeGenerator.jsx` + `LiveChallengeSimulator.jsx` — same `/challenges/next` call, renders prompts + input, posts to `/challenges/submit`.

### Stage 8: Submission & verification

```
POST /challenges/submit
  → ChallengeService.submit_attempt (challenge_service.py:411-457):
      1. Load attempt by id + user_id + challenge_id
      2. Compare each user_answer against expected_answers using _answers_match
      3. correct = count of matches
      4. completed = (correct == total_questions)  ← ALL must be correct
      5. Store user_answers, correct_answers, end_time, time_taken_seconds
  → Returns ChallengeSubmitRes {completed, correct, correct_answers, total_questions}
```

### Stage 9: Alarm dismiss (if all correct)

```
POST /alarms/{id}/dismiss
  → alarm_service.dismiss_alarm (alarm_service.py:225-273):
      1. verify_finished_attempt → 404/400 if not owned/incomplete/not-all-correct
      2. Mark alarm disabled (One-Time) or re-enable + compute next_trigger (recurring)
      3. refresh_habit_score (wake-up consistency component updated)
```

**Summary of data flow**:
```
GET /challenges/next
  └→ ML predict difficulty → pick Challenge row → generate questions → store expected_answers
     └→ Return puzzle_payload (NO answers)

POST /challenges/submit
  └→ Load attempt → compare answers → mark completed/user_answers
     └→ Return correct/completed

POST /alarms/{id}/dismiss
  └→ verify all-correct → re-arm alarm → update habit score
```

---

## Q11. Adaptive difficulty engine — real ML or rules?

### Short answer

**Both: a real but lightweight PyTorch model with a rules-based fallback that runs in production Docker.**

### 11.1 The ML model

| Aspect | Detail | File |
|---|---|---|
| Architecture | Feedforward neural net: `Linear(4→16) → ReLU → Dropout(0.2) → Linear(16→16) → ReLU → Dropout(0.2) → Linear(16→5)` | `ai_engine/difficulty.py:52-68` (`DifficultyPredictor(nn.Module)`) |
| Input features (4) | `[success_rate, avg_time/60.0, snooze_count/5.0, streak_length/10.0]` — all normalized to ~[0,1] | `difficulty.py:126-128` |
| Output (5) | Logits for `[Beginner, Easy, Medium, Hard, Expert]`; argmax = predicted difficulty | `difficulty.py:25,132` |
| Model file | `backend/ml_models/difficulty_model.pt` — **exists, 4,929 bytes** | Verified via filesystem |
| Loading | `torch.load(MODEL_PATH, map_location="cpu", weights_only=True)` → `model.eval()` | `difficulty.py:97-104` |
| Inference | `logits = model(features)` → `argmax` → label | `difficulty.py:126-135` |

### 11.2 Training

| Aspect | Detail | File |
|---|---|---|
| Training script | `backend/scripts/train_difficulty_model.py` | Run: `python scripts/train_difficulty_model.py` |
| Dataset | **Synthetic, rule-generated** (no real user data) | `train_difficulty_model.py:30-57` |
| Dataset size | 20,000 samples (80/20 train/val split = 16,000/4,000) | `:63,72-73` |
| Label derivation | Hand-crafted skill score: `skill = 0.55*success_rate + 0.20*(1-speed_norm) + 0.15*(1-snooze_norm) + 0.10*(streak_norm)`, then `(skill*4).round().clamp(0,4)` | `:44-51` |
| Training config | Adam lr=3e-3, StepLR γ=0.5 every 150 epochs, CrossEntropyLoss, 600 epochs | `:68-69,75-82` |
| Reported metrics | **~93.7% validation accuracy** (per context.md; script prints per-epoch val_acc) | `:84-89` |
| Sanity checks | 3 hardcoded test vectors: strong→Expert/Hard, weak→Beginner, average→Medium | `:93-102` |

### 11.3 Rule-based fallback

Used when: PyTorch not installed, `.pt` file missing, or inference exception.

```python
RULE_THRESHOLDS = {"high_performer": 0.80, "low_performer": 0.30}

def _rule_based_difficulty(success_rate, current_difficulty):
    if success_rate > 0.80 and idx < 4:  → next harder level
    if success_rate < 0.30 and idx > 0:  → next easier level
    else:                                 → stay same
```

File: `ai_engine/difficulty.py:27-45`.

### 11.4 Band clamping (production safety)

Even if the ML model predicts "Expert", the system **always clamps** the result to ±1 of the current anchor difficulty (`challenge_service.py:278-293`). This prevents a biased model from jumping a fresh user to Expert.

### 11.5 `ml-status` diagnostics endpoint

`GET /api/v1/analytics/ml-status` → `MLInferenceService.get_model_status()` returns:
```json
{
  "torch_available": true|false,
  "model_loaded": true|false,
  "model_path": "...",
  "model_exists": true|false
}
```

**In Docker (runtime image)**: `requirements-runtime.txt` excludes torch → `torch_available=false` → `model_loaded=false` → **only the rule-based fallback runs in production containers**. Locally with torch installed, the ML model is loaded and used.

---

## Q12. Recommendation engine

### 12.1 Architecture

The recommendation engine is **entirely rule-based** — no trained model, no external AI API, no LLM. It is a function `generate_recommendations(db, user_id)` that computes analytics from real data and applies heuristic thresholds.

File: `backend/app/services/recommendation_service.py` (256 lines)

The `ai_engine/recommendations.py` adapter (`:13-17`) simply delegates to it; the Protocol interface allows future model-based replacement.

### 12.2 Input data (all from real DB queries)

| Signal | Source | How |
|---|---|---|
| Average sleep duration (hours) | `compute_sleep_duration_avg()` | Overnight gap between consecutive alarms over 14 days |
| Total snooze count | `_snooze_counts()` | Sum of `times_snoozed` across all user alarms |
| Wake-up consistency trend | `compute_wake_up_consistency_trend()` | 14-day comparison of older vs newer half of HabitScores |
| Per-type accuracy matrix | `_attempt_matrix()` | All attempts grouped by challenge type + difficulty |
| Unattempted types | Same matrix | `all_types - attempted_types` |
| Week-over-week completion rate | Two date-windowed queries | Attempts in last 7 days vs 7-14 days ago |
| Current streak | `compute_streak_length()` | Consecutive completed attempts |

### 12.3 Recommendation logic (4 categories)

**FR-RE-001 — Sleep improvement** (`:84-128`):
```
IF avg_sleep < 7.0h  → high priority: "move alarm 15 min later or set earlier bedtime"
IF avg_sleep > 9.0h  → medium: "set earlier alarm in 15-min steps"
IF sleep differs from user preference by ≥1h → low: "shift bedtime 15 min"
```

**FR-RE-002 — Wake-up optimization** (`:130-164`):
```
IF total_snoozes ≥ 3  → high: "add a {worst_type} challenge as a cognitive anchor"
IF trend == "declining" → medium: "re-cue fixed wake time + complete challenge within 2 min"
```

**FR-RE-003 — Habit improvement** (`:166-205`):
```
IF week-over-week completion rate rose ≥20% → high: "keep momentum, try extra type"
IF streak ≥ 3 → low: "protect streak, complete today's challenge"
```

**FR-RE-004 — Challenge recommendations** (`:207-251`):
```
IF unattempted_types exist → medium: "try {first_unattempted}"
ELSE IF any difficulty has accuracy < 60% → medium: "reinforce {weak_difficulty}"
ELSE IF any difficulty has accuracy ≥ 80% → low: "ready to level up"
```

### 12.4 Output and storage

- Returns a priority-sorted list (max 6), ordered by `priority_order: {high: 0, medium: 1, low: 2}`.
- Each recommendation: `{id, category, priority, title, message, suggested_action, metrics: {...}}`.
- **Not persisted** — generated fresh on each request via `GET /api/v1/analytics/recommendations` (`api/analytics.py`).
- Displayed in web `Dashboard.jsx` and mobile `HomeTab.jsx`.

---

## Q13. AI/ML component status — functional vs placeholder

### 13.1 Component inventory

| Component | File(s) | Status | Nature |
|---|---|---|---|
| **Difficulty prediction (ML)** | `ai_engine/difficulty.py`, `ml_models/difficulty_model.pt`, `scripts/train_difficulty_model.py` | ✅ **Functional** (locally) | PyTorch feedforward 4→16→5; trained on synthetic data; loaded when torch present; real inference; `ml-status` reports load state |
| **Difficulty prediction (rule fallback)** | `ai_engine/difficulty.py:34-45` | ✅ **Functional** | Two thresholds (0.80/0.30) on success_rate; used in Docker when torch absent |
| **Adaptive band clamping** | `challenge_service.py:278-293` | ✅ **Functional** | ML output clamped ±1 of anchor; safety layer |
| **Challenge generation** | `challenge_service.py:67-178`, `ai_engine/challenge_generation.py` | ✅ **Functional** | 7 deterministic generators with random parameters; no ML involved — pure algorithmic |
| **Recommendation engine** | `services/recommendation_service.py`, `ai_engine/recommendations.py` | ✅ **Functional (rule-based)** | Heuristic thresholds on real analytics; no model, no LLM |
| **Behavior analysis** | `ai_engine/behavior_analysis.py`, `services/behavior_analytics_service.py` | ✅ **Functional** | Real SQL queries for sleep estimate, trends, activity — no ML; adapter wraps services |
| **Anomaly detection** | `ai_engine/anomaly.py` | ❌ **Planned stub** | `raise NotImplementedError("Anomaly detection is planned")` |
| **Performance forecasting** | `ai_engine/performance_prediction.py` | ❌ **Planned stub** | `raise NotImplementedError("Performance forecasting is planned")` |
| **AI engine registry** | `ai_engine/interfaces.py:74-81` | ✅ **Scaffold** | 6 protocols defined; 4 implemented, 2 planned |
| **Redis cache** | `services/cache.py` | ⚠️ **Implemented, inactive** | Active only if `REDIS_URL` set; otherwise in-memory no-op |
| **Background workers** | `workers/job_queue.py` | ⚠️ **Partial** | In-process job registry for async reports; Celery/RQ planned |

### 13.2 Unused ML dependencies in `requirements.txt`

| Dependency | Declared | Actually imported anywhere? | Verdict |
|---|---|---|---|
| `torch>=2.3.0` | `requirements.txt:13` | Yes — `ai_engine/difficulty.py` (guarded import) | ✅ **Used** (locally; excluded from Docker) |
| `torchvision>=0.18.0` | `requirements.txt:14` | No — zero imports | ❌ **Unused** |
| `scikit-learn>=1.4.0` | `requirements.txt:15` | No — zero imports | ❌ **Unused** |
| `xgboost>=2.0.0` | `requirements.txt:16` | No — zero imports | ❌ **Unused** |
| `pandas>=2.2.0` | `requirements.txt:17` | No — zero imports | ❌ **Unused** |
| `numpy>=1.26.0` | `requirements.txt:18` | Not directly; rides with torch | ❌ **Implicit only** |

### 13.3 Classification summary

| Category | Components |
|---|---|
| **Working ML pipeline** | Difficulty predictor (train → save → load → infer — but only on local dev with torch) |
| **Working rule-based system** | Difficulty fallback, band clamping, all 7 challenge generators, recommendation engine (4 categories), behavior analytics |
| **Planned / not implemented** | Anomaly detection, performance forecasting, Redis caching (live), Celery workers, FCM/APNs delivery |
| **Mock / no-op** | `NoopProvider.send()` for push notifications (raises `NotImplementedError`) |
| **Unused declared deps** | `torchvision`, `scikit-learn`, `xgboost`, `pandas` (all in requirements.txt, none imported) |

### 13.4 Honest assessment

The product's "AI" is a **well-structured but lightweight hybrid**:
- A real (tiny) PyTorch model exists and trains, but **only runs locally** (Docker image excludes torch); production containers use the 5-line rule fallback.
- Challenge generation is **algorithmic** (random parameters, fixed templates) — not AI-generated content.
- Recommendations are **heuristic** (threshold comparisons on real analytics) — not a trained model.
- The architecture is designed for future ML expansion (Protocol interfaces, registry, adapter layer) but today the intelligence is primarily in the band-clamping safety layer and the rule thresholds.

---

*This covers Q9-Q13. Remaining backlog: real on-device scheduling, FCM/APNs delivery, anomaly/performance engines, real training data collection.*