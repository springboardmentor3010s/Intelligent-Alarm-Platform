"""Habit scoring service for Intelligent Cognitive Alarm Platform.

Computes the daily habit components (35% wake-up consistency, 25% challenge
completion, 20% snooze reduction, 20% sleep schedule adherence) from real user
data and assembles the weighted composite score.

This is the single home for the four component scorers, the streak helper, and
the composite; `analytics_service` re-exports these for backward compatibility.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from ..Models import Alarm, ChallengeAttempt, HabitScore


def _compute_wake_up_consistency(db: Session, user_id: int, target_date: str) -> int:
    """Compute wake-up consistency score (0-100) based on alarm dismissal patterns.

    Weight: 35% of overall habit score.
    Scoring: % of alarms dismissed within 15 min of trigger, penalized by snoozes.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)

    # Get alarms triggered on this day
    alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= day_start,
        Alarm.next_trigger < day_end,
    ).all()

    if not alarms:
        return 70  # Default / no data penalty

    total = len(alarms)
    dismissed_on_time = 0
    total_snooze_penalty = 0

    for alarm in alarms:
        # Each alarm with times_snoozed == 0 counts as "dismissed on time"
        # Each snooze reduces the score
        if alarm.times_snoozed == 0:
            dismissed_on_time += 1
        total_snooze_penalty += min(alarm.times_snoozed, 5)  # Cap at 5 snoozes per alarm

    on_time_rate = dismissed_on_time / total
    snooze_penalty = min(total_snooze_penalty / (total * 3), 1.0)  # Normalize penalty

    score = int((on_time_rate * 100) * (1 - snooze_penalty * 0.3))
    return max(0, min(100, score))


def _compute_challenge_completion(db: Session, user_id: int, target_date: str) -> int:
    """Compute challenge completion score (0-100).

    Weight: 25% of overall habit score.
    Scoring: % of challenge attempts completed (all questions correct) on this day,
    blended with answer accuracy, plus a streak bonus of up to 10% of the
    component for consecutive completed attempts (FR-WV-003).
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)

    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= day_start,
        ChallengeAttempt.created_at < day_end,
    ).all()

    if not attempts:
        return 50  # Default: no attempts = below average

    total = len(attempts)
    completed = sum(1 for a in attempts if a.completed)

    # Also factor in accuracy
    total_q = sum(a.total_questions for a in attempts) or 1
    correct = sum(a.correct_answers for a in attempts)
    accuracy = correct / total_q

    completion_rate = completed / total
    score = int((completion_rate * 60) + (accuracy * 40))

    # Streak bonus (max 10% of the component at a 7-day consecutive streak)
    streak_bonus = min(compute_streak_length(db, user_id) / 7.0, 1.0)
    score = int(score * 0.9 + score * 0.1 * streak_bonus)
    return max(0, min(100, score))


def compute_streak_length(db: Session, user_id: int) -> int:
    """Number of consecutive completed challenge attempts (most recent first)."""
    attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user_id)
        .order_by(ChallengeAttempt.created_at.desc())
        .all()
    )
    streak = 0
    for attempt in attempts:
        if attempt.completed:
            streak += 1
        else:
            break
    return streak


def _compute_snooze_reduction(db: Session, user_id: int, target_date: str) -> int:
    """Compute snooze reduction score (0-100).

    Weight: 20% of overall habit score.
    Scoring: inverse of total snoozes today vs 7-day average.
    Lower snooze count = higher score.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)
    week_ago = day_start - timedelta(days=7)

    # Today's snooze count
    today_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= day_start,
        Alarm.next_trigger < day_end,
    ).all()
    today_snoozes = sum(a.times_snoozed for a in today_alarms)

    # 7-day average snooze count
    week_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= week_ago,
        Alarm.next_trigger < day_end,
    ).all()

    if not week_alarms:
        return 70  # Default / no data

    # Count total snoozes across the week
    total_week_snoozes = sum(a.times_snoozed for a in week_alarms)
    days_with_alarms = len(set(a.next_trigger.date() for a in week_alarms))
    avg_daily_snoozes = total_week_snoozes / max(days_with_alarms, 1)

    if avg_daily_snoozes == 0:
        return 100  # Perfect: no snoozes at all

    # Score: how much better today is vs average
    reduction_ratio = 1 - (today_snoozes / (avg_daily_snoozes * 2))  # 2x avg = 0 score
    score = int(reduction_ratio * 100)
    return max(0, min(100, score))


def _compute_sleep_adherence(db: Session, user_id: int, target_date: str) -> int:
    """Compute sleep schedule adherence score (0-100).

    Weight: 20% of overall habit score.
    Scoring: consistency of alarm trigger times relative to user's preferred wake-up window.
    Uses cron-like regularity of alarm next_trigger times.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    week_ago = day_start - timedelta(days=7)
    day_end = day_start + timedelta(days=1)

    # Get all alarms in the last 7 days
    week_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= week_ago,
        Alarm.next_trigger < day_end,
        Alarm.is_enabled,
    ).all()

    if not week_alarms:
        return 60  # Default / no data

    # Extract trigger hours and compute consistency
    trigger_hours = [a.next_trigger.hour + a.next_trigger.minute / 60.0 for a in week_alarms]

    if len(trigger_hours) < 2:
        return 70

    mean_hour = sum(trigger_hours) / len(trigger_hours)
    variance = sum((h - mean_hour) ** 2 for h in trigger_hours) / len(trigger_hours)
    std_dev = variance ** 0.5

    # Lower std dev = more consistent schedule
    # std_dev of 0 = perfect (100), std_dev of 3+ hours = poor (0)
    consistency = max(0, 1 - (std_dev / 3.0))
    score = int(consistency * 100)
    return max(0, min(100, score))


def compute_habit_composite(
    wake_up: int, challenge: int, snooze: int, sleep: int
) -> int:
    """Weighted composite overall score (35/25/20/20)."""
    return int(wake_up * 0.35 + challenge * 0.25 + snooze * 0.20 + sleep * 0.20)


def _score_payload(score: HabitScore) -> dict:
    """Serialize a HabitScore row to the API response shape."""
    return {
        "date": score.date,
        "wake_up_consistency": score.wake_up_consistency,
        "challenge_completion": score.challenge_completion,
        "snooze_reduction": score.snooze_reduction,
        "sleep_schedule_adherence": score.sleep_schedule_adherence,
        "overall_score": score.overall_score,
    }


def get_or_compute_habit_score(
    db: Session, user_id: int, date: Optional[str] = None
) -> dict:
    """Return today's (or the given date's) habit score, computing and caching it.

    When no row exists the four components are computed from real data and an
    upsert is attempted; a lost race for `(user_id, date)` is resolved by
    reading the winner.
    """
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    existing = db.query(HabitScore).filter(
        HabitScore.user_id == user_id,
        HabitScore.date == date,
    ).first()

    if existing:
        return _score_payload(existing)

    # Honest zero-data state: no alarms and no attempts means no score exists.
    # Return 0 without fabricating defaults or writing a row (keeps new accounts
    # at zero data until they generate real activity).
    has_activity = (
        db.query(Alarm.id).filter(Alarm.user_id == user_id).first() is not None
        or db.query(ChallengeAttempt.id).filter(ChallengeAttempt.user_id == user_id).first() is not None
    )
    if not has_activity:
        return {
            "date": date,
            "wake_up_consistency": 0,
            "challenge_completion": 0,
            "snooze_reduction": 0,
            "sleep_schedule_adherence": 0,
            "overall_score": 0,
        }

    wake_up = _compute_wake_up_consistency(db, user_id, date)
    challenge = _compute_challenge_completion(db, user_id, date)
    snooze = _compute_snooze_reduction(db, user_id, date)
    sleep = _compute_sleep_adherence(db, user_id, date)
    overall = compute_habit_composite(wake_up, challenge, snooze, sleep)

    habit_score = HabitScore(
        user_id=user_id,
        date=date,
        wake_up_consistency=wake_up,
        challenge_completion=challenge,
        snooze_reduction=snooze,
        sleep_schedule_adherence=sleep,
        overall_score=overall,
    )

    from sqlalchemy.exc import IntegrityError

    try:
        db.add(habit_score)
        db.commit()
        db.refresh(habit_score)
    except IntegrityError:
        # Concurrent write for the same (user, date) lost the race; read winner.
        db.rollback()
        existing = db.query(HabitScore).filter(
            HabitScore.user_id == user_id,
            HabitScore.date == date,
        ).first()
        if existing:
            habit_score = existing
        else:
            db.rollback()

    return _score_payload(habit_score)


def refresh_habit_score(db: Session, user_id: int, date: str) -> HabitScore:
    """Recompute and upsert today's habit score after a successful dismissal.

    Recomputes all four components from actual data and either updates the
    existing row or inserts a fresh one, then commits.
    """
    habit_score = db.query(HabitScore).filter(
        HabitScore.user_id == user_id,
        HabitScore.date == date,
    ).first()

    wake_up = _compute_wake_up_consistency(db, user_id, date)
    challenge = _compute_challenge_completion(db, user_id, date)
    snooze = _compute_snooze_reduction(db, user_id, date)
    sleep = _compute_sleep_adherence(db, user_id, date)
    overall = compute_habit_composite(wake_up, challenge, snooze, sleep)

    if habit_score:
        habit_score.wake_up_consistency = wake_up
        habit_score.challenge_completion = challenge
        habit_score.snooze_reduction = snooze
        habit_score.sleep_schedule_adherence = sleep
        habit_score.overall_score = overall
    else:
        habit_score = HabitScore(
            user_id=user_id,
            date=date,
            wake_up_consistency=wake_up,
            challenge_completion=challenge,
            snooze_reduction=snooze,
            sleep_schedule_adherence=sleep,
            overall_score=overall,
        )
        db.add(habit_score)

    db.commit()
    return habit_score


def get_habit_score_history(db: Session, user_id: int, days: int = 7) -> List[dict]:
    """Return habit score history (most recent first) for the last N days.

    Days without a stored score are included with `None` component values so the
    chart renders gaps honestly instead of fabricating data.
    """
    today = datetime.now(timezone.utc).date()
    scores = []

    for i in range(days):
        target_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        habit_score = db.query(HabitScore).filter(
            HabitScore.user_id == user_id,
            HabitScore.date == target_date,
        ).first()

        if habit_score:
            scores.append(_score_payload(habit_score))
        else:
            scores.append({
                "date": target_date,
                "overall_score": None,
                "wake_up_consistency": None,
                "challenge_completion": None,
                "snooze_reduction": None,
                "sleep_schedule_adherence": None,
            })

    return scores
