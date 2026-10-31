"""
Dashboard metrics for the user, wellness-coach and admin dashboards.

Everything here is computed from recorded rows. Where no rows exist for the
period (snoozes, sleep, productivity, recommendation engagement) the result is {"available": False, "reason": ...} so the UI shows
an empty state instead of an invented number.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alarm import Alarm
from app.models.challenge import Challenge
from app.models.challenge_attempt import ChallengeAttempt
from app.models.profile import UserProfile
from app.models.user import User
from app.models.wake_up_verification import WakeUpVerification
from app.services import tracking_metrics as tm

# Spec weights: wake-up consistency, challenge completion, snooze reduction,
# sleep schedule adherence.
HABIT_WEIGHTS = {
    "wake_up_consistency": 0.35,
    "challenge_completion": 0.25,
    "snooze_reduction": 0.20,
    "sleep_schedule_adherence": 0.20,
}

DEFAULT_TARGET_WINDOW_MINUTES = 15
MAX_RANGE_DAYS = 366
DIFFICULTY_ORDER = {
    "beginner": 0,
    "easy": 1,
    "medium": 2,
    "hard": 3,
    "expert": 4,
}

NO_SNOOZE_DATA = {
    "available": False,
    "reason": (
        "No alarm events were recorded in this period. Snooze analytics "
        "appear once alarms ring, are snoozed or are dismissed."
    ),
}
NO_SLEEP_DATA = {
    "available": False,
    "reason": (
        "No sleep logs are recorded in this period. Log your sleep to see "
        "durations and schedule adherence."
    ),
}
NO_PRODUCTIVITY_DATA = {
    "available": False,
    "reason": "No productivity check-ins are recorded in this period.",
}
NO_RECOMMENDATION_ENGAGEMENT = {
    "available": False,
    "reason": (
        "No recommendation views or actions are recorded in this period, "
        "so engagement cannot be calculated."
    ),
}


# ---------------------------------------------------------------------
# Date ranges
# ---------------------------------------------------------------------

@dataclass(frozen=True)
class DateRange:
    start_date: date
    end_date: date  # inclusive
    start: datetime  # aware UTC
    end: datetime  # aware UTC, exclusive
    prev_start: datetime
    days: int

    @property
    def naive(self) -> tuple[datetime, datetime, datetime]:
        """Naive UTC bounds for columns declared without timezone."""
        return (
            self.start.replace(tzinfo=None),
            self.end.replace(tzinfo=None),
            self.prev_start.replace(tzinfo=None),
        )


def resolve_range(
    start: str | None, end: str | None, default_days: int = 30
) -> DateRange:
    today = datetime.now(timezone.utc).date()
    try:
        end_date = date.fromisoformat(end) if end else today
        start_date = (
            date.fromisoformat(start)
            if start
            else end_date - timedelta(days=default_days - 1)
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Dates must use the YYYY-MM-DD format.",
        )
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="The start date must not be after the end date.",
        )
    days = (end_date - start_date).days + 1
    if days > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"The date range cannot exceed {MAX_RANGE_DAYS} days.",
        )
    utc = timezone.utc
    start_dt = datetime.combine(start_date, datetime.min.time(), utc)
    end_dt = datetime.combine(
        end_date + timedelta(days=1), datetime.min.time(), utc
    )
    return DateRange(
        start_date=start_date,
        end_date=end_date,
        start=start_dt,
        end=end_dt,
        prev_start=start_dt - timedelta(days=days),
        days=days,
    )


# ---------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------

def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _pct(numerator: int | float, denominator: int | float) -> float | None:
    return round(100 * numerator / denominator, 1) if denominator else None


def _avg(values: list[float], digits: int = 2) -> float | None:
    return round(sum(values) / len(values), digits) if values else None


def _tz(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


# ---------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------

def _load_verifications(
    db: Session, user_ids: list[int], rng: DateRange
) -> list[WakeUpVerification]:
    if not user_ids:
        return []
    return list(
        db.execute(
            select(WakeUpVerification)
            .where(
                WakeUpVerification.user_id.in_(user_ids),
                WakeUpVerification.created_at >= rng.prev_start,
                WakeUpVerification.created_at < rng.end,
            )
            .order_by(WakeUpVerification.created_at)
        ).scalars()
    )


def _load_attempts(
    db: Session, user_ids: list[int], rng: DateRange
) -> list[tuple[ChallengeAttempt, str, str]]:
    if not user_ids:
        return []
    _, naive_end, naive_prev = rng.naive
    rows = db.execute(
        select(
            ChallengeAttempt,
            Challenge.difficulty,
            Challenge.challenge_type,
        )
        .join(Challenge, Challenge.id == ChallengeAttempt.challenge_id)
        .where(
            ChallengeAttempt.user_id.in_(user_ids),
            ChallengeAttempt.created_at >= naive_prev,
            ChallengeAttempt.created_at < naive_end,
        )
        .order_by(ChallengeAttempt.created_at)
    ).all()
    return [(a, d, t) for a, d, t in rows]


# ---------------------------------------------------------------------
# Period calculations (one user, one half-open window)
# ---------------------------------------------------------------------

def _wake_up_timing(
    verifs: list[WakeUpVerification],
    alarms: dict[int, Alarm],
    tz: ZoneInfo,
    window: int,
) -> dict:
    """Compare completion time with the linked alarm's scheduled time."""
    scheduled = 0
    within = 0
    late = 0
    delays: list[float] = []

    for v in verifs:
        alarm = alarms.get(v.alarm_id) if v.alarm_id else None
        if alarm is None:
            continue
        scheduled += 1
        if not v.successful or v.completed_at is None:
            continue
        done = _utc(v.completed_at).astimezone(tz)
        candidates = [
            datetime.combine(
                done.date() + timedelta(days=offset),
                alarm.alarm_time,
                tz,
            )
            for offset in (-1, 0, 1)
        ]
        target = min(candidates, key=lambda c: abs((done - c).total_seconds()))
        delay = (done - target).total_seconds() / 60
        if abs(delay) > 12 * 60:
            continue
        delays.append(max(delay, 0.0))
        if delay <= window:
            within += 1
        else:
            late += 1

    return {
        "scheduled": scheduled,
        "within_window": within,
        "late": late,
        "consistency_percent": _pct(within, scheduled),
        "late_percent": _pct(late, scheduled),
        "average_delay_minutes": _avg(delays, 1),
    }


def _challenge_stats(
    rows: list[tuple[ChallengeAttempt, str, str]],
) -> dict:
    attempts = len(rows)
    correct = sum(1 for a, _, _ in rows if a.is_correct)
    times = [a.response_time for a, _, _ in rows if a.response_time is not None]

    assigned = {a.challenge_id for a, _, _ in rows}
    completed = {a.challenge_id for a, _, _ in rows if a.is_correct}

    def breakdown(index: int) -> list[dict]:
        groups: dict[str, list] = defaultdict(list)
        for row in rows:
            groups[row[index]].append(row[0])
        out = []
        for key, items in groups.items():
            ok = sum(1 for i in items if i.is_correct)
            out.append(
                {
                    "name": key,
                    "attempts": len(items),
                    "correct": ok,
                    "accuracy_percent": _pct(ok, len(items)),
                    "average_response_seconds": _avg(
                        [i.response_time for i in items if i.response_time is not None]
                    ),
                }
            )
        out.sort(key=lambda r: DIFFICULTY_ORDER.get(r["name"], 9))
        return out

    return {
        "attempts": attempts,
        "correct": correct,
        "accuracy_percent": _pct(correct, attempts),
        "average_response_seconds": _avg(times),
        "assigned": len(assigned),
        "completed": len(completed),
        "completion_percent": _pct(len(completed), len(assigned)),
        "by_difficulty": breakdown(1),
        "by_type": breakdown(2),
    }


def _habit_score(
    consistency: float | None,
    completion: float | None,
    snooze_reduction: float | None = None,
    sleep_adherence: float | None = None,
) -> dict:
    """Weighted score using only components that have recorded data."""
    components = {
        "wake_up_consistency": consistency,
        "challenge_completion": completion,
        "snooze_reduction": snooze_reduction,
        "sleep_schedule_adherence": sleep_adherence,
    }
    available = {k: v for k, v in components.items() if v is not None}
    if not available:
        return {
            "score": None,
            "partial": True,
            "components": components,
            "weights": HABIT_WEIGHTS,
            "weights_used": {},
        }
    total_weight = sum(HABIT_WEIGHTS[k] for k in available)
    score = sum(HABIT_WEIGHTS[k] * v for k, v in available.items()) / total_weight
    return {
        "score": round(score, 1),
        "partial": len(available) < len(HABIT_WEIGHTS),
        "components": components,
        "weights": HABIT_WEIGHTS,
        "weights_used": {
            k: round(HABIT_WEIGHTS[k] / total_weight, 3) for k in available
        },
    }


def _period(
    verifs: list[WakeUpVerification],
    attempts: list[tuple[ChallengeAttempt, str, str]],
    alarms: dict[int, Alarm],
    tz: ZoneInfo,
    window: int,
    extras: dict | None = None,
) -> dict:
    extras = extras or {}
    ok = sum(1 for v in verifs if v.successful)
    times = [v.response_time for v in verifs if v.response_time is not None]
    timing = _wake_up_timing(verifs, alarms, tz, window)
    challenges = _challenge_stats(attempts)
    habit = _habit_score(
        timing["consistency_percent"],
        challenges["completion_percent"],
        extras.get("snooze_reduction"),
        extras.get("sleep_schedule_adherence"),
    )
    return {
        "wake_up": {
            "attempts": len(verifs),
            "successful": ok,
            "unsuccessful": len(verifs) - ok,
            "success_rate_percent": _pct(ok, len(verifs)),
            "average_response_seconds": _avg(times),
            **timing,
        },
        "challenges": challenges,
        "habit": habit,
    }


# ---------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------

def _daily_series(
    verifs: list[WakeUpVerification],
    attempts: list[tuple[ChallengeAttempt, str, str]],
    rng: DateRange,
    tz: ZoneInfo,
) -> list[dict]:
    days: dict[str, dict] = {}
    for i in range(rng.days):
        key = (rng.start_date + timedelta(days=i)).isoformat()
        days[key] = {
            "date": key,
            "wake_attempts": 0,
            "wake_successful": 0,
            "challenge_attempts": 0,
            "challenge_correct": 0,
            "_rt": [],
        }
    for v in verifs:
        if not (rng.start <= _utc(v.created_at) < rng.end):
            continue
        key = _utc(v.created_at).astimezone(tz).date().isoformat()
        if key in days:
            days[key]["wake_attempts"] += 1
            days[key]["wake_successful"] += int(v.successful)
    for a, _, _ in attempts:
        created = _utc(a.created_at)
        if not (rng.start <= created < rng.end):
            continue
        key = created.astimezone(tz).date().isoformat()
        if key in days:
            days[key]["challenge_attempts"] += 1
            days[key]["challenge_correct"] += int(a.is_correct)
            if a.response_time is not None:
                days[key]["_rt"].append(a.response_time)

    out = []
    for key in sorted(days):
        d = days[key]
        rt = d.pop("_rt")
        d["wake_success_rate_percent"] = _pct(d["wake_successful"], d["wake_attempts"])
        d["challenge_accuracy_percent"] = _pct(
            d["challenge_correct"], d["challenge_attempts"]
        )
        d["average_response_seconds"] = _avg(rt)
        out.append(d)
    return out


def _roll_up(daily: list[dict], bucket) -> list[dict]:
    groups: dict[str, dict] = {}
    for d in daily:
        key = bucket(date.fromisoformat(d["date"]))
        g = groups.setdefault(
            key,
            {"period": key, "wake_attempts": 0, "wake_successful": 0,
             "challenge_attempts": 0, "challenge_correct": 0},
        )
        for field in ("wake_attempts", "wake_successful",
                      "challenge_attempts", "challenge_correct"):
            g[field] += d[field]
    out = []
    for key in sorted(groups):
        g = groups[key]
        g["wake_success_rate_percent"] = _pct(g["wake_successful"], g["wake_attempts"])
        g["challenge_accuracy_percent"] = _pct(
            g["challenge_correct"], g["challenge_attempts"]
        )
        out.append(g)
    return out


def _difficulty_timeline(
    attempts: list[tuple[ChallengeAttempt, str, str]], rng: DateRange
) -> dict:
    """Weekly dominant difficulty of the challenges actually attempted."""
    weeks: dict[str, Counter] = defaultdict(Counter)
    for a, difficulty, _ in attempts:
        created = _utc(a.created_at)
        if not (rng.start <= created < rng.end):
            continue
        d = created.date()
        weeks[(d - timedelta(days=d.weekday())).isoformat()][difficulty] += 1
    timeline = []
    previous = None
    changes = []
    for week in sorted(weeks):
        counts = weeks[week]
        dominant = max(counts, key=lambda k: (counts[k], DIFFICULTY_ORDER.get(k, 0)))
        timeline.append({"week_start": week, "dominant": dominant, "counts": dict(counts)})
        if previous and previous != dominant:
            changes.append({"week_start": week, "from": previous, "to": dominant})
        previous = dominant
    return {"timeline": timeline, "changes": changes}


# ---------------------------------------------------------------------
# Recommendations (rule based, derived from the user's recorded numbers)
# ---------------------------------------------------------------------

def _recommendations(
    current: dict, habit_delta: float | None, active_alarms: int, difficulty: str
) -> list[dict]:
    w = current["wake_up"]
    c = current["challenges"]
    recs: list[dict] = []

    def add(rec_id, title, detail, basis):
        recs.append({"id": rec_id, "title": title, "detail": detail, "basis": basis})

    if active_alarms == 0:
        add("enable-alarm", "Set a consistent wake-up time",
            "Enable at least one alarm so your routine can be tracked.",
            "0 alarms are enabled.")
    if w["attempts"] >= 3 and (w["success_rate_percent"] or 0) < 70:
        add("improve-wakeups", "Make your wake-up flow easier",
            "Keep a consistent bedtime and keep your device within reach.",
            f"Wake-up success rate is {w['success_rate_percent']}% over {w['attempts']} attempts.")
    if (w["late_percent"] or 0) >= 30:
        add("reduce-lateness", "Aim to finish the wake-up check sooner",
            "Prepare what you need the night before so you can dismiss on time.",
            f"{w['late_percent']}% of scheduled wake-ups finished after the target window.")
    if c["attempts"] >= 5 and (c["accuracy_percent"] or 0) < 60:
        add("easier-challenges", "Try an easier challenge level",
            "Lower accuracy suggests the current difficulty is a stretch right now.",
            f"Challenge accuracy is {c['accuracy_percent']}% (current level: {difficulty}).")
    if c["attempts"] >= 10 and (c["accuracy_percent"] or 0) >= 90 and difficulty != "expert":
        add("harder-challenges", "Move up a difficulty level",
            "You are answering reliably, so a harder level may keep you alert.",
            f"Challenge accuracy is {c['accuracy_percent']}% over {c['attempts']} attempts.")
    if (c["average_response_seconds"] or 0) > 30:
        add("reduce-friction", "Reduce morning friction",
            "Keep the first challenge short and your phone out of bed.",
            f"Average response time is {c['average_response_seconds']}s.")
    if habit_delta is not None and habit_delta <= -5:
        add("habit-decline", "Your habit score has dipped",
            "Review which days slipped and protect one anchor wake-up time.",
            f"Habit score changed by {habit_delta:+.1f} versus the previous period.")
    if not recs:
        add("steady", "Keep your routine steady",
            "Maintain a consistent wake-up time and review your weekly trend.",
            "No risk signals were found in the selected period.")
    return recs


# ---------------------------------------------------------------------
# Aggregate sleep trend and wellness guidance (coach + admin)
# ---------------------------------------------------------------------

def _sleep_trend_series(
    sleep_logs: list,
    profiles: dict,
    user_map: dict,
    rng: DateRange,
) -> list[dict]:
    """Daily aggregate sleep trend across one or more users.

    One point per day in the range: average sleep duration, number of nights
    logged, and the share of nights that were on schedule. Days with no logs
    carry nulls so the chart shows a gap rather than an invented zero.
    """
    by_date: dict[str, list[tuple[int, bool]]] = defaultdict(list)
    for log in sleep_logs:
        if not (rng.start_date <= log.sleep_date <= rng.end_date):
            continue
        profile = profiles.get(log.user_id)
        user = user_map.get(log.user_id)
        goal = profile.daily_sleep_goal_minutes if profile else 480
        target = profile.sleep_target if profile else None
        tz = _tz(user.timezone) if user else ZoneInfo("UTC")
        on_schedule = tm.night_is_on_schedule(log, goal, target, tz)
        by_date[log.sleep_date.isoformat()].append(
            (log.duration_minutes, on_schedule)
        )

    series = []
    for i in range(rng.days):
        day = (rng.start_date + timedelta(days=i)).isoformat()
        entries = by_date.get(day, [])
        if entries:
            durations = [e[0] for e in entries]
            on = sum(1 for e in entries if e[1])
            series.append({
                "date": day,
                "nights_logged": len(entries),
                "average_duration_minutes": _avg(durations, 0),
                "on_schedule_percent": _pct(on, len(entries)),
            })
        else:
            series.append({
                "date": day,
                "nights_logged": 0,
                "average_duration_minutes": None,
                "on_schedule_percent": None,
            })
    return series


def _wellness_guidance(
    *,
    wake_success_percent: float | None,
    challenge_accuracy_percent: float | None,
    sleep_adherence_percent: float | None,
    average_sleep_minutes: float | None,
    sleep_goal_minutes: int,
    habit_improvement: float | None,
) -> list[dict]:
    """Recommendation list (sleep improvement, wake-up, habit, productivity)
    built from aggregate figures. Used by the coach and admin dashboards."""
    out: list[dict] = []

    def add(rec_id, category, title, detail):
        out.append({"id": rec_id, "category": category, "title": title, "detail": detail})

    # Sleep improvement -------------------------------------------------
    if sleep_adherence_percent is None:
        add("sleep-log", "sleep", "Encourage sleep logging",
            "Little or no sleep data is recorded. Logging bedtime and wake "
            "time unlocks sleep-schedule adherence and trend analysis.")
    else:
        if sleep_adherence_percent < 70:
            add("sleep-adherence", "sleep", "Improve sleep-schedule adherence",
                f"Average sleep-schedule adherence is {sleep_adherence_percent}%. "
                "A steady bedtime within the target window is the fastest win.")
        if (
            average_sleep_minutes is not None
            and average_sleep_minutes < sleep_goal_minutes - 30
        ):
            short = round((sleep_goal_minutes - average_sleep_minutes) / 60, 1)
            add("sleep-duration", "sleep", "Increase nightly sleep duration",
                f"Average sleep is about {short}h short of the "
                f"{round(sleep_goal_minutes / 60, 1)}h goal. An earlier bedtime "
                "helps wake-up performance the next morning.")

    # Wake-up optimization ---------------------------------------------
    if wake_success_percent is not None and wake_success_percent < 70:
        add("wake-success", "wake_up", "Optimise the wake-up flow",
            f"Wake-up success is {wake_success_percent}%. Keep the device "
            "within reach and the first challenge short to raise completion.")

    # Habit improvement -------------------------------------------------
    if habit_improvement is not None and habit_improvement <= -3:
        add("habit-dip", "habit", "Address the habit-score dip",
            f"Average habit score moved {habit_improvement:+.1f} versus the "
            "previous period. Review which days slipped and protect one anchor "
            "wake-up time.")
    elif habit_improvement is not None and habit_improvement >= 3:
        add("habit-gain", "habit", "Reinforce the positive trend",
            f"Average habit score improved {habit_improvement:+.1f}. Keep the "
            "current routine and celebrate the progress to sustain it.")

    # Productivity / challenge difficulty ------------------------------
    if challenge_accuracy_percent is not None and challenge_accuracy_percent < 60:
        add("challenge-difficulty", "productivity", "Tune challenge difficulty",
            f"Challenge accuracy is {challenge_accuracy_percent}%. Easing the "
            "difficulty can keep morning engagement high without frustration.")

    if not out:
        add("steady", "general", "Maintain the current routine",
            "No risk signals were found in this period. Keep reinforcing "
            "consistent wake-up and sleep times.")
    return out


# ---------------------------------------------------------------------
# User dashboard
# ---------------------------------------------------------------------

def _user_context(db: Session, user_id: int):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).scalar_one_or_none()
    alarms = list(db.execute(select(Alarm).where(Alarm.user_id == user_id)).scalars())
    return user, profile, alarms


def user_dashboard(
    db: Session,
    user_id: int,
    rng: DateRange,
    window: int = DEFAULT_TARGET_WINDOW_MINUTES,
) -> dict:
    user, profile, alarms = _user_context(db, user_id)
    tz = _tz(user.timezone)
    alarm_map = {a.id: a for a in alarms}

    verifs = _load_verifications(db, [user_id], rng)
    attempts = _load_attempts(db, [user_id], rng)

    cur_v = [v for v in verifs if _utc(v.created_at) >= rng.start]
    prev_v = [v for v in verifs if _utc(v.created_at) < rng.start]
    naive_start = rng.naive[0]
    cur_a = [r for r in attempts if r[0].created_at >= naive_start]
    prev_a = [r for r in attempts if r[0].created_at < naive_start]

    goal_minutes = profile.daily_sleep_goal_minutes if profile else 480
    sleep_target = profile.sleep_target if profile else None
    wake_target = profile.wake_target if profile else None

    events = tm.load_alarm_events(db, [user_id], rng.prev_start, rng.end)
    cur_events = [e for e in events if _utc(e.created_at) >= rng.start]
    prev_events = [e for e in events if _utc(e.created_at) < rng.start]

    sleep_logs = tm.load_sleep_logs(
        db, [user_id], rng.prev_start.date(), rng.end_date
    )
    cur_sleep = [l for l in sleep_logs if l.sleep_date >= rng.start_date]
    prev_sleep = [l for l in sleep_logs if l.sleep_date < rng.start_date]

    current = _period(
        cur_v, cur_a, alarm_map, tz, window,
        {
            "snooze_reduction": tm.snooze_reduction_component(cur_events),
            "sleep_schedule_adherence": tm.sleep_adherence_component(
                cur_sleep, goal_minutes, sleep_target, tz
            ),
        },
    )
    previous = _period(
        prev_v, prev_a, alarm_map, tz, window,
        {
            "snooze_reduction": tm.snooze_reduction_component(prev_events),
            "sleep_schedule_adherence": tm.sleep_adherence_component(
                prev_sleep, goal_minutes, sleep_target, tz
            ),
        },
    )

    productivity_logs = tm.load_productivity_logs(
        db, [user_id], rng.start_date, rng.end_date
    )
    recommendation_events = tm.load_recommendation_events(
        db, [user_id], rng.prev_start, rng.end
    )

    cur_score = current["habit"]["score"]
    prev_score = previous["habit"]["score"]
    delta = (
        round(cur_score - prev_score, 1)
        if cur_score is not None and prev_score is not None
        else None
    )
    current["habit"]["previous_score"] = prev_score
    current["habit"]["improvement"] = delta

    difficulty = profile.current_difficulty if profile else "easy"
    daily = _daily_series(cur_v, cur_a, rng, tz)
    by_diff = current["challenges"]["by_difficulty"]

    return {
        "user": {"id": user.id, "full_name": user.full_name, "timezone": user.timezone},
        "range": {
            "start": rng.start_date.isoformat(),
            "end": rng.end_date.isoformat(),
            "days": rng.days,
            "target_window_minutes": window,
        },
        "overview": {
            "total_alarms": len(alarms),
            "active_alarms": sum(1 for a in alarms if a.enabled),
            "completed_wakeups": current["wake_up"]["successful"],
            "habit_score": cur_score,
        },
        "wake_up": current["wake_up"],
        "snooze": tm.snooze_summary(cur_events, prev_events) or NO_SNOOZE_DATA,
        "challenges": {
            k: v for k, v in current["challenges"].items()
            if k not in ("by_difficulty", "by_type")
        },
        "challenge_breakdown": {
            "by_type": current["challenges"]["by_type"],
        },
        "difficulty": {
            "current": difficulty,
            "performance_by_level": by_diff,
            **_difficulty_timeline(cur_a, rng),
            "note": (
                "History shows the difficulty of challenges actually "
                "attempted each week; setting changes are not logged."
            ),
        },
        "habit": current["habit"],
        "sleep": tm.sleep_summary(
            cur_sleep, goal_minutes, sleep_target, wake_target, tz
        ) or {
            **NO_SLEEP_DATA,
            "targets": {
                "sleep_target": sleep_target.strftime("%H:%M") if sleep_target else None,
                "wake_target": wake_target.strftime("%H:%M") if wake_target else None,
                "daily_goal_minutes": goal_minutes,
            },
        },
        "productivity": tm.productivity_summary(
            productivity_logs,
            tm.wake_success_by_local_day(cur_v, tz),
        ) or NO_PRODUCTIVITY_DATA,
        "recommendations": _recommendations(
            current, delta, sum(1 for a in alarms if a.enabled), difficulty
        ),
        "recommendation_engagement": tm.engagement_summary(
            [e for e in recommendation_events if _utc(e.created_at) >= rng.start],
            [e for e in recommendation_events if _utc(e.created_at) < rng.start],
        ) or NO_RECOMMENDATION_ENGAGEMENT,
        "trends": {
            "daily": daily,
            "weekly": _roll_up(
                daily, lambda d: (d - timedelta(days=d.weekday())).isoformat()
            ),
            "monthly": _roll_up(daily, lambda d: d.strftime("%Y-%m")),
        },
    }


# ---------------------------------------------------------------------
# Coach dashboard
# ---------------------------------------------------------------------

def _risk_reasons(
    cur: dict, prev: dict, ordered_verifs: list[WakeUpVerification]
) -> list[str]:
    reasons: list[str] = []
    cs, ps = cur["habit"]["score"], prev["habit"]["score"]
    if cs is not None and ps is not None and cs - ps <= -10:
        reasons.append(f"Habit score fell {abs(cs - ps):.1f} points")

    cw, pw = cur["wake_up"], prev["wake_up"]
    if (
        cw["attempts"] >= 3
        and pw["attempts"] >= 3
        and (pw["success_rate_percent"] or 0) - (cw["success_rate_percent"] or 0) >= 15
    ):
        reasons.append("Wake-up success rate dropped 15+ points")

    recent = ordered_verifs[-3:]
    if len(recent) == 3 and not any(v.successful for v in recent):
        reasons.append("Last 3 wake-up attempts were unsuccessful")

    if cw["attempts"] == 0 and pw["attempts"] > 0:
        reasons.append("No wake-up activity this period")
    return reasons


def _interventions(reasons: list[str]) -> list[str]:
    mapping = {
        "Habit score": "Check in this week and agree on one anchor wake-up time.",
        "success rate": "Review the alarm schedule and the difficulty setting together.",
        "unsuccessful": "Contact the user soon to find out what is blocking wake-ups.",
        "No wake-up": "Send a re-engagement message and confirm alarms are still enabled.",
    }
    out = []
    for reason in reasons:
        for needle, action in mapping.items():
            if needle in reason and action not in out:
                out.append(action)
    return out


def coach_overview(
    db: Session,
    user_ids: list[int],
    rng: DateRange,
    window: int = DEFAULT_TARGET_WINDOW_MINUTES,
) -> dict:
    users = (
        list(db.execute(select(User).where(User.id.in_(user_ids))).scalars())
        if user_ids else []
    )
    all_verifs = _load_verifications(db, user_ids, rng)
    all_attempts = _load_attempts(db, user_ids, rng)
    alarms = (
        list(db.execute(select(Alarm).where(Alarm.user_id.in_(user_ids))).scalars())
        if user_ids else []
    )
    naive_start = rng.naive[0]

    profiles = {
        p.user_id: p
        for p in (
            db.execute(
                select(UserProfile).where(UserProfile.user_id.in_(user_ids))
            ).scalars()
            if user_ids else []
        )
    }
    all_events = tm.load_alarm_events(db, user_ids, rng.prev_start, rng.end)
    all_sleep = tm.load_sleep_logs(
        db, user_ids, rng.prev_start.date(), rng.end_date
    )
    sleep_adherence_values: list[float] = []

    def extras_for(user, events, sleep_logs):
        profile = profiles.get(user.id)
        return {
            "snooze_reduction": tm.snooze_reduction_component(events),
            "sleep_schedule_adherence": tm.sleep_adherence_component(
                sleep_logs,
                profile.daily_sleep_goal_minutes if profile else 480,
                profile.sleep_target if profile else None,
                _tz(user.timezone),
            ),
        }

    rows = []
    for user in sorted(users, key=lambda u: u.full_name.lower()):
        tz = _tz(user.timezone)
        user_alarms = {a.id: a for a in alarms if a.user_id == user.id}
        verifs = [v for v in all_verifs if v.user_id == user.id]
        atts = [r for r in all_attempts if r[0].user_id == user.id]
        events = [e for e in all_events if e.user_id == user.id]
        sleeps = [l for l in all_sleep if l.user_id == user.id]
        cur_extras = extras_for(
            user,
            [e for e in events if _utc(e.created_at) >= rng.start],
            [l for l in sleeps if l.sleep_date >= rng.start_date],
        )
        if cur_extras["sleep_schedule_adherence"] is not None:
            sleep_adherence_values.append(cur_extras["sleep_schedule_adherence"])
        cur = _period(
            [v for v in verifs if _utc(v.created_at) >= rng.start],
            [r for r in atts if r[0].created_at >= naive_start],
            user_alarms, tz, window, cur_extras,
        )
        prev = _period(
            [v for v in verifs if _utc(v.created_at) < rng.start],
            [r for r in atts if r[0].created_at < naive_start],
            user_alarms, tz, window,
            extras_for(
                user,
                [e for e in events if _utc(e.created_at) < rng.start],
                [l for l in sleeps if l.sleep_date < rng.start_date],
            ),
        )
        cs, ps = cur["habit"]["score"], prev["habit"]["score"]
        reasons = _risk_reasons(
            cur, prev, [v for v in verifs if _utc(v.created_at) >= rng.start]
        )
        last = max((_utc(v.created_at) for v in verifs), default=None)
        rows.append(
            {
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "is_active": user.is_active,
                "habit_score": cs,
                "habit_improvement": round(cs - ps, 1) if cs is not None and ps is not None else None,
                "wake_up_attempts": cur["wake_up"]["attempts"],
                "wake_up_success_rate_percent": cur["wake_up"]["success_rate_percent"],
                "consistency_percent": cur["wake_up"]["consistency_percent"],
                "challenge_accuracy_percent": cur["challenges"]["accuracy_percent"],
                "challenge_completion_percent": cur["challenges"]["completion_percent"],
                "average_response_seconds": cur["challenges"]["average_response_seconds"],
                "last_activity": last.isoformat() if last else None,
                "at_risk": bool(reasons),
                "risk_reasons": reasons,
                "interventions": _interventions(reasons),
            }
        )

    def mean(field):
        return _avg([r[field] for r in rows if r[field] is not None], 1)

    user_map = {u.id: u for u in users}
    cur_sleep = [l for l in all_sleep if l.sleep_date >= rng.start_date]
    avg_sleep_minutes = _avg([l.duration_minutes for l in cur_sleep], 0)
    avg_goal = _avg(
        [p.daily_sleep_goal_minutes for p in profiles.values()], 0
    ) or 480
    sleep_trend = _sleep_trend_series(all_sleep, profiles, user_map, rng)
    average_habit_improvement = mean("habit_improvement")
    guidance = _wellness_guidance(
        wake_success_percent=mean("wake_up_success_rate_percent"),
        challenge_accuracy_percent=mean("challenge_accuracy_percent"),
        sleep_adherence_percent=_avg(sleep_adherence_values, 1),
        average_sleep_minutes=avg_sleep_minutes,
        sleep_goal_minutes=int(avg_goal),
        habit_improvement=average_habit_improvement,
    )

    return {
        "range": {"start": rng.start_date.isoformat(), "end": rng.end_date.isoformat(),
                  "days": rng.days, "target_window_minutes": window},
        "overview": {
            "users_monitored": len(rows),
            "average_habit_score": mean("habit_score"),
            "overall_consistency_percent": mean("consistency_percent"),
            "average_wake_up_success_percent": mean("wake_up_success_rate_percent"),
            "average_challenge_accuracy_percent": mean("challenge_accuracy_percent"),
            "average_challenge_completion_percent": mean("challenge_completion_percent"),
            "average_response_seconds": mean("average_response_seconds"),
            "average_habit_improvement": average_habit_improvement,
            "at_risk_count": sum(1 for r in rows if r["at_risk"]),
        },
        "users": rows,
        "at_risk": [r for r in rows if r["at_risk"]],
        "sleep": (
            {
                "available": True,
                "users_with_sleep_logs": len(sleep_adherence_values),
                "average_adherence_percent": _avg(sleep_adherence_values, 1),
                "average_duration_minutes": avg_sleep_minutes,
            }
            if sleep_adherence_values
            else NO_SLEEP_DATA
        ),
        "sleep_trend": sleep_trend,
        "guidance": guidance,
        "habit_adherence_note": (
            "Routine consistency uses wake-up timing against each user's "
            "alarm time. Sleep adherence and snooze reduction are included "
            "for users who have recorded sleep logs or alarm events."
        ),
    }


# ---------------------------------------------------------------------
# Admin analytics
# ---------------------------------------------------------------------

def _count_by_day(items, rng: DateRange, getter) -> list[dict]:
    counts = Counter()
    for item in items:
        dt = _utc(getter(item))
        if dt and rng.start <= dt < rng.end:
            counts[dt.date().isoformat()] += 1
    return [
        {"date": (rng.start_date + timedelta(days=i)).isoformat(),
         "count": counts.get((rng.start_date + timedelta(days=i)).isoformat(), 0)}
        for i in range(rng.days)
    ]


def admin_analytics(
    db: Session,
    rng: DateRange,
    request_snapshot: dict,
    window: int = DEFAULT_TARGET_WINDOW_MINUTES,
) -> dict:
    users = list(db.execute(select(User)).scalars())
    alarms = list(db.execute(select(Alarm)).scalars())
    alarm_map = {a.id: a for a in alarms}
    user_map = {u.id: u for u in users}
    all_ids = list(user_map)

    verifs = _load_verifications(db, all_ids, rng)
    attempts = _load_attempts(db, all_ids, rng)
    naive_start = rng.naive[0]
    cur_v = [v for v in verifs if _utc(v.created_at) >= rng.start]
    cur_a = [r for r in attempts if r[0].created_at >= naive_start]
    active_ids = {v.user_id for v in cur_v} | {r[0].user_id for r in cur_a}

    roles = Counter(u.role for u in users)
    new_users = [u for u in users if rng.start <= _utc(u.created_at) < rng.end]
    created_alarms = [a for a in alarms if a.created_at and rng.start <= _utc(a.created_at) < rng.end]

    wake_ok = sum(1 for v in cur_v if v.successful)
    methods = Counter(v.verification_method for v in cur_v)
    dismissals = sum(1 for v in cur_v if v.successful and v.alarm_id)

    all_events = tm.load_alarm_events(db, all_ids, rng.prev_start, rng.end)
    all_sleep = tm.load_sleep_logs(
        db, all_ids, rng.prev_start.date(), rng.end_date
    )
    profiles = {p.user_id: p for p in db.execute(select(UserProfile)).scalars()}
    cur_events_all = [e for e in all_events if _utc(e.created_at) >= rng.start]
    prev_events_all = [e for e in all_events if _utc(e.created_at) < rng.start]
    rec_events = tm.load_recommendation_events(
        db, all_ids, rng.prev_start, rng.end
    )
    sleep_adherence_values: list[float] = []

    def extras_for(uid, user, events, sleep_logs):
        profile = profiles.get(uid)
        return {
            "snooze_reduction": tm.snooze_reduction_component(events),
            "sleep_schedule_adherence": tm.sleep_adherence_component(
                sleep_logs,
                profile.daily_sleep_goal_minutes if profile else 480,
                profile.sleep_target if profile else None,
                _tz(user.timezone),
            ),
        }

    # Habit scores for users with activity in the period (capped).
    habit_scores = []
    deltas = []
    for uid in sorted(active_ids)[:500]:
        user = user_map.get(uid)
        if user is None:
            continue
        tz = _tz(user.timezone)
        ua = {a.id: a for a in alarms if a.user_id == uid}
        uv = [v for v in verifs if v.user_id == uid]
        ut = [r for r in attempts if r[0].user_id == uid]
        ue = [e for e in all_events if e.user_id == uid]
        us = [l for l in all_sleep if l.user_id == uid]
        cur_extras = extras_for(
            uid, user,
            [e for e in ue if _utc(e.created_at) >= rng.start],
            [l for l in us if l.sleep_date >= rng.start_date],
        )
        if cur_extras["sleep_schedule_adherence"] is not None:
            sleep_adherence_values.append(cur_extras["sleep_schedule_adherence"])
        cur = _period([v for v in uv if _utc(v.created_at) >= rng.start],
                      [r for r in ut if r[0].created_at >= naive_start],
                      ua, tz, window, cur_extras)
        prev = _period([v for v in uv if _utc(v.created_at) < rng.start],
                       [r for r in ut if r[0].created_at < naive_start],
                       ua, tz, window,
                       extras_for(
                           uid, user,
                           [e for e in ue if _utc(e.created_at) < rng.start],
                           [l for l in us if l.sleep_date < rng.start_date],
                       ))
        if cur["habit"]["score"] is not None:
            habit_scores.append(cur["habit"]["score"])
            if prev["habit"]["score"] is not None:
                deltas.append(cur["habit"]["score"] - prev["habit"]["score"])

    buckets = {"0-39": 0, "40-59": 0, "60-79": 0, "80-100": 0}
    for s in habit_scores:
        key = "0-39" if s < 40 else "40-59" if s < 60 else "60-79" if s < 80 else "80-100"
        buckets[key] += 1

    challenge_stats = _challenge_stats(cur_a)
    daily = _daily_series(cur_v, cur_a, rng, timezone.utc)

    cur_sleep = [l for l in all_sleep if l.sleep_date >= rng.start_date]
    avg_sleep_minutes = _avg([l.duration_minutes for l in cur_sleep], 0)
    avg_goal = _avg(
        [p.daily_sleep_goal_minutes for p in profiles.values()], 0
    ) or 480
    sleep_trend = _sleep_trend_series(all_sleep, profiles, user_map, rng)
    average_improvement = _avg(deltas, 1)
    guidance = _wellness_guidance(
        wake_success_percent=_pct(wake_ok, len(cur_v)),
        challenge_accuracy_percent=challenge_stats["accuracy_percent"],
        sleep_adherence_percent=_avg(sleep_adherence_values, 1),
        average_sleep_minutes=avg_sleep_minutes,
        sleep_goal_minutes=int(avg_goal),
        habit_improvement=average_improvement,
    )
    management = [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in sorted(users, key=lambda u: u.full_name.lower())
    ][:500]

    return {
        "range": {"start": rng.start_date.isoformat(), "end": rng.end_date.isoformat(), "days": rng.days},
        "platform": {
            "total_users": len(users),
            "active_users_in_period": len(active_ids),
            "enabled_accounts": sum(1 for u in users if u.is_active),
            "total_alarms": len(alarms),
            "enabled_alarms": sum(1 for a in alarms if a.enabled),
        },
        "users": {
            "registrations_in_period": len(new_users),
            "registration_trend": _count_by_day(users, rng, lambda u: u.created_at),
            "role_distribution": [{"role": r, "count": c} for r, c in roles.most_common()],
            "active_vs_inactive": [
                {"status": "Active", "count": sum(1 for u in users if u.is_active)},
                {"status": "Deactivated", "count": sum(1 for u in users if not u.is_active)},
            ],
        },
        "alarms": {
            "created_in_period": len(created_alarms),
            "creation_trend": _count_by_day(alarms, rng, lambda a: a.created_at),
            "enabled": sum(1 for a in alarms if a.enabled),
            "disabled": sum(1 for a in alarms if not a.enabled),
            "by_challenge_type": [{"name": k, "count": v} for k, v in Counter(a.challenge_type for a in alarms).most_common()],
            "successful_dismissals": dismissals,
            "snooze": tm.snooze_summary(cur_events_all, prev_events_all)
            or NO_SNOOZE_DATA,
        },
        "wake_up": {
            "attempts": len(cur_v),
            "successful": wake_ok,
            "verification_success_rate_percent": _pct(wake_ok, len(cur_v)),
            "average_response_seconds": _avg([v.response_time for v in cur_v if v.response_time is not None]),
            "average_attempt_number": _avg([v.attempt_number for v in cur_v if v.attempt_number is not None]),
            "by_method": [{"name": k, "count": v} for k, v in methods.most_common()],
            "daily": [{"date": d["date"], "attempts": d["wake_attempts"],
                       "successful": d["wake_successful"],
                       "success_rate_percent": d["wake_success_rate_percent"]} for d in daily],
        },
        "challenges": {
            **{k: v for k, v in challenge_stats.items()},
            "daily": [{"date": d["date"], "attempts": d["challenge_attempts"],
                       "accuracy_percent": d["challenge_accuracy_percent"],
                       "average_response_seconds": d["average_response_seconds"]} for d in daily],
        },
        "habit": {
            "users_scored": len(habit_scores),
            "average_habit_score": _avg(habit_scores, 1),
            "average_improvement": _avg(deltas, 1),
            "distribution": [{"band": k, "count": v} for k, v in buckets.items()],
            "partial_note": (
                "Each score uses only the components that have recorded "
                "data (wake-up consistency, challenge completion, snooze "
                "reduction, sleep adherence); weights are rescaled."
            ),
            "adherence_trend": (
                {
                    "available": True,
                    "users_with_sleep_logs": len(sleep_adherence_values),
                    "average_adherence_percent": _avg(sleep_adherence_values, 1),
                }
                if sleep_adherence_values
                else NO_SLEEP_DATA
            ),
        },
        "recommendations": tm.engagement_summary(
            [e for e in rec_events if _utc(e.created_at) >= rng.start],
            [e for e in rec_events if _utc(e.created_at) < rng.start],
        ) or NO_RECOMMENDATION_ENGAGEMENT,
        "sleep": (
            {
                "available": True,
                "users_with_sleep_logs": len(sleep_adherence_values),
                "average_adherence_percent": _avg(sleep_adherence_values, 1),
                "average_duration_minutes": avg_sleep_minutes,
            }
            if sleep_adherence_values
            else NO_SLEEP_DATA
        ),
        "sleep_trend": sleep_trend,
        "guidance": guidance,
        "management": management,
        "system": request_snapshot,
    }
