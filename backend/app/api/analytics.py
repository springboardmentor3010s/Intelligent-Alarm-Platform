"""Analytics routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..Models import User, Alarm, Challenge, ChallengeAttempt
from ..api.deps import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/me", response_model=dict)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's analytics summary (challenge analytics are real; sleep remains M3)."""
    user_id = current_user.id
    now = datetime.now(timezone.utc)

    # Get total alarms
    total_alarms = db.query(Alarm).filter(Alarm.user_id == user_id).count() or 0

    # Get total dismissals (fully-completed challenge attempts = gate passed)
    completed_attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.completed == True,
    ).all()
    total_dismissals = len(completed_attempts)

    # Average snooze count
    avg_snooze = db.query(func.avg(Alarm.times_snoozed)).filter(
        Alarm.user_id == user_id,
    ).scalar() or 0.0

    # Challenge analytics from real attempt data
    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
    ).all()

    total_q = sum(a.total_questions for a in attempts) or 1
    correct_t = sum(a.correct_answers for a in attempts) or 0
    challenge_accuracy = correct_t / total_q if total_q > 0 else 0.0

    # Per-type breakdown
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
    challenge_accuracy_by_type = {}
    for ctype, count, avg_correct, avg_total, avg_time in type_rows:
        avg_correct = avg_correct or 0
        avg_total = avg_total or 0
        challenge_accuracy_by_type[ctype] = {
            "attempts": int(count or 0),
            "accuracy": float(avg_correct / avg_total) if avg_total else 0.0,
            "avg_solve_time_seconds": round(float(avg_time or 0), 1),
        }

    # Real days with an alarm in the last 7 days (distinct trigger dates)
    recent_cutoff = now - timedelta(days=7)
    alarm_days = (
        db.query(func.date(Alarm.next_trigger))
        .filter(Alarm.user_id == user_id, Alarm.next_trigger >= recent_cutoff)
        .distinct()
        .count()
        or 0
    )
    dismissals_7d = (
        db.query(ChallengeAttempt).filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.completed == True,
            ChallengeAttempt.created_at >= recent_cutoff,
        ).count()
        or 0
    )

    # Sleep duration avg — placeholder pending Milestone 3 (real sleep analytics engine)
    sleep_duration_avg = 7.5

    recent_activity = {
        "days_with_alarm": alarm_days,
        "successful_dismissals": dismissals_7d,
        "challenge_accuracy_by_type": challenge_accuracy_by_type,
        "total_attempts": len(attempts),
        "completed_attempts": total_dismissals,
    }

    return {
        "user_id": user_id,
        "total_alarms": total_alarms,
        "total_dismissals": total_dismissals,
        "average_snooze_count": float(avg_snooze) if avg_snooze else 0.0,
        "wake_up_consistency_trend": "stable",
        "challenge_accuracy": round(challenge_accuracy, 4),
        "sleep_duration_avg": sleep_duration_avg,
        "recent_activity": recent_activity,
    }


@router.get("/ml-status")
def get_ml_status(
    current_user: User = Depends(get_current_user),
):
    """Get ML model status (for diagnostics)."""
    from ..services.ml_inference import MLInferenceService
    return MLInferenceService.get_model_status()