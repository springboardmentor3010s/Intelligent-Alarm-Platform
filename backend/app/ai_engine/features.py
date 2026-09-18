# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Feature construction for the difficulty engine (AI/ML, Phase 6).

Two documented feature contracts live here:

- `MODEL_FEATURES` (frozen, 4 inputs): the exact normalized vector the
  `difficulty_model.pt` weights were trained on. The saved weights fix this
  interface — it must not gain inputs without retraining + version bump.
  Training data is SYNTHETIC (see `scripts/train_difficulty_model.py`); the
  model has never seen real user data.
- `RULE_SIGNALS` (6 measurable signals): the inputs to the transparent
  rule-based fallback/v2 engine — recent accuracy, completion time, snooze
  frequency, failed attempts, recent difficulty, wake-up consistency.

All helpers clamp and scale defensively so malformed telemetry can never
produce NaN/inf features.
"""

from typing import Dict, List

# Frozen model interface: [success_rate, avg_time_min, snooze/5, streak/10].
MODEL_FEATURES: List[str] = [
    "success_rate",
    "avg_time_minutes",
    "snooze_rate",
    "streak_norm",
]

# Transparent rule-engine signals (measurable, unit-tested).
RULE_SIGNALS: List[str] = [
    "recent_accuracy",      # 0..1 correct/total over the recent window
    "avg_time_seconds",     # mean seconds per answered attempt (>0)
    "snooze_frequency",     # mean snoozes per alarm in the window
    "failed_attempts",      # count of incomplete attempts in the window
    "recent_difficulty",    # anchor label, e.g. "Medium"
    "wake_up_consistency",  # 0..100 habit component (latest scored day)
]

DIFFICULTY_ORDER: List[str] = ["Beginner", "Easy", "Medium", "Hard", "Expert"]


def _clamp(value, lo: float, hi: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return lo
    if number != number:  # NaN guard
        return lo
    return max(lo, min(hi, number))


def normalize_model_features(
    success_rate: float,
    avg_time_seconds: float,
    snooze_count: int,
    streak_length: int,
) -> List[float]:
    """Build the frozen 4-feature model vector (train-time scaling).

    Mirrors `train_difficulty_model.make_dataset`: success in [0,1], time in
    minutes, snooze/5, streak/10 (streak capped at 1.0 of scale, i.e. 10).
    """
    success = _clamp(success_rate, 0.0, 1.0)
    avg_time = _clamp(avg_time_seconds, 0.0, 3600.0)
    snoozes = _clamp(snooze_count, 0.0, 25.0)
    streak = _clamp(streak_length, 0.0, 100.0)
    return [
        success,
        avg_time / 60.0,
        snoozes / 5.0,
        min(streak / 10.0, 1.0),
    ]


def build_rule_signals(
    recent_accuracy: float = 0.5,
    avg_time_seconds: float = 30.0,
    snooze_frequency: float = 0.0,
    failed_attempts: int = 0,
    recent_difficulty: str = "Medium",
    wake_up_consistency: float = 50.0,
) -> Dict[str, float | str | int]:
    """Build the clamped 6-signal dict consumed by the rule engine."""
    anchor = recent_difficulty if recent_difficulty in DIFFICULTY_ORDER else "Medium"
    return {
        "recent_accuracy": _clamp(recent_accuracy, 0.0, 1.0),
        "avg_time_seconds": _clamp(avg_time_seconds, 0.0, 3600.0),
        "snooze_frequency": _clamp(snooze_frequency, 0.0, 25.0),
        "failed_attempts": max(0, int(failed_attempts or 0)),
        "recent_difficulty": anchor,
        "wake_up_consistency": _clamp(wake_up_consistency, 0.0, 100.0),
    }
