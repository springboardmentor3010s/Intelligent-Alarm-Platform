"""Alarm scheduling helpers: next trigger, smart suggestions, snooze counts."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alarm import Alarm
from app.models.alarm_event import AlarmEvent
from app.models.profile import UserProfile
from app.models.user import User

WEEKDAYS = {0, 1, 2, 3, 4}
WEEKENDS = {5, 6}

RECURRENCE_LABELS = {
    "once": "One-time",
    "daily": "Every day",
    "weekdays": "Weekdays",
    "weekends": "Weekends",
    "smart": "Smart adaptive",
}


def user_tz(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.timezone or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def runs_on(recurrence: str, day: date) -> bool:
    if recurrence == "weekdays":
        return day.weekday() in WEEKDAYS
    if recurrence == "weekends":
        return day.weekday() in WEEKENDS
    # once, daily and smart ring on the next available day
    return True


def next_occurrence(
    recurrence: str,
    alarm_time: time,
    tz: ZoneInfo,
    now: datetime | None = None,
) -> datetime | None:
    """The next moment this alarm rings, in the user's time zone."""
    now_local = (now or datetime.now(timezone.utc)).astimezone(tz)
    for offset in range(0, 8):
        day = now_local.date() + timedelta(days=offset)
        if not runs_on(recurrence, day):
            continue
        candidate = datetime.combine(day, alarm_time, tzinfo=tz)
        if candidate > now_local:
            return candidate
    return None


def minutes_between(start: time, end: time) -> int:
    """Minutes from start to end, wrapping past midnight."""
    a = start.hour * 60 + start.minute
    b = end.hour * 60 + end.minute
    return (b - a) % (24 * 60)


def shift_time(value: time, minutes: int) -> time:
    total = (value.hour * 60 + value.minute + minutes) % (24 * 60)
    return time(total // 60, total % 60)


def local_day_start_utc(tz: ZoneInfo, now: datetime | None = None) -> datetime:
    now_local = (now or datetime.now(timezone.utc)).astimezone(tz)
    start_local = datetime.combine(now_local.date(), time(0, 0), tzinfo=tz)
    return start_local.astimezone(timezone.utc)


def snoozes_used_today(db: Session, alarm: Alarm, user: User) -> int:
    since = local_day_start_utc(user_tz(user))
    return db.scalar(
        select(func.count(AlarmEvent.id)).where(
            AlarmEvent.alarm_id == alarm.id,
            AlarmEvent.event_type == "snoozed",
            AlarmEvent.created_at >= since,
        )
    ) or 0


def recent_snooze_rate(db: Session, user_id: int, days: int = 7) -> float:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    snoozes = db.scalar(
        select(func.count(AlarmEvent.id)).where(
            AlarmEvent.user_id == user_id,
            AlarmEvent.event_type == "snoozed",
            AlarmEvent.created_at >= since,
        )
    ) or 0
    return snoozes / days


def build_smart_suggestion(
    profile: UserProfile | None,
    snoozes_per_day: float,
    next_difficulty: str | None,
) -> dict:
    """Explainable rules, no hidden model.

    - Bedtime is worked back from the wake-up time using the sleep goal.
    - Frequent snoozing lowers the snooze limit and keeps the challenge on.
    """
    goal = profile.daily_sleep_goal_minutes if profile else 480
    wake = profile.wake_target if profile else None
    sleep = profile.sleep_target if profile else None

    reasons: list[str] = []
    result: dict = {
        "alarm_time": wake.strftime("%H:%M") if wake else None,
        "bedtime": None,
        "planned_sleep_minutes": None,
        "sleep_goal_minutes": goal,
        "challenge_type": profile.preferred_challenge if profile else "math",
        "difficulty": next_difficulty or (
            profile.current_difficulty if profile else "easy"
        ),
        "snooze_limit": 2,
        "snoozes_per_day": round(snoozes_per_day, 2),
        "reasons": reasons,
    }

    if wake:
        result["bedtime"] = shift_time(wake, -goal).strftime("%H:%M")
        reasons.append(
            f"A {goal // 60}h {goal % 60:02d}m sleep goal and a "
            f"{wake.strftime('%H:%M')} wake-up means going to bed by "
            f"{result['bedtime']}."
        )
    else:
        reasons.append("Set a preferred wake-up time to get a bedtime.")

    if wake and sleep:
        planned = minutes_between(sleep, wake)
        result["planned_sleep_minutes"] = planned
        if planned < goal - 15:
            reasons.append(
                f"Your planned sleep is {planned // 60}h {planned % 60:02d}m, "
                f"{goal - planned} minutes short of your goal. "
                "Moving bedtime earlier is better than moving the alarm later."
            )

    if snoozes_per_day >= 2:
        result["snooze_limit"] = 0
        reasons.append(
            "You snoozed about "
            f"{snoozes_per_day:.1f} times a day this week, so snoozing is "
            "turned off for this alarm."
        )
    elif snoozes_per_day >= 1:
        result["snooze_limit"] = 1
        reasons.append("You snoozed often this week, so the limit is 1.")
    else:
        reasons.append("Few snoozes this week, so the default limit stays.")

    return result
