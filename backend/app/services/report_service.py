# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Report service for the dashboard report endpoints.

Single-source rule (Phase 5): record builders reuse the same services the
dashboards read, so API, web, mobile, and exports always agree:

- habit rows come from `habit_scoring_service.get_habit_score_history` (the
  exact source behind `/habits/score/history`); gap days with no stored score
  are omitted from exports while dashboards render them honestly as gaps.
- wake-up rows come from the user's real `alarms` table ordered by trigger.
- challenge rows come from the user's real `challenge_attempts` table.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from ..Models import Alarm, Challenge, ChallengeAttempt
from .habit_scoring_service import get_habit_score_history
from .report_export import export_report  # noqa: F401  (re-exported convenience)


def productivity_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """User-entered productivity rows (same source as the tracking API).

    Empty when the user never logged — exports stay honest for new accounts.
    """
    from .productivity_service import productivity_report_records as _builder

    return _builder(db, user_id, days)

MIN_REPORT_DAYS = 1
MAX_REPORT_DAYS = 365


def _clamp_days(days: int) -> int:
    try:
        value = int(days)
    except (TypeError, ValueError):
        value = 7
    return max(MIN_REPORT_DAYS, min(MAX_REPORT_DAYS, value))


def _aware_iso(value) -> str | None:
    """Serialize a stored datetime as UTC-aware ISO (SQLite returns naive)."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def habits_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Recorded habit scores for the last N days, most recent first.

    Built from the same history the dashboards plot, minus the honest gap
    placeholders (exports contain only days with a real stored score).
    """
    history = get_habit_score_history(db, user_id, days=_clamp_days(days))
    return [
        {
            "date": entry["date"],
            "wake_up_consistency": entry["wake_up_consistency"],
            "challenge_completion": entry["challenge_completion"],
            "snooze_reduction": entry["snooze_reduction"],
            "sleep_schedule_adherence": entry["sleep_schedule_adherence"],
            "overall_score": entry["overall_score"],
        }
        for entry in history
        if entry.get("overall_score") is not None
    ]


def wake_up_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Alarm/wake-up records for the last N days, oldest trigger first.

    Filtered on the timezone-aware `next_trigger` window (the same trigger the
    dashboards and habit scoring read), not on row creation time.
    """
    days = _clamp_days(days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger.isnot(None),
        Alarm.next_trigger >= cutoff,
    ).order_by(Alarm.next_trigger.asc()).all()

    records = []
    for a in alarms:
        records.append({
            "alarm_id": a.id,
            "title": a.title,
            "alarm_type": a.alarm_type,
            "next_trigger": _aware_iso(a.next_trigger),
            "times_snoozed": a.times_snoozed,
            "was_enabled": a.is_enabled,
        })

    return records


def challenges_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Challenge attempt records for the last N days, oldest attempt first."""
    days = _clamp_days(days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= cutoff,
    ).order_by(ChallengeAttempt.created_at.asc()).all()

    records = []
    for a in attempts:
        challenge = db.query(Challenge).filter(Challenge.id == a.challenge_id).first()
        records.append({
            "attempt_id": a.id,
            "challenge_type": challenge.challenge_type if challenge else "Unknown",
            "difficulty": challenge.difficulty if challenge else "Unknown",
            "completed": a.completed,
            "correct_answers": a.correct_answers,
            "total_questions": a.total_questions,
            "accuracy_pct": round((a.correct_answers / a.total_questions * 100) if a.total_questions > 0 else 0, 1),
            "time_taken_seconds": a.time_taken_seconds,
            "created_at": _aware_iso(a.created_at),
        })

    return records


def report_response(
    records: List[Dict[str, Any]],
    file_format: str,
    base_name: str,
    title: str,
    report_type: str,
    days: int,
):
    """Return the JSON envelope or a streaming CSV/PDF/Excel response."""
    if file_format == "json":
        return {
            "report_type": report_type,
            "days": days,
            "data": records,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return export_report(records, file_format, base_name, title)


def build_report(
    builder,
    db: Session,
    user_id: int,
    days: int,
    file_format: str,
    report_type: str,
    title: str,
):
    """Build records and produce the final report response for a given type.

    `asynchronous` handling is delegated to the route; this helper centralizes
    the record fetch + envelope/file assembly used by both sync and async paths.
    """
    records = builder(db, user_id, days)
    today = datetime.now(timezone.utc).date()
    base_name = f"{report_type}_report_{today}"
    return report_response(records, file_format, base_name, title, report_type, days)
