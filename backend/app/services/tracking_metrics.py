"""Snooze, sleep, productivity and recommendation-engagement metrics.

Everything is computed from rows the platform recorded. When there is no
row to calculate from, the functions return None so the dashboards can show
an empty state instead of an invented number.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alarm_event import AlarmEvent
from app.models.productivity_log import ProductivityLog
from app.models.recommendation_event import RecommendationEvent
from app.models.sleep_log import SleepLog

# Night counts as on-schedule when it is long enough and bedtime is close
# to the sleep target.
SLEEP_DURATION_TOLERANCE = 0.90
BEDTIME_TOLERANCE_MINUTES = 45


def _pct(a: float, b: float) -> float | None:
    return round(100 * a / b, 1) if b else None


def _avg(values: list[float], digits: int = 1) -> float | None:
    return round(sum(values) / len(values), digits) if values else None


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# ---------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------

def load_alarm_events(
    db: Session, user_ids: list[int], start: datetime, end: datetime
) -> list[AlarmEvent]:
    if not user_ids:
        return []
    return list(
        db.execute(
            select(AlarmEvent)
            .where(
                AlarmEvent.user_id.in_(user_ids),
                AlarmEvent.created_at >= start,
                AlarmEvent.created_at < end,
            )
            .order_by(AlarmEvent.created_at)
        ).scalars()
    )


def load_sleep_logs(
    db: Session, user_ids: list[int], start: date, end: date
) -> list[SleepLog]:
    if not user_ids:
        return []
    return list(
        db.execute(
            select(SleepLog)
            .where(
                SleepLog.user_id.in_(user_ids),
                SleepLog.sleep_date >= start,
                SleepLog.sleep_date <= end,
            )
            .order_by(SleepLog.sleep_date)
        ).scalars()
    )


def load_productivity_logs(
    db: Session, user_ids: list[int], start: date, end: date
) -> list[ProductivityLog]:
    if not user_ids:
        return []
    return list(
        db.execute(
            select(ProductivityLog)
            .where(
                ProductivityLog.user_id.in_(user_ids),
                ProductivityLog.log_date >= start,
                ProductivityLog.log_date <= end,
            )
            .order_by(ProductivityLog.log_date)
        ).scalars()
    )


def load_recommendation_events(
    db: Session, user_ids: list[int], start: datetime, end: datetime
) -> list[RecommendationEvent]:
    if not user_ids:
        return []
    return list(
        db.execute(
            select(RecommendationEvent)
            .where(
                RecommendationEvent.user_id.in_(user_ids),
                RecommendationEvent.created_at >= start,
                RecommendationEvent.created_at < end,
            )
        ).scalars()
    )


# ---------------------------------------------------------------------
# Snoozes and dismissals
# ---------------------------------------------------------------------

def _counts(events: list[AlarmEvent]) -> dict[str, int]:
    out = {"triggered": 0, "snoozed": 0, "dismissed": 0}
    for event in events:
        if event.event_type in out:
            out[event.event_type] += 1
    return out


def snooze_reduction_component(events: list[AlarmEvent]) -> float | None:
    """100 means no snoozing. Each snooze per ring lowers the score."""
    counts = _counts(events)
    if counts["triggered"] == 0 and counts["snoozed"] == 0:
        return None
    base = max(counts["triggered"], counts["snoozed"], 1)
    return round(max(0.0, 100 * (1 - counts["snoozed"] / base)), 1)


def snooze_summary(
    current: list[AlarmEvent], previous: list[AlarmEvent]
) -> dict | None:
    cur, prev = _counts(current), _counts(previous)
    if not any(cur.values()) and not any(prev.values()):
        return None

    def rate(c: dict) -> float | None:
        return round(c["snoozed"] / c["triggered"], 2) if c["triggered"] else None

    cur_rate, prev_rate = rate(cur), rate(prev)
    reduction = None
    if prev_rate and cur_rate is not None:
        reduction = round(100 * (prev_rate - cur_rate) / prev_rate, 1)

    return {
        "available": True,
        "alarms_triggered": cur["triggered"],
        "snoozes": cur["snoozed"],
        "dismissals": cur["dismissed"],
        "snoozes_per_alarm": cur_rate,
        "previous_snoozes_per_alarm": prev_rate,
        "snooze_reduction_percent": reduction,
        "dismissal_success_rate_percent": _pct(cur["dismissed"], cur["triggered"]),
        "component_score": snooze_reduction_component(current),
    }


# ---------------------------------------------------------------------
# Sleep
# ---------------------------------------------------------------------

def _bedtime_gap_minutes(bed_local: time, target: time) -> int:
    a = bed_local.hour * 60 + bed_local.minute
    b = target.hour * 60 + target.minute
    diff = abs(a - b)
    return min(diff, 24 * 60 - diff)


def night_is_on_schedule(
    log: SleepLog,
    goal_minutes: int,
    sleep_target: time | None,
    tz: ZoneInfo,
) -> bool:
    long_enough = log.duration_minutes >= goal_minutes * SLEEP_DURATION_TOLERANCE
    if sleep_target is None:
        return long_enough
    bed_local = _utc(log.bed_time).astimezone(tz).time()
    on_time = (
        _bedtime_gap_minutes(bed_local, sleep_target)
        <= BEDTIME_TOLERANCE_MINUTES
    )
    return long_enough and on_time


def sleep_adherence_component(
    logs: list[SleepLog],
    goal_minutes: int,
    sleep_target: time | None,
    tz: ZoneInfo,
) -> float | None:
    if not logs:
        return None
    good = sum(
        1 for log in logs
        if night_is_on_schedule(log, goal_minutes, sleep_target, tz)
    )
    return _pct(good, len(logs))


def sleep_summary(
    logs: list[SleepLog],
    goal_minutes: int,
    sleep_target: time | None,
    wake_target: time | None,
    tz: ZoneInfo,
) -> dict | None:
    if not logs:
        return None
    durations = [log.duration_minutes for log in logs]
    qualities = [log.quality for log in logs if log.quality is not None]
    return {
        "available": True,
        "nights_logged": len(logs),
        "average_duration_minutes": _avg(durations, 0),
        "goal_minutes": goal_minutes,
        "average_quality": _avg(qualities, 1),
        "adherence_percent": sleep_adherence_component(
            logs, goal_minutes, sleep_target, tz
        ),
        "targets": {
            "sleep_target": sleep_target.strftime("%H:%M") if sleep_target else None,
            "wake_target": wake_target.strftime("%H:%M") if wake_target else None,
            "daily_goal_minutes": goal_minutes,
        },
        "trend": [
            {
                "date": log.sleep_date.isoformat(),
                "duration_minutes": log.duration_minutes,
                "quality": log.quality,
                "on_schedule": night_is_on_schedule(
                    log, goal_minutes, sleep_target, tz
                ),
            }
            for log in logs
        ],
    }


# ---------------------------------------------------------------------
# Productivity
# ---------------------------------------------------------------------

def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 5 or n != len(ys):
        return None
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    var_x = sum((x - mean_x) ** 2 for x in xs)
    var_y = sum((y - mean_y) ** 2 for y in ys)
    if var_x == 0 or var_y == 0:
        return None
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    return round(cov / (var_x ** 0.5 * var_y ** 0.5), 2)


def productivity_summary(
    logs: list[ProductivityLog],
    wake_success_by_day: dict[date, bool],
) -> dict | None:
    if not logs:
        return None

    ratings = [log.rating for log in logs]
    planned = sum(l.tasks_planned or 0 for l in logs)
    done = sum(l.tasks_completed or 0 for l in logs)
    focus = [l.focus_minutes for l in logs if l.focus_minutes is not None]

    paired = [
        (1.0 if wake_success_by_day[log.log_date] else 0.0, float(log.rating))
        for log in logs
        if log.log_date in wake_success_by_day
    ]
    after_success = [r for s, r in paired if s == 1.0]
    after_failure = [r for s, r in paired if s == 0.0]

    return {
        "available": True,
        "days_logged": len(logs),
        "average_rating": _avg(ratings, 1),
        "task_completion_percent": _pct(done, planned),
        "average_focus_minutes": _avg(focus, 0),
        "score_percent": round(10 * sum(ratings) / len(ratings), 1),
        "correlation": {
            "days_compared": len(paired),
            "rating_after_successful_wakeup": _avg(after_success, 1),
            "rating_after_unsuccessful_wakeup": _avg(after_failure, 1),
            "pearson_r": pearson(
                [s for s, _ in paired], [r for _, r in paired]
            ),
            "note": (
                "A relationship in your own data, not proof that one "
                "causes the other."
            ),
        },
        "trend": [
            {
                "date": log.log_date.isoformat(),
                "rating": log.rating,
                "tasks_completed": log.tasks_completed,
                "tasks_planned": log.tasks_planned,
            }
            for log in logs
        ],
    }


def wake_success_by_local_day(verifications, tz: ZoneInfo) -> dict[date, bool]:
    """True if any verification that local day succeeded."""
    days: dict[date, bool] = defaultdict(bool)
    for v in verifications:
        day = _utc(v.created_at).astimezone(tz).date()
        days[day] = days[day] or bool(v.successful)
    return dict(days)


# ---------------------------------------------------------------------
# Recommendation engagement
# ---------------------------------------------------------------------

def _rec_counts(events: list[RecommendationEvent]) -> dict[str, int]:
    out = {"viewed": 0, "accepted": 0, "dismissed": 0}
    for event in events:
        if event.action in out:
            out[event.action] += 1
    return out


def engagement_summary(
    current: list[RecommendationEvent],
    previous: list[RecommendationEvent],
) -> dict | None:
    cur, prev = _rec_counts(current), _rec_counts(previous)
    if not any(cur.values()) and not any(prev.values()):
        return None

    cur_rate = _pct(cur["accepted"], cur["viewed"])
    prev_rate = _pct(prev["accepted"], prev["viewed"])
    improvement = (
        round(cur_rate - prev_rate, 1)
        if cur_rate is not None and prev_rate is not None
        else None
    )
    return {
        "available": True,
        "viewed": cur["viewed"],
        "accepted": cur["accepted"],
        "dismissed": cur["dismissed"],
        "acceptance_rate_percent": cur_rate,
        "previous_acceptance_rate_percent": prev_rate,
        "engagement_improvement_points": improvement,
        # Relevance is the share of reviewed recommendations people acted on.
        "relevance_percent": _pct(
            cur["accepted"], cur["accepted"] + cur["dismissed"]
        ),
    }
