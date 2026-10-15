"""Server-side rules for the wake-up verification methods.

The server checks the user's recorded challenge answers, so a client cannot
simply claim that it succeeded.
"""
from __future__ import annotations

from dataclasses import dataclass

# Methods that are judged by challenge answers recorded after the start.
COGNITIVE_METHODS = {
    "puzzle",
    "multi_step",
    "consecutive",
    "time_based",
    "accuracy",
}

# Methods the client confirms itself (hold the button, tap to confirm).
SELF_CONFIRMED_METHODS = {"hold", "confirmation"}

ALL_METHODS = sorted(COGNITIVE_METHODS | SELF_CONFIRMED_METHODS)

MULTI_STEP_REQUIRED = 3
CONSECUTIVE_REQUIRED = 3
TIME_LIMIT_SECONDS = 20.0
ACCURACY_MIN_ATTEMPTS = 5
ACCURACY_MIN_PERCENT = 80.0

DESCRIPTIONS = {
    "hold": "Press and hold to confirm you are awake.",
    "confirmation": "Tap to confirm you are awake.",
    "puzzle": "Solve one puzzle correctly.",
    "multi_step": f"Solve {MULTI_STEP_REQUIRED} different challenges correctly.",
    "consecutive": f"Answer {CONSECUTIVE_REQUIRED} challenges correctly in a row.",
    "time_based": f"Solve a challenge correctly within {int(TIME_LIMIT_SECONDS)} seconds.",
    "accuracy": (
        f"Answer {ACCURACY_MIN_ATTEMPTS} challenges with at least "
        f"{int(ACCURACY_MIN_PERCENT)}% correct."
    ),
}


@dataclass
class Attempt:
    challenge_id: int
    is_correct: bool
    response_time: float | None


def evaluate(method: str, attempts: list[Attempt]) -> dict:
    """attempts must be in the order they were made (oldest first)."""
    total = len(attempts)
    correct = [a for a in attempts if a.is_correct]

    if method == "puzzle":
        required, progress = 1, min(1, len(correct))

    elif method == "multi_step":
        required = MULTI_STEP_REQUIRED
        progress = min(required, len({a.challenge_id for a in correct}))

    elif method == "consecutive":
        required = CONSECUTIVE_REQUIRED
        best = run = 0
        for attempt in attempts:
            run = run + 1 if attempt.is_correct else 0
            best = max(best, run)
        progress = min(required, best)

    elif method == "time_based":
        required = 1
        fast = [
            a for a in correct
            if a.response_time is not None
            and a.response_time <= TIME_LIMIT_SECONDS
        ]
        progress = min(1, len(fast))

    elif method == "accuracy":
        required = ACCURACY_MIN_ATTEMPTS
        percent = 100 * len(correct) / total if total else 0.0
        satisfied = total >= required and percent >= ACCURACY_MIN_PERCENT
        return {
            "method": method,
            "required": required,
            "progress": min(total, required),
            "attempts": total,
            "correct": len(correct),
            "accuracy_percent": round(percent, 1),
            "satisfied": satisfied,
            "description": DESCRIPTIONS[method],
        }

    elif method in SELF_CONFIRMED_METHODS:
        return {
            "method": method,
            "required": 1,
            "progress": 0,
            "attempts": total,
            "correct": len(correct),
            "satisfied": False,
            "self_confirmed": True,
            "description": DESCRIPTIONS[method],
        }

    else:
        raise ValueError(f"Unknown verification method: {method}")

    return {
        "method": method,
        "required": required,
        "progress": progress,
        "attempts": total,
        "correct": len(correct),
        "satisfied": progress >= required,
        "description": DESCRIPTIONS[method],
    }
