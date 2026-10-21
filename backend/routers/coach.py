from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from Models.alarm import Alarm
from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent
from Models.coach import CoachAssignment, CoachGuidance
from Models.habit import Habit
from Models.user import User, UserProfile

router = APIRouter(prefix="/coach", tags=["Wellness Coach"])


class GuidanceRequest(BaseModel):
    message: str


def assigned_client_or_404(coach_id: int, user_id: int, db: Session) -> User:
    assignment = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == user_id,
    ).first()
    client = db.query(User).filter(User.id == user_id, User.role == "user").first()
    if not assignment or not client:
        raise HTTPException(status_code=404, detail="Assigned user not found")
    return client

def client_summary(client: User, db: Session):
    profile = db.query(UserProfile).filter(UserProfile.user_id == client.id).first()
    habits_total = db.query(Habit).filter(Habit.user_id == client.id).count()
    habits_completed = db.query(Habit).filter(Habit.user_id == client.id, Habit.completed.is_(True)).count()
    active_alarms = db.query(Alarm).filter(Alarm.user_id == client.id, Alarm.is_active.is_(True)).count()
    challenges_total = db.query(Challenge).filter(Challenge.user_id == client.id).count()
    challenges_completed = db.query(Challenge).filter(
        Challenge.user_id == client.id, Challenge.status == "completed"
    ).count()
    correct_attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == client.id, ChallengeAttempt.is_correct.is_(True)
    ).count()
    attempts_total = db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == client.id).count()

    # Recent activity
    recent_attempts = db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == client.id).order_by(ChallengeAttempt.id.desc()).limit(5).all()
    recent_activity = [
        {
            "id": a.id,
            "challenge_id": a.challenge_id,
            "is_correct": a.is_correct,
            "time_taken_seconds": a.solve_time,
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in recent_attempts
    ]

    # Verification stats
    verifications = db.query(WakeUpEvent).filter(WakeUpEvent.user_id == client.id).all()
    verification_stats = {
        "total": len(verifications),
        "verified": len([v for v in verifications if v.verification_status == "verified"]),
        "failed": len([v for v in verifications if v.verification_status == "failed" or v.status == "snoozed"]),
    }

    # Recent verifications
    recent_verifications_query = db.query(WakeUpEvent).filter(WakeUpEvent.user_id == client.id).order_by(WakeUpEvent.id.desc()).limit(5).all()
    recent_verifications = [
        {
            "id": v.id,
            "status": v.status,
            "verification_status": v.verification_status,
            "started_at": v.started_at.isoformat() if v.started_at else None
        } for v in recent_verifications_query
    ]

    return {
        "id": client.id,
        "name": client.name,
        "email": client.email,
        "preferred_wakeup_time": profile.preferred_wakeup_time if profile else None,
        "sleep_duration": profile.sleep_duration if profile else None,
        "habit_progress": {"completed": habits_completed, "total": habits_total},
        "active_alarms": active_alarms,
        "challenge_progress": {"completed": challenges_completed, "total": challenges_total},
        "cognitive_accuracy": round(correct_attempts * 100 / attempts_total) if attempts_total else 0,
        "recent_activity": recent_activity,
        "verification_stats": verification_stats,
        "recent_verifications": recent_verifications
    }


@router.get("/clients")
def get_assigned_clients(current_user: dict = Depends(require_role("wellness_coach")), db: Session = Depends(get_db)):
    coach_id = current_user["user_id"]
    assignments = db.query(CoachAssignment).filter(CoachAssignment.coach_id == coach_id).all()
    clients = []
    for assignment in assignments:
        client = db.query(User).filter(User.id == assignment.user_id, User.role == "user").first()
        if client:
            clients.append(client_summary(client, db))
    return clients


@router.get("/clients/{user_id}")
def get_client_detail(user_id: int, current_user: dict = Depends(require_role("wellness_coach")), db: Session = Depends(get_db)):
    client = assigned_client_or_404(current_user["user_id"], user_id, db)
    result = client_summary(client, db)
    result["guidance"] = [
        {"id": item.id, "message": item.message, "created_at": item.created_at.isoformat() if item.created_at else None}
        for item in db.query(CoachGuidance).filter(CoachGuidance.user_id == client.id).order_by(CoachGuidance.id.desc()).all()
    ]
    return result


@router.post("/clients/{user_id}/guidance")
def add_guidance(user_id: int, data: GuidanceRequest, current_user: dict = Depends(require_role("wellness_coach")), db: Session = Depends(get_db)):
    assigned_client_or_404(current_user["user_id"], user_id, db)
    message = data.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Guidance message cannot be empty")
    guidance = CoachGuidance(coach_id=current_user["user_id"], user_id=user_id, message=message)
    db.add(guidance)
    db.commit()
    db.refresh(guidance)
    return {"id": guidance.id, "message": guidance.message, "created_at": guidance.created_at.isoformat() if guidance.created_at else None}


@router.get("/my-guidance")
def get_my_guidance(current_user: dict = Depends(require_role("user")), db: Session = Depends(get_db)):
    return [
        {"id": item.id, "message": item.message, "created_at": item.created_at.isoformat() if item.created_at else None}
        for item in db.query(CoachGuidance).filter(CoachGuidance.user_id == current_user["user_id"]).order_by(CoachGuidance.id.desc()).all()
    ]
