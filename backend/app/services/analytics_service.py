"""Behavioral analytics service for Intelligent Cognitive Alarm Platform.

Single source of truth for analytics computations shared across the
`/analytics` and `/habits` controllers:

- Habit scoring components (35% wake-up, 25% challenge, 20% snooze, 20% sleep)
- Real sleep-duration estimate (from alarm trigger schedule + user preference)
- Wake-up consistency trend classification
- User analytics summary consumed by `GET /analytics/me`

Keeps `api/*.py` thin controllers; no duplicated scoring logic lives anywhere
else. Response keys are backward compatible (additive only).
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from ..Models import User, Alarm, Challenge, ChallengeAttempt, HabitScore

# Explicit default used only when there is genuinely no data to derive from.
_DEFAULT_SLEEP_DURATION_HOURS = 7.5


def _user_tz(user: User) -> ZoneInfo:
    """Resolve the user's IANA timezone with a UTC fallback."""
    tz_name = user.timezone or "UTC"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo("UTC")


def _coerce_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Ensure a stored datetime is UTC-aware (SQLite stores naive columns)."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


# --------------------------------------------------------------------------
# Habit scoring components (weighted composite 35/25/20/20)
# --------------------------------------------------------------------------

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
        Alarm.is_enabled == True,
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


# --------------------------------------------------------------------------
# Real behavioral analytics
# --------------------------------------------------------------------------

def compute_sleep_duration_avg(db: Session, user_id: int) -> float:
    """Estimate average nightly sleep duration in hours.

    Uses, in priority order:
    1. The user's explicit `sleep_duration_minutes` preference in settings JSON.
    2. The mean overnight gap between consecutive daily alarm triggers over the
       last 14 days (previous day's last alarm -> current day's first alarm).
    3. The explicit `_DEFAULT_SLEEP_DURATION_HOURS` only when there is no data
       to derive a value from (never fabricated confidence).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return _DEFAULT_SLEEP_DURATION_HOURS

    settings = user.settings or {}
    pref_minutes = settings.get("sleep_duration_minutes")
    if isinstance(pref_minutes, (int, float)) and pref_minutes > 0:
        return round(float(pref_minutes) / 60.0, 2)

    tz = _user_tz(user)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=14)

    alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == user_id, Alarm.next_trigger >= cutoff)
        .order_by(Alarm.next_trigger.asc())
        .all()
    )
    if not alarms:
        return _DEFAULT_SLEEP_DURATION_HOURS

    by_day: Dict[str, List[datetime]] = {}
    for alarm in alarms:
        trigger = _coerce_utc(alarm.next_trigger)
        if trigger is not None:
            by_day.setdefault(trigger.astimezone(tz).date(), []).append(trigger.astimezone(tz))

    days = sorted(by_day)
    windows = []
    for prev, cur in zip(days, days[1:]):
        if (cur - prev).days != 1:
            continue
        last_prev = by_day[prev][-1]
        first_cur = by_day[cur][0]
        gap_hours = (first_cur - last_prev).total_seconds() / 3600.0
        if 3.0 <= gap_hours <= 16.0:  # plausible overnight sleep window
            windows.append(gap_hours)

    if not windows:
        return _DEFAULT_SLEEP_DURATION_HOURS

    return round(sum(windows) / len(windows), 2)


def compute_wake_up_consistency_trend(
    db: Session, user_id: int, days: int = 7
) -> str:
    """Classify the 7-day wake-up consistency trend.

    Compares the average of the older half vs the newer half of the available
    history; tolerates a 5-point band before calling a change real.
    Returns "improving" | "stable" | "declining".
    """
    scores = (
        db.query(HabitScore)
        .filter(HabitScore.user_id == user_id)
        .order_by(HabitScore.date.asc())
        .all()
    )
    series = [s.wake_up_consistency for s in scores if s.wake_up_consistency is not None]
    if len(series) < 4:
        return "stable"

    half = len(series) // 2
    first_half = sum(series[:half]) / half
    second_half = sum(series[half:]) / (len(series) - half)
    delta = second_half - first_half

    if delta > 5:
        return "improving"
    if delta < -5:
        return "declining"
    return "stable"


def compute_recent_activity(
    db: Session, user_id: int, days: int = 7
) -> Dict[str, Any]:
    """Real per-day activity summary for the last N days."""
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=days)

    alarm_days = (
        db.query(func.date(Alarm.next_trigger))
        .filter(Alarm.user_id == user_id, Alarm.next_trigger >= recent_cutoff)
        .distinct()
        .count()
        or 0
    )
    dismissals = (
        db.query(ChallengeAttempt)
        .filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.completed == True,
            ChallengeAttempt.created_at >= recent_cutoff,
        )
        .count()
        or 0
    )
    attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user_id)
        .count()
        or 0
    )

    type_rows = (
        db.query(
            Challenge.challenge_type,
            func.count(ChallengeAttempt.id),
            func.avg(ChallengeAttempt.correct_answers),
            func.avg(ChallengeAttempt.total_questions),
            func.avg(ChallengeAttempt.time_taken_seconds),
        )
        .join(Challenge, Challenge.id == ChallengeAttempt.challenge_id)
        .filter(ChallengeAttempt.user_id == user_id)
        .group_by(Challenge.challenge_type)
        .all()
    )
    breakdown = {}
    for ctype, count, avg_correct, avg_total, avg_time in type_rows:
        avg_correct = avg_correct or 0
        avg_total = avg_total or 0
        breakdown[ctype] = {
            "attempts": int(count or 0),
            "accuracy": float(avg_correct / avg_total) if avg_total else 0.0,
            "avg_solve_time_seconds": round(float(avg_time or 0), 1),
        }

    return {
        "days_with_alarm": alarm_days,
        "successful_dismissals": dismissals,
        "challenge_accuracy_by_type": breakdown,
        "total_attempts": int(attempts),
    }


def get_user_analytics_summary(db: Session, user_id: int) -> Dict[str, Any]:
    """Assemble the `/analytics/me` response (backward-compatible keys)."""
    now = datetime.now(timezone.utc)

    total_alarms = db.query(Alarm).filter(Alarm.user_id == user_id).count() or 0

    completed_attempts = (
        db.query(ChallengeAttempt)
        .filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.completed == True,
        )
        .all()
    )
    total_dismissals = len(completed_attempts)

    avg_snooze = (
        db.query(func.avg(Alarm.times_snoozed))
        .filter(Alarm.user_id == user_id)
        .scalar()
        or 0.0
    )

    attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user_id)
        .all()
    )
    total_q = sum(a.total_questions for a in attempts) or 1
    correct_t = sum(a.correct_answers for a in attempts) or 0
    challenge_accuracy = correct_t / total_q if total_q > 0 else 0.0

    recent_activity = compute_recent_activity(db, user_id, days=7)
    recent_activity["completed_attempts"] = total_dismissals

    return {
        "user_id": user_id,
        "total_alarms": total_alarms,
        "total_dismissals": total_dismissals,
        "average_snooze_count": float(avg_snooze) if avg_snooze else 0.0,
        "wake_up_consistency_trend": compute_wake_up_consistency_trend(db, user_id, days=7),
        "challenge_accuracy": round(challenge_accuracy, 4),
        "sleep_duration_avg": compute_sleep_duration_avg(db, user_id),
        "recent_activity": recent_activity,
        "generated_at": now.isoformat(),
    }