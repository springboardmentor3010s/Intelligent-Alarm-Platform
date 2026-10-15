from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, UserProfile
from app.schemas.schemas import ProfileUpdate
from app.core.security import get_current_user

router = APIRouter(prefix="/profile", tags=["Profile"])

@router.get("", response_model=dict)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "preferred_wake_up_time": profile.preferred_wake_up_time,
        "sleep_duration": profile.sleep_duration,
        "timezone": profile.timezone,
        "productivity_goal": profile.productivity_goal,
        "difficulty_preference": profile.difficulty_preference,
        "habit_preferences": profile.habit_preferences,
    }

@router.put("", response_model=dict)
def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    if data.name is not None:
        current_user.name = data.name
    if data.email is not None:
        existing = db.query(User).filter(User.email == data.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data.email
    if data.preferred_wake_up_time is not None:
        profile.preferred_wake_up_time = data.preferred_wake_up_time
    if data.sleep_duration is not None:
        profile.sleep_duration = data.sleep_duration
    if data.timezone is not None:
        profile.timezone = data.timezone
    if data.productivity_goal is not None:
        profile.productivity_goal = data.productivity_goal
    if data.difficulty_preference is not None:
        profile.difficulty_preference = data.difficulty_preference
    if data.habit_preferences is not None:
        profile.habit_preferences = data.habit_preferences

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "preferred_wake_up_time": profile.preferred_wake_up_time,
        "sleep_duration": profile.sleep_duration,
        "timezone": profile.timezone,
        "productivity_goal": profile.productivity_goal,
        "difficulty_preference": profile.difficulty_preference,
        "habit_preferences": profile.habit_preferences,
    }
