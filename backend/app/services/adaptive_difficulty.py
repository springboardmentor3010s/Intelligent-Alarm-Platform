"""
AdaptiveDifficultyService — Milestone 2 (rule-based) + ML integration

Difficulty selection strategy:
  1. Try XGBoost model (when trained and sufficient data available)
  2. Fall back to rule-based logic if model unavailable or prediction fails

Rule-based policy (configurable via POLICY):
  - correct_streak >= PROMOTE_AFTER  → increase difficulty
  - wrong_streak   >= DEMOTE_AFTER   → decrease difficulty
  - Otherwise                        → keep current
  - Floor: BEGINNER, Ceiling: EXPERT
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

DIFFICULTY_LEVELS = ["BEGINNER", "EASY", "MEDIUM", "HARD", "EXPERT"]

# Configurable policy — change these values to tune adaptation speed
POLICY = {
    "promote_after_correct": 1,   # consecutive correct answers needed to go up
    "demote_after_wrong": 2,       # consecutive wrong answers needed to go down
}

_PREF_MAP = {
    "beginner": "BEGINNER", "easy": "EASY", "medium": "MEDIUM",
    "hard": "HARD", "expert": "EXPERT",
}


def get_starting_difficulty(preference: Optional[str]) -> str:
    """Return the starting difficulty from a user's profile preference string."""
    return _PREF_MAP.get((preference or "medium").lower(), "MEDIUM")


def _rule_based_next(current: str, recent_results: list[bool]) -> str:
    """Pure rule-based logic — always available as fallback."""
    if current not in DIFFICULTY_LEVELS:
        current = "MEDIUM"
    idx = DIFFICULTY_LEVELS.index(current)

    if not recent_results:
        return current

    correct_streak = 0
    for r in reversed(recent_results):
        if r is True:
            correct_streak += 1
        else:
            break

    wrong_streak = 0
    for r in reversed(recent_results):
        if r is False:
            wrong_streak += 1
        else:
            break

    if correct_streak >= POLICY["promote_after_correct"]:
        idx = min(idx + 1, len(DIFFICULTY_LEVELS) - 1)
    elif wrong_streak >= POLICY["demote_after_wrong"]:
        idx = max(idx - 1, 0)

    return DIFFICULTY_LEVELS[idx]


def compute_next_difficulty(
    current: str,
    recent_results: list[bool],
    challenge=None,
    history: list = None,
) -> str:
    """
    Return the recommended next difficulty.

    Strategy:
      1. Try XGBoost model when trained and sufficient data available.
      2. Fall back to rule-based logic otherwise.

    Args:
        current:        current difficulty string e.g. "MEDIUM"
        recent_results: list of bool (oldest first, newest last)
        challenge:      optional CognitiveChallenge ORM row for ML features
        history:        optional list of prior challenges for ML features

    Returns:
        Next difficulty string
    """
    # ── Try ML model ──────────────────────────────────────────────────────────
    if challenge is not None and history is not None:
        try:
            from app.ml.difficulty_model import get_model
            from app.ml.features import build_feature_vector
            model = get_model()
            if model.is_ready:
                features = build_feature_vector(challenge, history)
                prediction = model.predict(features)
                if prediction and prediction in DIFFICULTY_LEVELS:
                    logger.debug(
                        "XGBoost predicted %s (rule-based would give %s)",
                        prediction,
                        _rule_based_next(current, recent_results),
                    )
                    return prediction
        except Exception as exc:
            logger.warning("XGBoost prediction failed, using rule-based: %s", exc)

    # ── Rule-based fallback ───────────────────────────────────────────────────
    return _rule_based_next(current, recent_results)


def compute_wakefulness_score(
    challenges_completed: int,
    challenges_required: int,
    correct_count: int,
    total_attempts: int,
    avg_response_seconds: float,
    time_limit_seconds: float,
) -> tuple[float, str]:
    """
    Calculate a software-based wakefulness score (0-100) and status.
    Does NOT claim to detect biological wakefulness.

    Returns:
        (score: float, status: str)
        status is one of: NOT_VERIFIED | PARTIALLY_VERIFIED | WAKE_UP_VERIFIED
    """
    if challenges_required == 0 or challenges_completed == 0:
        return 0.0, "NOT_VERIFIED"

    # Accuracy component (40 pts)
    accuracy = correct_count / max(total_attempts, 1)
    accuracy_score = accuracy * 40

    # Completion component (40 pts)
    completion_ratio = min(challenges_completed / challenges_required, 1.0)
    completion_score = completion_ratio * 40

    # Speed component (20 pts) — faster relative to time limit = higher score
    if time_limit_seconds > 0 and avg_response_seconds > 0:
        speed_ratio = max(0.0, 1.0 - (avg_response_seconds / time_limit_seconds))
        speed_score = speed_ratio * 20
    else:
        speed_score = 10.0  # neutral if no time data

    total = round(accuracy_score + completion_score + speed_score, 1)

    if challenges_completed >= challenges_required and accuracy >= 0.5:
        status = "WAKE_UP_VERIFIED"
    elif challenges_completed > 0:
        status = "PARTIALLY_VERIFIED"
    else:
        status = "NOT_VERIFIED"

    return total, status
