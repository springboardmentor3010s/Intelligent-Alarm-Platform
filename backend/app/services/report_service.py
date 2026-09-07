"""Report service for the dashboard report endpoints.

Builds the record sets for the habit/wake-up/challenge reports and returns
either the JSON envelope or a streaming CSV/PDF/Excel file via the low-level
`report_export` helpers.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from ..Models import Alarm, Challenge, ChallengeAttempt, HabitScore
from .report_export import export_report  # noqa: F401  (re-exported convenience)


def habits_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Habit scores for the last N days, most recent first."""
    today = datetime.utcnow().date()
    scores = []

    for i in range(days):
        target_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        habit_score = db.query(HabitScore).filter(
            HabitScore.user_id == user_id,
            HabitScore.date == target_date,
        ).first()

        if habit_score:
            scores.append({
                "date": habit_score.date,
                "wake_up_consistency": habit_score.wake_up_consistency,
                "challenge_completion": habit_score.challenge_completion,
                "snooze_reduction": habit_score.snooze_reduction,
                "sleep_schedule_adherence": habit_score.sleep_schedule_adherence,
                "overall_score": habit_score.overall_score,
            })

    return scores


def wake_up_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Alarm/wake-up records for the last N days."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=days)

    alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.created_at >= datetime.combine(week_ago, datetime.min.time()),
    ).all()

    records = []
    for a in alarms:
        records.append({
            "alarm_id": a.id,
            "title": a.title,
            "alarm_type": a.alarm_type,
            "next_trigger": a.next_trigger.isoformat() if a.next_trigger else None,
            "times_snoozed": a.times_snoozed,
            "was_enabled": a.is_enabled,
        })

    return records


def challenges_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Challenge attempt records for the last N days."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=days)

    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= datetime.combine(week_ago, datetime.min.time()),
    ).all()

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
            "created_at": a.created_at.isoformat() if a.created_at else None,
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
            "generated_at": datetime.utcnow().isoformat(),
        }

    return export_report(records, file_format, base_name, title)
