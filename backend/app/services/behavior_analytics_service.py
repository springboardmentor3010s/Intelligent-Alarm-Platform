"""Behavioral analytics service for Intelligent Cognitive Alarm Platform.

Derived analytics over the user's real alarm/dismissal/attempt data: sleep
duration estimate, wake-up consistency trend, recent activity breakdown, and
the `/analytics/me` summary assembly.

`analytics_service` re-exports these together with the habit-scoring module for
backward compatibility.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

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
    """Real per-day activity summary for the last N days.

    Accuracy figures count only *submitted* attempts (`end_time` set):
    pending snapshots that were never submitted are activity, not failures.
    """
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
            ChallengeAttempt.completed.is_(True),
            ChallengeAttempt.created_at >= recent_cutoff,
        )
        .count()
        or 0
    )
    attempts = (
        db.query(ChallengeAttempt)
        .filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.end_time.isnot(None),
        )
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
        .filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.end_time.isnot(None),
        )
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
            ChallengeAttempt.completed.is_(True),
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
        .filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.end_time.isnot(None),
        )
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
