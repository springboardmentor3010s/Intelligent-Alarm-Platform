from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from fastapi import Depends as _Depends
from app.core.security import user_scope
from app.db.database import get_db
from app.models.user import User
from app.models.alarm import Alarm
from app.models.challenge_attempt import ChallengeAttempt
from app.models.wake_up_verification import WakeUpVerification
from app.services.behavior_analytics import behavior_analytics_service
from app.services.habit_score import habit_score_service

router = APIRouter(
    prefix="/wellness",
    tags=["Wellness Coach"],
    dependencies=[_Depends(user_scope)],
)

@router.get("/dashboard/{user_id}")
def wellness_dashboard(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        behavior = behavior_analytics_service.get_user_behavior(db=db, user_id=user_id)
        habit = habit_score_service.calculate_habit_score(db=db, user_id=user_id)
    except Exception:
        behavior, habit = {}, {}
    total_alarms = db.scalar(select(func.count(Alarm.id)).where(Alarm.user_id == user_id)) or 0
    enabled_alarms = db.scalar(select(func.count(Alarm.id)).where(Alarm.user_id == user_id, Alarm.enabled.is_(True))) or 0
    verifications = db.execute(select(WakeUpVerification).where(
        WakeUpVerification.user_id == user_id).order_by(WakeUpVerification.created_at.desc()).limit(100)).scalars().all()
    successes = sum(1 for v in verifications if v.successful)
    avg_response = round(sum(v.response_time for v in verifications if v.response_time is not None) /
                         max(1, sum(1 for v in verifications if v.response_time is not None)), 2)
    attempts_count = db.scalar(select(func.count(ChallengeAttempt.id)).where(ChallengeAttempt.user_id == user_id)) or 0
    cognitive = (behavior.get("cognitive_behavior") or {})
    accuracy = cognitive.get("accuracy", 0)
    if isinstance(accuracy, (float, int)) and accuracy <= 1:
        accuracy *= 100
    recommendations = []
    if not enabled_alarms:
        recommendations.append({"title": "Set a consistent wake-up time", "detail": "Enable at least one alarm to start tracking a routine."})
    if verifications and successes / len(verifications) < 0.7:
        recommendations.append({"title": "Make your wake-up flow easier", "detail": "Try a consistent bedtime and keep your device within reach."})
    if avg_response and avg_response > 30:
        recommendations.append({"title": "Reduce morning friction", "detail": "Prepare essentials the night before and keep your first challenge short."})
    if not recommendations:
        recommendations.append({"title": "Keep your routine steady", "detail": "Maintain a consistent wake-up time and review your weekly trends."})
    return {
        "user_id": user_id,
        "habit_score": habit.get("habit_score", 0),
        "habit_components": habit.get("components", {}),
        "wake_up_consistency_percent": round(100 * successes / max(1, len(verifications)), 1),
        "verification_count": len(verifications),
        "successful_wakeups": successes,
        "average_response_seconds": avg_response,
        "challenge_attempts": attempts_count,
        "challenge_accuracy_percent": round(float(accuracy or 0), 1),
        "alarms_total": total_alarms,
        "alarms_enabled": enabled_alarms,
        "recommendations": recommendations,
        "disclaimer": "Wellness suggestions are general habit guidance, not medical advice."
    }

@router.get("/weekly-trends/{user_id}")
def weekly_trends(user_id: int, db: Session = Depends(get_db)):
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    since = datetime.now(timezone.utc) - timedelta(days=7)
    rows = db.execute(select(WakeUpVerification).where(
        WakeUpVerification.user_id == user_id,
        WakeUpVerification.created_at >= since).order_by(WakeUpVerification.created_at)).scalars().all()
    by_day = {}
    for row in rows:
        key = row.created_at.date().isoformat()
        by_day.setdefault(key, {"date": key, "attempts": 0, "successful": 0, "response_times": []})
        by_day[key]["attempts"] += 1
        by_day[key]["successful"] += int(row.successful)
        if row.response_time is not None:
            by_day[key]["response_times"].append(row.response_time)
    result = []
    for day in sorted(by_day):
        item = by_day[day]
        times = item.pop("response_times")
        item["average_response_seconds"] = round(sum(times) / len(times), 2) if times else None
        item["success_rate_percent"] = round(100 * item["successful"] / item["attempts"], 1)
        result.append(item)
    return {"user_id": user_id, "days": result}
