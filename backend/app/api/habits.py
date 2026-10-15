from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, UserProfile
from app.core.security import get_current_user

router = APIRouter(prefix="/habits", tags=["Habits"])

def _get_habits(profile: UserProfile) -> list:
    if not profile.habit_preferences:
        return []
    return [h.strip() for h in profile.habit_preferences.split(",") if h.strip()]

@router.get("")
def get_habits(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    return {"habits": _get_habits(profile) if profile else []}

@router.post("")
def add_habit(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = body.get("habit", "").strip()
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    habits = _get_habits(profile)
    if habit and habit not in habits:
        habits.append(habit)
        profile.habit_preferences = ", ".join(habits)
        db.commit()
    return {"habits": habits}

@router.delete("/{habit_name}")
def delete_habit(habit_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    habits = [h for h in _get_habits(profile) if h != habit_name]
    profile.habit_preferences = ", ".join(habits)
    db.commit()
    return {"habits": habits}
