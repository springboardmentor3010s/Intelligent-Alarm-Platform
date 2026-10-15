from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, UserProfile, Alarm, CoachNote
from app.schemas.schemas import CoachNoteCreate, CoachNoteOut
from app.core.security import require_role, get_current_user
from app.services.habit_scoring import calculate_habit_score
from typing import List

router = APIRouter(prefix="/coach", tags=["Coach"])

_coach_or_admin = require_role("WELLNESS_COACH", "ADMINISTRATOR")


@router.get("/users")
def get_managed_users(db: Session = Depends(get_db), _=Depends(_coach_or_admin)):
    """Return all USER-role accounts with their habit and alarm summary."""
    users = db.query(User).filter(User.role == "USER").order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        habits = []
        if profile and profile.habit_preferences:
            habits = [h.strip() for h in profile.habit_preferences.split(",") if h.strip()]
        active_alarms = db.query(Alarm).filter(Alarm.user_id == u.id, Alarm.enabled == True).count()
        habit_score_data = calculate_habit_score(db, u.id, days=7)
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "habit_count": len(habits),
            "habits": habits,
            "active_alarms": active_alarms,
            "wake_up_time": profile.preferred_wake_up_time if profile else "—",
            "productivity_goal": profile.productivity_goal if profile else "",
            "habit_score": habit_score_data["habit_score"],
            "habit_score_insufficient": habit_score_data.get("insufficient_data", True),
        })
    return result


@router.get("/summary")
def coach_summary(db: Session = Depends(get_db), _=Depends(_coach_or_admin)):
    """Aggregate summary for the coach dashboard."""
    users = db.query(User).filter(User.role == "USER").all()
    total = len(users)
    with_habits = 0
    with_alarms = 0
    for u in users:
        profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        if profile and profile.habit_preferences:
            with_habits += 1
        if db.query(Alarm).filter(Alarm.user_id == u.id, Alarm.enabled == True).count() > 0:
            with_alarms += 1
    return {
        "total_users": total,
        "users_with_habits": with_habits,
        "users_with_active_alarms": with_alarms,
        "users_needing_attention": total - with_habits,
    }


@router.post("/notes", response_model=CoachNoteOut, status_code=201)
def save_note(
    data: CoachNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(_coach_or_admin),
):
    note = CoachNote(coach_id=current_user.id, message=data.message.strip(), target_user_id=data.target_user_id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/notes", response_model=List[CoachNoteOut])
def get_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(_coach_or_admin),
):
    """Return all notes saved by this coach."""
    return (
        db.query(CoachNote)
        .filter(CoachNote.coach_id == current_user.id)
        .order_by(CoachNote.created_at.desc())
        .all()
    )


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(_coach_or_admin),
):
    note = db.query(CoachNote).filter(CoachNote.id == note_id, CoachNote.coach_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()


@router.get("/my-messages", response_model=List[CoachNoteOut])
def my_coach_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return coach notes addressed to the current user."""
    return (
        db.query(CoachNote)
        .filter(CoachNote.target_user_id == current_user.id)
        .order_by(CoachNote.created_at.desc())
        .limit(20)
        .all()
    )


@router.get("/users/{user_id}/progress")
def user_progress(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(_coach_or_admin),
):
    """Full progress snapshot for a single managed user."""
    from app.models.models import CognitiveChallenge, WakeUpSession
    from app.services.behavioral_analytics import calculate_behavioral_summary

    target = db.query(User).filter(User.id == user_id, User.role == "USER").first()
    if not target:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    habit = calculate_habit_score(db, user_id, days=7)

    challenges = db.query(CognitiveChallenge).filter(
        CognitiveChallenge.user_id == user_id
    ).all()
    total_c = len(challenges)
    correct_c = sum(1 for c in challenges if c.is_correct is True)
    success_rate = round(correct_c / total_c * 100, 1) if total_c else 0.0

    sessions = db.query(WakeUpSession).filter(WakeUpSession.user_id == user_id).all()
    total_s = len(sessions)
    verified_s = sum(1 for s in sessions if s.status == "WAKE_UP_VERIFIED")

    behavioral = calculate_behavioral_summary(db, user_id, days=7)

    return {
        "user_id": user_id,
        "name": target.name,
        "habit_score": habit["habit_score"],
        "habit_components": {
            k: {"score": v["score"], "label": v["label"]}
            for k, v in habit["components"].items()
        },
        "total_challenges": total_c,
        "correct_challenges": correct_c,
        "challenge_success_rate": success_rate,
        "total_sessions": total_s,
        "verified_sessions": verified_s,
        "wakeup_consistency": behavioral["wakeup_consistency"]["score"],
        "snooze_reduction": behavioral["snooze_reduction"]["score"],
        "sleep_adherence": behavioral["sleep_adherence"]["score"],
    }
