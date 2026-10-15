"""Snooze, wake-up, sleep and productivity patterns for one user."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import pstdev
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.models.user import User
from app.models.wake_up_verification import WakeUpVerification
from app.services import tracking_metrics as tm

WEEKDAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
]


def _clock(minutes: float) -> str:
    minutes = int(round(minutes)) % (24 * 60)
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _local(value: datetime, tz: ZoneInfo) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(tz)


def snooze_patterns(events, tz: ZoneInfo) -> dict:
    snoozes = [e for e in events if e.event_type == "snoozed"]
    by_day: Counter = Counter()
    by_hour: Counter = Counter()
    for event in snoozes:
        local = _local(event.created_at, tz)
        by_day[local.weekday()] += 1
        by_hour[local.hour] += 1

    peak_day = by_day.most_common(1)[0][0] if by_day else None
    peak_hour = by_hour.most_common(1)[0][0] if by_hour else None
    return {
        "total_snoozes": len(snoozes),
        "by_weekday": [
            {"day": WEEKDAYS[i], "count": by_day.get(i, 0)} for i in range(7)
        ],
        "by_hour": [
            {"hour": h, "count": c} for h, c in sorted(by_hour.items())
        ],
        "peak_weekday": WEEKDAYS[peak_day] if peak_day is not None else None,
        "peak_hour": peak_hour,
    }


def wake_patterns(verifications, tz: ZoneInfo, wake_target) -> dict:
    ok = [v for v in verifications if v.successful]
    minutes = []
    by_day: dict[int, list[bool]] = defaultdict(list)
    for v in verifications:
        local = _local(v.created_at, tz)
        by_day[local.weekday()].append(bool(v.successful))
    for v in ok:
        local = _local(v.created_at, tz)
        minutes.append(local.hour * 60 + local.minute)

    average = sum(minutes) / len(minutes) if minutes else None
    drift = None
    if average is not None and wake_target is not None:
        drift = round(average - (wake_target.hour * 60 + wake_target.minute))

    return {
        "successful_wakeups": len(ok),
        "average_wake_time": _clock(average) if average is not None else None,
        "variability_minutes": (
            round(pstdev(minutes)) if len(minutes) >= 2 else None
        ),
        "minutes_after_target": drift,
        "success_by_weekday": [
            {
                "day": WEEKDAYS[i],
                "attempts": len(by_day[i]),
                "success_rate_percent": tm._pct(sum(by_day[i]), len(by_day[i])),
            }
            for i in range(7)
        ],
    }


def sleep_patterns(logs, tz: ZoneInfo) -> dict | None:
    if not logs:
        return None
    # Minutes after 18:00 so bedtimes either side of midnight average well.
    offsets = []
    for log in logs:
        local = _local(log.bed_time, tz)
        offsets.append(((local.hour * 60 + local.minute) - 18 * 60) % (24 * 60))
    average_bed = sum(offsets) / len(offsets)
    durations = [log.duration_minutes for log in logs]

    trend = None
    if len(durations) >= 4:
        half = len(durations) // 2
        first = sum(durations[:half]) / half
        second = sum(durations[half:]) / (len(durations) - half)
        trend = round(second - first)

    return {
        "nights": len(logs),
        "average_bedtime": _clock(average_bed + 18 * 60),
        "bedtime_variability_minutes": (
            round(pstdev(offsets)) if len(offsets) >= 2 else None
        ),
        "average_duration_minutes": round(sum(durations) / len(durations)),
        "duration_change_minutes": trend,
    }


def get_patterns(db: Session, user_id: int, days: int = 30) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    try:
        tz = ZoneInfo(user.timezone or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")

    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    events = tm.load_alarm_events(db, [user_id], since, now)
    verifications = list(
        db.execute(
            select(WakeUpVerification).where(
                WakeUpVerification.user_id == user_id,
                WakeUpVerification.created_at >= since,
            )
        ).scalars()
    )
    sleep_logs = tm.load_sleep_logs(db, [user_id], since.date(), now.date())
    productivity = tm.load_productivity_logs(
        db, [user_id], since.date(), now.date()
    )

    return {
        "user_id": user_id,
        "period_days": days,
        "snooze": snooze_patterns(events, tz),
        "wake_up": wake_patterns(
            verifications, tz, profile.wake_target if profile else None
        ),
        "sleep": sleep_patterns(sleep_logs, tz),
        "productivity": tm.productivity_summary(
            productivity, tm.wake_success_by_local_day(verifications, tz)
        ),
    }
