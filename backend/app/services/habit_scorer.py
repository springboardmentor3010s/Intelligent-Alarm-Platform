"""
Habit Scorer Engine for Milestone 3.

Implements the official weighted habit scoring formula:
- Wake-Up Consistency        = 35% (0.35)
- Challenge Completion       = 25% (0.25)
- Snooze Reduction           = 20% (0.20)
- Sleep Schedule Adherence   = 20% (0.20)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional


# =====================================================================
# OFFICIAL FORMULA WEIGHT CONSTANTS
# =====================================================================

WEIGHT_WAKE_UP_CONSISTENCY = 0.35
WEIGHT_CHALLENGE_COMPLETION = 0.25
WEIGHT_SNOOZE_REDUCTION = 0.20
WEIGHT_SLEEP_SCHEDULE_ADHERENCE = 0.20


def clamp_score(score: float) -> float:
    """Clamps any score to strictly [0.0, 100.0]."""
    return max(0.0, min(100.0, float(score)))


# =====================================================================
# CORE HABIT SCORER
# =====================================================================

def calculate_habit_score(
    wake_up_consistency: float,
    challenge_completion: float,
    snooze_reduction: float,
    sleep_schedule_adherence: float,
) -> Dict[str, float]:
    """
    Computes overall habit score using the exact specification weights:
    Habit Score = 0.35 * Wake-Up Consistency
                + 0.25 * Challenge Completion
                + 0.20 * Snooze Reduction
                + 0.20 * Sleep Schedule Adherence

    Returns normalized individual components and overall score (0–100).
    """
    c_consistency = clamp_score(wake_up_consistency)
    c_completion = clamp_score(challenge_completion)
    c_snooze = clamp_score(snooze_reduction)
    c_adherence = clamp_score(sleep_schedule_adherence)

    overall = (
        (WEIGHT_WAKE_UP_CONSISTENCY * c_consistency)
        + (WEIGHT_CHALLENGE_COMPLETION * c_completion)
        + (WEIGHT_SNOOZE_REDUCTION * c_snooze)
        + (WEIGHT_SLEEP_SCHEDULE_ADHERENCE * c_adherence)
    )

    return {
        "wake_up_consistency": round(c_consistency, 2),
        "challenge_completion": round(c_completion, 2),
        "snooze_reduction": round(c_snooze, 2),
        "sleep_schedule_adherence": round(c_adherence, 2),
        "overall_habit_score": round(clamp_score(overall), 2),
    }


# =====================================================================
# BEHAVIORAL METRICS EXTRACTOR
# =====================================================================

def compute_behavioral_metrics(
    sessions: List[Any],
    user_profile: Optional[Any] = None,
    alarms: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Extracts normalized (0–100) component metrics from historical session,
    alarm, and profile objects.

    Handles empty or sparse history safely without failing.
    """
    if not sessions:
        return {
            "wake_up_consistency": 50.0,
            "challenge_completion": 50.0,
            "snooze_reduction": 100.0,
            "sleep_schedule_adherence": 50.0,
            "total_sessions": 0,
            "avg_snooze_count": 0.0,
        }

    total_sessions = len(sessions)

    # 1. Challenge Completion Success (25%)
    # Percentage of sessions solved with a correct answer
    completed_correct = sum(
        1
        for s in sessions
        if getattr(s, "session_status", None) == "completed"
        and getattr(s, "is_correct", None) is True
    )
    challenge_completion = (completed_correct / total_sessions) * 100.0

    # 2. Snooze Reduction (20%)
    # 0 avg snoozes = 100 score; 1 snooze = 75; 2 snoozes = 50; 4+ snoozes = 0
    total_snoozes = sum(getattr(s, "snooze_count", 0) or 0 for s in sessions)
    avg_snooze = total_snoozes / total_sessions
    snooze_reduction = max(0.0, 100.0 - (avg_snooze * 25.0))

    # 3. Wake-Up Consistency (35%)
    # Evaluates adherence between session started_at time and scheduled alarm_time
    consistency_scores = []
    for s in sessions:
        started_at = getattr(s, "started_at", None)
        alarm = getattr(s, "alarm", None)
        alarm_time = getattr(alarm, "alarm_time", None) if alarm else None

        if alarm_time and isinstance(started_at, datetime):
            started_minute = started_at.hour * 60 + started_at.minute
            scheduled_minute = alarm_time.hour * 60 + alarm_time.minute
            diff = abs(started_minute - scheduled_minute)
            diff = min(diff, 1440 - diff)

            if diff <= 5:
                session_consistency = 100.0
            elif diff <= 15:
                session_consistency = 85.0
            elif diff <= 30:
                session_consistency = 70.0
            elif diff <= 60:
                session_consistency = 50.0
            else:
                session_consistency = max(0.0, 100.0 - diff)
            consistency_scores.append(session_consistency)
        else:
            # Fallback when alarm reference is omitted: evaluate response duration
            duration = getattr(s, "response_time_seconds", None)
            if duration is not None:
                if duration <= 30:
                    consistency_scores.append(100.0)
                elif duration <= 60:
                    consistency_scores.append(80.0)
                else:
                    consistency_scores.append(max(20.0, 100.0 - (duration - 60)))
            else:
                consistency_scores.append(75.0)

    wake_up_consistency = (
        sum(consistency_scores) / len(consistency_scores)
        if consistency_scores
        else 50.0
    )

    # 4. Sleep Schedule Adherence (20%)
    # Compares wake session times against preferred_wake_time if configured in profile
    preferred_time = getattr(user_profile, "preferred_wake_time", None)
    adherence_scores = []

    if preferred_time:
        for s in sessions:
            started_at = getattr(s, "started_at", None)
            if started_at and isinstance(started_at, datetime):
                started_minute = started_at.hour * 60 + started_at.minute
                target_minute = preferred_time.hour * 60 + preferred_time.minute
                diff = abs(started_minute - target_minute)
                diff = min(diff, 1440 - diff)

                if diff <= 15:
                    adherence_scores.append(100.0)
                elif diff <= 30:
                    adherence_scores.append(85.0)
                elif diff <= 60:
                    adherence_scores.append(65.0)
                else:
                    adherence_scores.append(max(0.0, 100.0 - (diff * 0.75)))

    if adherence_scores:
        sleep_schedule_adherence = sum(adherence_scores) / len(adherence_scores)
    else:
        # Balanced fallback when preferred_wake_time is not set
        sleep_schedule_adherence = (wake_up_consistency + snooze_reduction) / 2.0

    return {
        "wake_up_consistency": clamp_score(wake_up_consistency),
        "challenge_completion": clamp_score(challenge_completion),
        "snooze_reduction": clamp_score(snooze_reduction),
        "sleep_schedule_adherence": clamp_score(sleep_schedule_adherence),
        "total_sessions": total_sessions,
        "avg_snooze_count": round(avg_snooze, 2),
    }


def evaluate_user_habit(
    sessions: List[Any],
    user_profile: Optional[Any] = None,
    alarms: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    High-level convenience method: extracts behavioral metrics from raw models,
    computes the weighted habit score, and returns the full result.
    """
    metrics = compute_behavioral_metrics(sessions, user_profile, alarms)
    score_breakdown = calculate_habit_score(
        wake_up_consistency=metrics["wake_up_consistency"],
        challenge_completion=metrics["challenge_completion"],
        snooze_reduction=metrics["snooze_reduction"],
        sleep_schedule_adherence=metrics["sleep_schedule_adherence"],
    )

    return {
        **score_breakdown,
        "total_sessions": metrics["total_sessions"],
        "avg_snooze_count": metrics["avg_snooze_count"],
    }
