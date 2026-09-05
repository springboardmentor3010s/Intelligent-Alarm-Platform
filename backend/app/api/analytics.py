"""Analytics routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..Models import User, Alarm, ChallengeAttempt, HabitScore
from ..api.deps import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/me", response_model=dict)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's analytics summary."""
    user_id = current_user.id
    
    # Get total alarms
    total_alarms = db.query(Alarm).filter(Alarm.user_id == user_id).count() or 0
    
    # Get total dismissals
    total_dismissals = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.completed == True,
    ).count() or 0
    
    # Average snooze count
    avg_snooze = db.query(func.avg(Alarm.times_snoozed)).filter(
        Alarm.user_id == user_id,
    ).scalar() or 0.0
    
    # Challenge accuracy (simplified)
    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
    ).all()
    
    total_q = sum(a.total_questions for a in attempts) or 1
    correct_t = sum(a.correct_answers for a in attempts) or 0
    challenge_accuracy = correct_t / total_q if total_q > 0 else 0.0
    
    # Sleep duration avg (simplified)
    sleep_duration_avg = 7.5  # default
    
    # Recent activity
    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    recent_activity = {
        "days_with_alarm": 5,
        "successful_dismissals": 3,
    }
    
    return {
        "user_id": user_id,
        "total_alarms": total_alarms,
        "total_dismissals": total_dismissals,
        "average_snooze_count": float(avg_snooze) if avg_snooze else 0.0,
        "wake_up_consistency_trend": "stable",
        "challenge_accuracy": challenge_accuracy,
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