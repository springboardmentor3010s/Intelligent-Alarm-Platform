"""Alarm occurrence maths: repeat rules, timezones and the smart-adaptive (sleep-cycle) algorithm."""
from datetime import datetime, date, time, timedelta
from statistics import median

from sqlalchemy.orm import Session

from app.core.timeutil import local_now, local_to_utc, utcnow
from app.models import Alarm, SleepLog, UserProfile

CYCLE_MIN = 90      # a typical sleep cycle
LATENCY_MIN = 15    # time taken to fall asleep


def parse_days(s: str | None) -> list[int]:
    return sorted({int(x) for x in (s or "").split(",") if x.strip().isdigit() and 0 <= int(x) <= 6})


def days_for_type(alarm_type: str) -> list[int]:
    return {"daily": [0, 1, 2, 3, 4, 5, 6], "weekday": [0, 1, 2, 3, 4], "weekend": [5, 6]}.get(
        alarm_type, [0, 1, 2, 3, 4, 5, 6])


def _minutes_after_18(t: time) -> int:
    m = t.hour * 60 + t.minute
    return (m - 18 * 60) % (24 * 60)


def typical_bedtime(db: Session, user_id, profile: UserProfile | None) -> time | None:
    logs = (db.query(SleepLog).filter(SleepLog.user_id == user_id)
            .order_by(SleepLog.log_date.desc()).limit(7).all())
    if len(logs) >= 3:
        m = int(median(_minutes_after_18(l.bedtime) for l in logs))
    elif profile and profile.bedtime:
        m = _minutes_after_18(profile.bedtime)
    else:
        return None
    total = (m + 18 * 60) % (24 * 60)
    return time(total // 60, total % 60)


def smart_time(db: Session, alarm: Alarm, profile: UserProfile | None) -> time:
    """Pick the end of a sleep cycle inside [target - window, target] based on the user's typical bedtime.

    Waking at the end of a ~90-minute cycle (rather than mid-cycle) is associated with less grogginess.
    This is a heuristic, not a medical device: if no bedtime is known the alarm rings at the target time.
    """
    bed = typical_bedtime(db, alarm.user_id, profile)
    if bed is None:
        return alarm.time
    bed_min = _minutes_after_18(bed) + LATENCY_MIN
    target_min = _minutes_after_18(alarm.time)
    if target_min <= bed_min:  # target earlier than bedtime in the 18:00-based frame -> wrap a day
        target_min += 24 * 60
    best = None
    n = 1
    while bed_min + n * CYCLE_MIN <= target_min:
        cand = bed_min + n * CYCLE_MIN
        if target_min - alarm.smart_window_minutes <= cand <= target_min:
            best = cand
        n += 1
    if best is None:
        return alarm.time
    total = (best + 18 * 60) % (24 * 60)
    return time(total // 60, total % 60)


def effective_time(db: Session, alarm: Alarm, profile: UserProfile | None) -> time:
    return smart_time(db, alarm, profile) if alarm.alarm_type == "smart_adaptive" else alarm.time


def applies_on(alarm: Alarm, d: date) -> bool:
    if alarm.one_time_date:
        return d == alarm.one_time_date
    return d.weekday() in parse_days(alarm.repeat_days)


def ring_utc(db: Session, alarm: Alarm, profile: UserProfile | None, d: date) -> datetime | None:
    if not applies_on(alarm, d):
        return None
    tz = profile.timezone if profile else "UTC"
    return local_to_utc(d, effective_time(db, alarm, profile), tz)


def next_ring(db: Session, alarm: Alarm, profile: UserProfile | None, now: datetime | None = None) -> datetime | None:
    now = now or utcnow()
    tz = profile.timezone if profile else "UTC"
    today = local_now(tz, now).date()
    for offset in range(0, 9):
        r = ring_utc(db, alarm, profile, today + timedelta(days=offset))
        if r and r > now:
            return r
    return None
