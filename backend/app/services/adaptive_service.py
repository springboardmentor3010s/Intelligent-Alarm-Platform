"""
Adaptive Difficulty Service for Milestone 3.

Provides performance analysis and adaptive difficulty recommendations
derived from historical challenge sessions.
"""

from typing import Any, Dict, List, Optional
from app.services.performance_analyzer import analyze_performance
from app.services.adaptive_difficulty import adjust_difficulty, DIFFICULTY_LEVELS


# Default recent history window to evaluate for adaptation
DEFAULT_HISTORY_WINDOW = 5

# Performance thresholds for difficulty adjustments
ACCURACY_UPGRADE_THRESHOLD = 80.0
ACCURACY_DOWNGRADE_THRESHOLD = 40.0
MINIMUM_SAMPLES_FOR_ADAPTATION = 2


def get_next_difficulty(current_difficulty: str, results: List[bool]) -> Dict[str, Any]:
    """
    Calculate performance and determine the next challenge difficulty
    based on a list of boolean results (True = correct, False = incorrect).
    Preserved for backwards compatibility with existing test scripts.
    """
    performance = analyze_performance(results)

    if performance["total"] == 0:
        return {
            "current_difficulty": current_difficulty,
            "next_difficulty": current_difficulty,
            "performance": performance,
        }

    last_result = results[-1]

    next_difficulty = adjust_difficulty(
        current_difficulty,
        last_result
    )

    return {
        "current_difficulty": current_difficulty,
        "next_difficulty": next_difficulty,
        "performance": performance,
    }


def calculate_adaptive_difficulty_from_sessions(
    current_difficulty: str,
    sessions: List[Any],
    window_size: int = DEFAULT_HISTORY_WINDOW,
) -> Dict[str, Any]:
    """
    Analyzes recent completed alarm sessions (up to window_size),
    measures cognitive challenge performance, and recommends the next
    adaptive difficulty level.

    Respects all difficulty boundaries:
      beginner <-> easy <-> medium <-> hard <-> expert
    """
    normalized_difficulty = (current_difficulty or "medium").strip().lower()
    if normalized_difficulty not in DIFFICULTY_LEVELS:
        normalized_difficulty = "medium"

    # Extract recent answered challenge results (boolean: True=correct, False=wrong)
    answered_results = [
        getattr(s, "is_correct")
        for s in sessions
        if getattr(s, "is_correct", None) is not None
    ]

    # Take the latest N results
    recent_results = answered_results[-window_size:] if answered_results else []

    performance = analyze_performance(recent_results)
    total_samples = performance["total"]
    accuracy = performance["accuracy"]

    # If insufficient history is available, maintain current difficulty
    if total_samples < MINIMUM_SAMPLES_FOR_ADAPTATION:
        return {
            "current_difficulty": normalized_difficulty,
            "recommended_difficulty": normalized_difficulty,
            "performance": performance,
            "adjusted": False,
            "reason": f"Insufficient completed session history ({total_samples}/{MINIMUM_SAMPLES_FOR_ADAPTATION} required).",
            "sample_size": total_samples,
        }

    # Evaluate promotion/demotion based on recent accuracy
    if accuracy >= ACCURACY_UPGRADE_THRESHOLD:
        recommended = adjust_difficulty(normalized_difficulty, correct=True)
        if recommended != normalized_difficulty:
            reason = f"High recent accuracy ({accuracy}% >= {ACCURACY_UPGRADE_THRESHOLD}%). Recommended difficulty promotion."
            adjusted = True
        else:
            reason = f"High recent accuracy ({accuracy}%), but already at highest difficulty level ('{normalized_difficulty}')."
            adjusted = False

    elif accuracy <= ACCURACY_DOWNGRADE_THRESHOLD:
        recommended = adjust_difficulty(normalized_difficulty, correct=False)
        if recommended != normalized_difficulty:
            reason = f"Low recent accuracy ({accuracy}% <= {ACCURACY_DOWNGRADE_THRESHOLD}%). Recommended difficulty easing."
            adjusted = True
        else:
            reason = f"Low recent accuracy ({accuracy}%), but already at lowest difficulty level ('{normalized_difficulty}')."
            adjusted = False

    else:
        recommended = normalized_difficulty
        reason = f"Consistent performance ({accuracy}%). Current difficulty is well-calibrated."
        adjusted = False

    return {
        "current_difficulty": normalized_difficulty,
        "recommended_difficulty": recommended,
        "performance": performance,
        "adjusted": adjusted,
        "reason": reason,
        "sample_size": total_samples,
    }