from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.database.models import (
    Alarm,
    AlarmSession,
    CognitiveChallenge,
    Habit,
    User,
    UserProfile,
)
from app.services.habit_scorer import evaluate_user_habit

MAX_VALID_RESPONSE_TIME_SECONDS = 300.0  # Cognitive challenges timeout within 30-300s


def format_ist_timestamp(dt: Optional[datetime] = None) -> str:
    """Formats a datetime in Indian Standard Time (Asia/Kolkata)."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    try:
        ist_dt = dt.astimezone(ZoneInfo("Asia/Kolkata"))
    except Exception:
        ist_dt = dt.astimezone(timezone(timedelta(hours=5, minutes=30), name="IST"))

    return ist_dt.strftime("%d %b %Y, %I:%M:%S %p IST")


def calculate_session_response_time(session: AlarmSession) -> Optional[float]:
    """
    Safely calculates the response time in seconds for an AlarmSession.
    Uses authoritative timestamps (completed_at - started_at) if available,
    otherwise falls back to session.response_time_seconds.
    Guarantees UTC-aware datetime arithmetic without naive-vs-aware errors.
    """
    if session.started_at and session.completed_at:
        start = (
            session.started_at
            if session.started_at.tzinfo
            else session.started_at.replace(tzinfo=timezone.utc)
        )
        comp = (
            session.completed_at
            if session.completed_at.tzinfo
            else session.completed_at.replace(tzinfo=timezone.utc)
        )
        elapsed = (comp - start).total_seconds()
        if elapsed >= 0:
            return round(elapsed, 1)

    if session.response_time_seconds is not None and session.response_time_seconds >= 0:
        return float(session.response_time_seconds)

    return None


def format_time_12hr(time_obj: Any) -> str:
    """Formats a time object to 12-hour AM/PM string."""
    if not time_obj:
        return "Not available"
    try:
        hour = time_obj.hour
        minute = time_obj.minute
        period = "AM" if hour < 12 else "PM"
        hour_12 = hour % 12 or 12
        return f"{hour_12:02d}:{minute:02d} {period}"
    except Exception:
        return str(time_obj)


def get_user_report_data(user: User, db: Session) -> Dict[str, Any]:
    """
    Aggregates comprehensive, user-isolated report metrics for the authenticated user.
    Strictly isolated to user.id. Never leaks passwords, hashes, or raw challenge secrets.
    """
    # 1. Alarms strictly owned by user
    alarms = db.query(Alarm).filter(Alarm.user_id == user.id).all()
    alarm_ids = [a.id for a in alarms]

    # 2. Sessions strictly belonging to user's alarms
    sessions: List[AlarmSession] = []
    if alarm_ids:
        sessions = (
            db.query(AlarmSession)
            .filter(AlarmSession.alarm_id.in_(alarm_ids))
            .order_by(AlarmSession.started_at.asc())
            .all()
        )

    # 3. User Profile
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == user.id)
        .first()
    )

    # 4. User Habit Goals
    habit = (
        db.query(Habit)
        .filter(Habit.user_id == user.id)
        .first()
    )

    # 5. Milestone 3 Official Habit Score (Single Source of Truth)
    habit_metrics = evaluate_user_habit(
        sessions=sessions,
        user_profile=profile,
        alarms=alarms,
    )

    habit_report = {
        "overall_habit_score": habit_metrics["overall_habit_score"],
        "wake_up_consistency": habit_metrics["wake_up_consistency"],
        "challenge_completion": habit_metrics["challenge_completion"],
        "snooze_reduction": habit_metrics["snooze_reduction"],
        "sleep_schedule_adherence": habit_metrics["sleep_schedule_adherence"],
        "sessions_evaluated": habit_metrics.get("total_sessions", len(sessions)),
        "average_snooze_count": habit_metrics.get("avg_snooze_count", 0.0),
    }

    # 6. Wake-Up Performance Report
    total_sessions = len(sessions)
    valid_response_times = []
    for s in sessions:
        if s.session_status in ("completed", "expired") or s.completed_at is not None:
            r = calculate_session_response_time(s)
            if r is not None and 0.0 <= r <= MAX_VALID_RESPONSE_TIME_SECONDS:
                valid_response_times.append(r)

    avg_response_time = (
        round(sum(valid_response_times) / len(valid_response_times), 1)
        if valid_response_times
        else 0.0
    )

    successful_dismissals = sum(
        1
        for s in sessions
        if (s.dismissal_status == "dismissed" or s.session_status == "completed")
    )
    total_snoozes = sum(s.snooze_count or 0 for s in sessions)

    status_counts = defaultdict(int)
    for s in sessions:
        status_key = s.session_status or "unknown"
        status_counts[status_key] += 1

    wake_up_report = {
        "total_sessions": total_sessions,
        "wake_up_consistency": habit_metrics["wake_up_consistency"],
        "average_response_time": avg_response_time,
        "successful_dismissals": successful_dismissals,
        "total_snoozes": total_snoozes,
        "status_breakdown": dict(status_counts),
    }

    # 7. Cognitive Challenge Performance Report
    challenge_sessions = [s for s in sessions if s.challenge_id is not None]
    challenge_ids = list(set(s.challenge_id for s in challenge_sessions))
    challenge_map = {}
    if challenge_ids:
        challenges = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.id.in_(challenge_ids))
            .all()
        )
        challenge_map = {c.id: c for c in challenges}

    total_challenges = len(challenge_sessions)
    completed_challenges = sum(
        1 for s in challenge_sessions if s.session_status == "completed"
    )
    correct_answers = sum(
        1 for s in challenge_sessions if s.is_correct is True
    )
    incorrect_answers = sum(
        1 for s in challenge_sessions if s.is_correct is False
    )
    completion_pct = (
        round((completed_challenges / total_challenges) * 100, 1)
        if total_challenges > 0
        else 0.0
    )
    accuracy_pct = (
        round((correct_answers / total_challenges) * 100, 1)
        if total_challenges > 0
        else 0.0
    )

    type_aggregates = defaultdict(lambda: {"total": 0, "correct": 0, "incorrect": 0})
    diff_aggregates = defaultdict(lambda: {"total": 0, "correct": 0, "incorrect": 0})

    for s in challenge_sessions:
        c_obj = challenge_map.get(s.challenge_id)
        c_type = getattr(c_obj, "challenge_type", "math") if c_obj else "math"
        c_diff = getattr(c_obj, "difficulty", "medium") if c_obj else "medium"

        type_aggregates[c_type]["total"] += 1
        diff_aggregates[c_diff]["total"] += 1

        if s.is_correct is True:
            type_aggregates[c_type]["correct"] += 1
            diff_aggregates[c_diff]["correct"] += 1
        elif s.is_correct is False:
            type_aggregates[c_type]["incorrect"] += 1
            diff_aggregates[c_diff]["incorrect"] += 1

    challenge_types_list = []
    for c_type, vals in sorted(type_aggregates.items()):
        acc = (
            round((vals["correct"] / vals["total"]) * 100, 1)
            if vals["total"] > 0
            else 0.0
        )
        challenge_types_list.append({
            "challenge_type": c_type.capitalize(),
            "total": vals["total"],
            "correct": vals["correct"],
            "incorrect": vals["incorrect"],
            "accuracy": acc,
        })

    difficulty_levels_list = []
    for c_diff, vals in sorted(diff_aggregates.items()):
        acc = (
            round((vals["correct"] / vals["total"]) * 100, 1)
            if vals["total"] > 0
            else 0.0
        )
        difficulty_levels_list.append({
            "difficulty": c_diff.capitalize(),
            "total": vals["total"],
            "correct": vals["correct"],
            "incorrect": vals["incorrect"],
            "accuracy": acc,
        })

    challenge_report = {
        "total_challenges": total_challenges,
        "completed_challenges": completed_challenges,
        "correct_answers": correct_answers,
        "incorrect_answers": incorrect_answers,
        "completion_percentage": completion_pct,
        "accuracy_percentage": accuracy_pct,
        "challenge_types": challenge_types_list,
        "difficulty_levels": difficulty_levels_list,
        "average_response_time": avg_response_time,
    }

    # 8. Sleep / Adherence Report
    preferred_wake = getattr(profile, "preferred_wake_time", None)
    sleep_dur = getattr(profile, "sleep_duration", None)
    has_profile = bool(profile and (preferred_wake or sleep_dur))

    preferred_wake_str = (
        format_time_12hr(preferred_wake)
        if preferred_wake
        else "Not available"
    )
    sleep_duration_str = (
        f"{sleep_dur} hours"
        if sleep_dur is not None
        else "Not available"
    )
    alignment_str = (
        f"Evaluated against target wake time ({preferred_wake_str})"
        if preferred_wake
        else "Not available (Set preferred wake-up time in Profile)"
    )

    sleep_report = {
        "preferred_wake_time": preferred_wake_str,
        "sleep_duration": sleep_duration_str,
        "sleep_schedule_adherence": habit_metrics["sleep_schedule_adherence"],
        "schedule_alignment": alignment_str,
        "has_profile_data": has_profile,
    }

    # 9. Productivity Report (Strictly Non-Fabricated)
    prod_goals = getattr(habit, "productivity_goals", None)
    has_prod = bool(prod_goals and str(prod_goals).strip())

    if has_prod:
        productivity_report = {
            "has_productivity_data": True,
            "productivity_goals": str(prod_goals).strip(),
            "status": "Configured",
            "message": f"User goals: {str(prod_goals).strip()}",
        }
    else:
        productivity_report = {
            "has_productivity_data": False,
            "productivity_goals": None,
            "status": "Not available",
            "message": "Productivity data is not available yet.",
        }

    return {
        "user_name": user.name or "User",
        "user_email": user.email,
        "generated_at": format_ist_timestamp(),
        "is_demo": False,
        "habit_report": habit_report,
        "wake_up_report": wake_up_report,
        "challenge_report": challenge_report,
        "sleep_adherence_report": sleep_report,
        "productivity_report": productivity_report,
    }


def get_demo_report_data() -> Dict[str, Any]:
    """
    Returns predefined read-only sample report data for Demo Mode.
    Never connects to PostgreSQL. Strictly marked as sample data.
    """
    return {
        "user_name": "Demo User",
        "user_email": "demo@cognitivealarm.com",
        "generated_at": format_ist_timestamp(),
        "is_demo": True,
        "habit_report": {
            "overall_habit_score": 82.5,
            "wake_up_consistency": 85.0,
            "challenge_completion": 90.0,
            "snooze_reduction": 80.0,
            "sleep_schedule_adherence": 75.0,
            "sessions_evaluated": 12,
            "average_snooze_count": 0.4,
        },
        "wake_up_report": {
            "total_sessions": 12,
            "wake_up_consistency": 85.0,
            "average_response_time": 17.4,
            "successful_dismissals": 10,
            "total_snoozes": 2,
            "status_breakdown": {
                "completed": 10,
                "expired": 1,
                "snoozed": 2,
            },
        },
        "challenge_report": {
            "total_challenges": 12,
            "completed_challenges": 10,
            "correct_answers": 9,
            "incorrect_answers": 1,
            "completion_percentage": 83.3,
            "accuracy_percentage": 75.0,
            "challenge_types": [
                {"challenge_type": "Math", "total": 4, "correct": 3, "incorrect": 1, "accuracy": 75.0},
                {"challenge_type": "Logic", "total": 3, "correct": 3, "incorrect": 0, "accuracy": 100.0},
                {"challenge_type": "Memory", "total": 2, "correct": 2, "incorrect": 0, "accuracy": 100.0},
                {"challenge_type": "Word", "total": 2, "correct": 1, "incorrect": 0, "accuracy": 100.0},
                {"challenge_type": "Pattern", "total": 1, "correct": 1, "incorrect": 0, "accuracy": 100.0},
            ],
            "difficulty_levels": [
                {"difficulty": "Medium", "total": 10, "correct": 8, "incorrect": 1, "accuracy": 80.0},
                {"difficulty": "Easy", "total": 2, "correct": 1, "incorrect": 0, "accuracy": 100.0},
            ],
            "average_response_time": 17.4,
        },
        "sleep_adherence_report": {
            "preferred_wake_time": "06:30 AM",
            "sleep_duration": "8 hours",
            "sleep_schedule_adherence": 75.0,
            "schedule_alignment": "Aligned within 15 mins of target (06:30 AM)",
            "has_profile_data": True,
        },
        "productivity_report": {
            "has_productivity_data": False,
            "productivity_goals": None,
            "status": "Not available",
            "message": "Productivity data is not available yet.",
        },
    }
