from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import date, timedelta

from database import get_db
from auth import get_current_user
from Models.analytics import BehaviorProfile, Recommendation, SleepLog
from Models.challenge import WakeUpEvent

router = APIRouter(prefix="/analytics", tags=["Analytics"])

class SnoozeRequest(BaseModel):
    event_id: int

@router.post("/snooze")
def record_snooze(
    req: SnoozeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("sub")
    event = db.query(WakeUpEvent).filter(
        WakeUpEvent.id == req.event_id, 
        WakeUpEvent.user_id == user_id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Wake-up event not found")

    event.snoozes = (event.snoozes or 0) + 1
    db.commit()
    return {"message": "Snooze recorded", "snoozes": event.snoozes}

@router.get("/dashboard")
def get_analytics_dashboard(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("sub")
    today = date.today()

    # Get today's profile
    current_profile = db.query(BehaviorProfile).filter(
        BehaviorProfile.user_id == user_id,
        BehaviorProfile.date == today
    ).first()

    # Fall back to user's most recent BehaviorProfile if today has no recorded profile yet
    if not current_profile:
        current_profile = db.query(BehaviorProfile).filter(
            BehaviorProfile.user_id == user_id
        ).order_by(BehaviorProfile.date.desc()).first()

    # Get last 30 days of profiles for charts (frontend supports 7, 15, and 30 day views)
    thirty_days_ago = today - timedelta(days=30)
    historical_profiles = db.query(BehaviorProfile).filter(
        BehaviorProfile.user_id == user_id,
        BehaviorProfile.date >= thirty_days_ago
    ).order_by(BehaviorProfile.date.asc()).all()

    # If no profiles in the last 30 calendar days, fall back to user's most recent 30 profiles
    if not historical_profiles:
        historical_profiles = db.query(BehaviorProfile).filter(
            BehaviorProfile.user_id == user_id
        ).order_by(BehaviorProfile.date.desc()).limit(30).all()
        historical_profiles.reverse()

    # Get recent wake-up events for stats and history (up to 30 to support 30-day views)
    recent_events = db.query(WakeUpEvent).filter(
        WakeUpEvent.user_id == user_id
    ).order_by(WakeUpEvent.started_at.desc()).limit(30).all()

    # Get real SleepLog records (up to 30 for sleep adherence metrics)
    sleep_logs = db.query(SleepLog).filter(
        SleepLog.user_id == user_id
    ).order_by(SleepLog.date.desc()).limit(30).all()

    # Get the behavior trend
    from services.analytics import analyze_behavior_trend, get_user_adaptive_difficulty
    behavior_trend = analyze_behavior_trend(user_id, db)
    user_diff = get_user_adaptive_difficulty(user_id, db)

    return {
        "current": current_profile,
        "history": historical_profiles,
        "events": recent_events,
        "sleep_logs": sleep_logs,
        "behavior_trend": behavior_trend,
        "current_difficulty": user_diff
    }

@router.get("/recommendations")
def get_recommendations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("sub")
    
    # Get current behavior profile (or latest)
    profile = db.query(BehaviorProfile).filter(
        BehaviorProfile.user_id == user_id,
        BehaviorProfile.date == date.today()
    ).first()

    if not profile:
        profile = db.query(BehaviorProfile).filter(
            BehaviorProfile.user_id == user_id
        ).order_by(BehaviorProfile.date.desc()).first()

    if not profile:
        profile = BehaviorProfile(user_id=user_id, date=date.today())

    from services.recommendation import build_user_recommendations
    return build_user_recommendations(user_id, profile, db)

@router.put("/recommendations/{rec_id}/read")
def mark_recommendation_read(
    rec_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")
    
    rec = db.query(Recommendation).filter(
        Recommendation.id == rec_id,
        Recommendation.user_id == user_id
    ).first()
    
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    rec.is_read = True
    db.commit()
    
    return {"message": "Recommendation marked as read"}

@router.get("/challenge-stats")
def get_challenge_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")
    
    from Models.challenge import ChallengeAttempt, Challenge
    from sqlalchemy import func, Integer
    
    # Base query for user's attempts
    user_attempts = db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == user_id)
    
    total_challenges = user_attempts.count()
    
    if total_challenges == 0:
        return {
            "total_challenges": 0,
            "success_rate": 0,
            "average_score": 0,
            "average_solve_time": 0,
            "type_stats": []
        }
        
    successful_challenges = user_attempts.filter(ChallengeAttempt.is_correct == True).count()
    success_rate = (successful_challenges / total_challenges) * 100
    
    avg_score = db.query(func.avg(ChallengeAttempt.score)).filter(ChallengeAttempt.user_id == user_id).scalar() or 0
    avg_solve = db.query(func.avg(ChallengeAttempt.solve_time)).filter(ChallengeAttempt.user_id == user_id).scalar() or 0
    
    # Challenge type statistics
    type_stats_query = db.query(
        Challenge.challenge_type,
        func.count(ChallengeAttempt.id).label("total"),
        func.sum(func.cast(ChallengeAttempt.is_correct, Integer)).label("correct")
    ).join(
        ChallengeAttempt, Challenge.id == ChallengeAttempt.challenge_id
    ).filter(
        ChallengeAttempt.user_id == user_id
    ).group_by(
        Challenge.challenge_type
    ).all()
    
    type_stats = []
    for type_name, total, correct in type_stats_query:
        type_stats.append({
            "subject": type_name,
            "success_rate": (correct / total * 100) if total > 0 else 0
        })
        
    return {
        "total_challenges": total_challenges,
        "success_rate": round(success_rate, 1),
        "average_score": round(avg_score, 1),
        "average_solve_time": round(avg_solve, 1),
        "type_stats": type_stats
    }
