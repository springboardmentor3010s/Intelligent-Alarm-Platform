"""
Feature engineering for XGBoost adaptive difficulty model.

All features are derived from existing CognitiveChallenge columns.
No new database columns are required.

Feature vector (14 features, all numeric after encoding):
  0  difficulty_enc          current difficulty (0-4)
  1  challenge_type_enc      challenge type (0-6)
  2  is_correct              1/0
  3  attempts                raw attempt count
  4  score                   0-100
  5  duration_ratio          completion_duration / time_limit (capped 0-3)
  6  recent_accuracy         correct / total in last N challenges
  7  recent_avg_score        mean score in last N challenges
  8  recent_avg_duration_r   mean duration_ratio in last N challenges
  9  consecutive_correct     trailing correct streak
  10 consecutive_wrong       trailing wrong streak
  11 completion_rate         completed / total challenges seen
  12 n_recent               number of recent challenges used
  13 prev_difficulty_enc     difficulty of the previous challenge (0-4)
"""
from __future__ import annotations

import numpy as np
from typing import List, Optional

DIFFICULTY_LEVELS = ["BEGINNER", "EASY", "MEDIUM", "HARD", "EXPERT"]
CHALLENGE_TYPES   = ["math", "logic", "memory", "word", "pattern", "riddle", "quiz"]

DIFF_ENC  = {d: i for i, d in enumerate(DIFFICULTY_LEVELS)}
TYPE_ENC  = {t: i for i, t in enumerate(CHALLENGE_TYPES)}

FEATURE_NAMES = [
    "difficulty_enc",
    "challenge_type_enc",
    "is_correct",
    "attempts",
    "score",
    "duration_ratio",
    "recent_accuracy",
    "recent_avg_score",
    "recent_avg_duration_ratio",
    "consecutive_correct",
    "consecutive_wrong",
    "completion_rate",
    "n_recent",
    "prev_difficulty_enc",
]

N_RECENT = 10   # look-back window for rolling stats


def _duration_ratio(duration: Optional[float], time_limit: Optional[int]) -> float:
    """Normalised response time. Capped at 3.0 to limit outlier influence."""
    if not duration or not time_limit or time_limit <= 0:
        return 1.0   # neutral default
    return min(duration / time_limit, 3.0)


def _consecutive_streaks(results: List[bool]) -> tuple[int, int]:
    """Return (consecutive_correct, consecutive_wrong) from the tail of results."""
    correct = wrong = 0
    for r in reversed(results):
        if r is True:
            if wrong == 0:
                correct += 1
            else:
                break
        elif r is False:
            if correct == 0:
                wrong += 1
            else:
                break
        else:
            break
    return correct, wrong


def build_feature_vector(
    current_challenge,          # CognitiveChallenge ORM row (or dict-like)
    history: list,              # list of CognitiveChallenge rows, oldest→newest
                                # NOT including current_challenge
) -> np.ndarray:
    """
    Build a single 14-element feature vector for one challenge record.
    Works with ORM objects or plain dicts (for testing).

    Args:
        current_challenge: the challenge whose outcome we are encoding
        history: previous challenges for this user (oldest first)

    Returns:
        np.ndarray of shape (14,), dtype float32
    """
    def _get(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    diff   = _get(current_challenge, "difficulty", "MEDIUM")
    ctype  = _get(current_challenge, "challenge_type", "math")
    correct = _get(current_challenge, "is_correct", False)
    attempts = _get(current_challenge, "attempts", 1) or 1
    score  = _get(current_challenge, "score", 0) or 0
    dur    = _get(current_challenge, "completion_duration_seconds", None)
    tlimit = _get(current_challenge, "time_limit_seconds", 60)

    diff_enc  = DIFF_ENC.get(diff, 2)          # default MEDIUM=2
    type_enc  = TYPE_ENC.get(ctype, 0)
    is_corr   = 1 if correct else 0
    dur_ratio = _duration_ratio(dur, tlimit)

    # Rolling stats from history (last N_RECENT)
    recent = history[-N_RECENT:] if history else []
    n_recent = len(recent)

    if n_recent > 0:
        recent_correct = [bool(_get(c, "is_correct", False)) for c in recent]
        recent_scores  = [(_get(c, "score", 0) or 0) for c in recent]
        recent_durs    = [
            _duration_ratio(
                _get(c, "completion_duration_seconds", None),
                _get(c, "time_limit_seconds", 60),
            )
            for c in recent
        ]
        recent_accuracy       = sum(recent_correct) / n_recent
        recent_avg_score      = float(np.mean(recent_scores))
        recent_avg_dur_ratio  = float(np.mean(recent_durs))
        cons_correct, cons_wrong = _consecutive_streaks(recent_correct)
    else:
        recent_accuracy      = 0.5
        recent_avg_score     = 50.0
        recent_avg_dur_ratio = 1.0
        cons_correct = cons_wrong = 0

    # Completion rate across all history
    all_history = history
    completed = sum(1 for c in all_history if _get(c, "completed_at", None) is not None)
    completion_rate = completed / len(all_history) if all_history else 0.5

    # Previous difficulty
    prev_diff = _get(history[-1], "difficulty", diff) if history else diff
    prev_diff_enc = DIFF_ENC.get(prev_diff, diff_enc)

    vec = np.array([
        diff_enc,
        type_enc,
        is_corr,
        float(attempts),
        float(score),
        dur_ratio,
        recent_accuracy,
        recent_avg_score,
        recent_avg_dur_ratio,
        float(cons_correct),
        float(cons_wrong),
        completion_rate,
        float(n_recent),
        float(prev_diff_enc),
    ], dtype=np.float32)

    assert len(vec) == len(FEATURE_NAMES), "Feature vector length mismatch"
    return vec


def build_dataset_from_records(
    challenges_by_user: dict,   # {user_id: [CognitiveChallenge, ...]} oldest→newest
) -> tuple[np.ndarray, np.ndarray]:
    """
    Build (X, y) arrays from historical challenge records.

    Target (y): the difficulty level that the rule-based system WOULD recommend
    after seeing this challenge's outcome. This creates supervised labels from
    existing performance data without inventing fake behavior.

    Args:
        challenges_by_user: dict mapping user_id → list of challenges (oldest first)

    Returns:
        X: shape (n_samples, 14)
        y: shape (n_samples,) — integer-encoded difficulty (0-4)
    """
    from app.services.adaptive_difficulty import compute_next_difficulty

    X_rows, y_rows = [], []

    for user_id, challenges in challenges_by_user.items():
        for i, challenge in enumerate(challenges):
            def _get(obj, key, default=None):
                if isinstance(obj, dict):
                    return obj.get(key, default)
                return getattr(obj, key, default)

            if _get(challenge, "is_correct") is None:
                continue   # skip unanswered challenges

            history = challenges[:i]   # everything before this challenge
            features = build_feature_vector(challenge, history)

            # Target: what difficulty should come NEXT?
            current_diff = _get(challenge, "difficulty", "MEDIUM")
            if current_diff not in DIFFICULTY_LEVELS:
                current_diff = "MEDIUM"

            # Build recent_results from history (last N_RECENT)
            recent = history[-N_RECENT:]
            recent_results = [bool(_get(c, "is_correct", False)) for c in recent]
            # Include this challenge's outcome
            recent_results.append(bool(_get(challenge, "is_correct", False)))

            next_diff = compute_next_difficulty(current_diff, recent_results)
            target = DIFF_ENC[next_diff]

            X_rows.append(features)
            y_rows.append(target)

    if not X_rows:
        return np.empty((0, len(FEATURE_NAMES)), dtype=np.float32), np.empty((0,), dtype=np.int32)

    return np.array(X_rows, dtype=np.float32), np.array(y_rows, dtype=np.int32)
