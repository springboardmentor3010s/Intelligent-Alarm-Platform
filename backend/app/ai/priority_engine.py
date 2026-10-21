"""
priority_engine.py

Adaptive Difficulty Engine & Habit Scoring for the Cognitive Alarm Platform.
Supports the official 5-tier difficulty levels from the project specification:
  beginner → easy → medium → hard → expert

And implements the official Weighted Habit Scoring Model:
  Habit Score =
    Wake-Up Consistency:           35%
    Challenge Completion Success:   25%
    Snooze Reduction:              20%
    Sleep Schedule Adherence:      20%
"""

from datetime import datetime

# Official 5-tier difficulty specification:
DIFFICULTIES = ["beginner", "easy", "medium", "hard", "expert"]

# Official Habit Score Weights
HABIT_SCORE_WEIGHTS = {
    "wake_up_consistency": 0.35,
    "challenge_completion_success": 0.25,
    "snooze_reduction": 0.20,
    "sleep_schedule_adherence": 0.20,
}


def clamp(value, low, high):
    """Clamp value to [low, high]."""
    return max(low, min(high, value))


def _difficulty_index(difficulty):
    """
    Return the 0-based index for a difficulty string.
    Supports beginner (0), easy (1), medium (2), hard (3), expert (4).
    Defaults to 2 (medium) for unknown values.
    """
    d = (difficulty or "medium").lower().strip()
    return DIFFICULTIES.index(d) if d in DIFFICULTIES else 2


def recommend_difficulty(
    avg_accuracy,
    avg_response_time,
    snooze_rate=0.0,
    current="medium",
    n_samples=0,
    consecutive_correct=0,
    consecutive_incorrect=0,
    accuracy_trend=0.0,
):
    """
    Recommend the next challenge difficulty based on real user performance.
    Moves smoothly through: beginner ↔ easy ↔ medium ↔ hard ↔ expert.

    Parameters
    ----------
    avg_accuracy      : float  0-1  fraction of correct answers
    avg_response_time : float  seconds (average per question)
    snooze_rate       : float  0-1  snoozes / total alarm actions
    current           : str    current difficulty ("beginner".."expert")
    n_samples         : int    how many answered questions contributed (stability gate)
    consecutive_correct   : int  streak of consecutive correct answers
    consecutive_incorrect : int  streak of consecutive incorrect answers
    accuracy_trend    : float  trend between first half and second half of session

    Returns
    -------
    str — one of DIFFICULTIES ("beginner", "easy", "medium", "hard", "expert")
    """
    index = _difficulty_index(current)

    # Stability gate — require at least 3 answered questions before adapting
    if n_samples < 3:
        return DIFFICULTIES[index]

    accuracy = clamp(avg_accuracy, 0.0, 1.0)
    speed_score = clamp((60.0 - avg_response_time) / 40.0, 0.0, 1.0)
    streak_score = (
        1.0 if consecutive_correct >= 3
        else 0.0 if consecutive_incorrect >= 3
        else 0.5
    )
    trend_score = clamp(0.5 + accuracy_trend, 0.0, 1.0)
    performance_score = (
        0.50 * accuracy
        + 0.25 * speed_score
        + 0.15 * streak_score
        + 0.10 * trend_score
    )

    # Upgrade difficulty if strong performance and high accuracy
    if (
        performance_score >= 0.78
        and accuracy >= 0.80
        and avg_response_time <= 35
        and consecutive_correct >= 3
    ):
        index = min(index + 1, len(DIFFICULTIES) - 1)
    # Downgrade difficulty if struggling
    elif performance_score <= 0.45 or (
        consecutive_incorrect >= 3 and avg_response_time >= 35
    ):
        index = max(index - 1, 0)
    # else: maintain current difficulty

    return DIFFICULTIES[index]


def update_alarm_difficulty_from_experience(alarm, user=None, recent_challenges=None):
    """
    Re-evaluate alarm (and user preference) difficulty after a challenge session.
    Uses the most recent 10 answered questions across sessions.
    """
    if alarm is None:
        return None

    recent_challenges = recent_challenges or []

    valid = [
        c for c in recent_challenges
        if getattr(c, "is_correct", None) is not None
        and getattr(c, "user_answer", True) is not None
    ]

    if not valid:
        return alarm

    valid = sorted(
        valid,
        key=lambda c: (
            getattr(c, "created_at", None) or datetime.min,
            getattr(c, "question_number", 0),
        ),
    )[-10:]

    accuracy = sum(1 for c in valid if c.is_correct) / len(valid)

    times = [
        float(c.response_time)
        for c in valid
        if getattr(c, "response_time", None) is not None
    ]
    avg_response_time = sum(times) / len(times) if times else 30.0

    correct_streak = 0
    incorrect_streak = 0
    for challenge in reversed(valid):
        if challenge.is_correct:
            if incorrect_streak:
                break
            correct_streak += 1
        else:
            if correct_streak:
                break
            incorrect_streak += 1

    midpoint = len(valid) // 2
    first_accuracy = (
        sum(1 for item in valid[:midpoint] if item.is_correct) / midpoint
        if midpoint
        else accuracy
    )
    second_count = len(valid) - midpoint
    second_accuracy = (
        sum(1 for item in valid[midpoint:] if item.is_correct) / second_count
        if second_count
        else accuracy
    )
    accuracy_trend = second_accuracy - first_accuracy

    current_difficulty = (
        getattr(valid[-1], "difficulty", None)
        or getattr(alarm, "difficulty", None)
        or getattr(user, "difficulty_preference", None)
        or "medium"
    )

    new_difficulty = recommend_difficulty(
        avg_accuracy=accuracy,
        avg_response_time=avg_response_time,
        snooze_rate=0.0,
        current=current_difficulty,
        n_samples=len(valid),
        consecutive_correct=correct_streak,
        consecutive_incorrect=incorrect_streak,
        accuracy_trend=accuracy_trend,
    )

    alarm.difficulty = new_difficulty

    if user is not None and hasattr(user, "difficulty_preference"):
        user.difficulty_preference = new_difficulty

    return alarm


def calculate_habit_score(
    wake_consistency=0.0,
    challenge_completion=0.0,
    snooze_reduction=0.0,
    sleep_adherence=0.0,
    # Backward compatibility keyword aliases
    alarm_completion_rate=None,
    snooze_avoidance=None,
    challenge_accuracy=None,
    response_speed=None,
    recent_consistency=None,
    **kwargs,
):
    """
    Calculate the official Habit Score based on the specification's weighted model:

        Habit Score =
            Wake-Up Consistency (35%)
            + Challenge Completion Success (25%)
            + Snooze Reduction (20%)
            + Sleep Schedule Adherence (20%)

    All component inputs are normalized between 0.0 and 1.0.
    Returns float in range [0.0, 100.0].
    """
    # Resolve aliases if legacy args are passed
    if snooze_avoidance is not None and snooze_reduction == 0.0:
        snooze_reduction = snooze_avoidance
    if alarm_completion_rate is not None and wake_consistency == 0.0:
        wake_consistency = (wake_consistency + alarm_completion_rate) / 2.0
    if sleep_adherence == 0.0:
        # If sleep adherence wasn't provided directly, derive sensible baseline
        if challenge_accuracy is not None:
            sleep_adherence = 0.5 * clamp(challenge_accuracy, 0.0, 1.0) + 0.5 * clamp(wake_consistency, 0.0, 1.0)
        else:
            sleep_adherence = clamp(wake_consistency, 0.0, 1.0)

    wc = clamp(wake_consistency, 0.0, 1.0)
    cc = clamp(challenge_completion, 0.0, 1.0)
    sr = clamp(snooze_reduction, 0.0, 1.0)
    sa = clamp(sleep_adherence, 0.0, 1.0)

    raw_score = (
        0.35 * wc
        + 0.25 * cc
        + 0.20 * sr
        + 0.20 * sa
    )

    return round(clamp(raw_score * 100.0, 0.0, 100.0), 1)


def alarm_priority(snooze_count, is_smart, difficulty):
    """
    Determine alarm priority label for sorting/display.
    Higher snooze count + smart + hard/expert → high priority.
    """
    difficulty_index = _difficulty_index(difficulty)

    score = (
        snooze_count * 10
        + (15 if is_smart else 0)
        + difficulty_index * 5
    )

    if score >= 40:
        return "high"
    if score >= 20:
        return "medium"
    return "low"