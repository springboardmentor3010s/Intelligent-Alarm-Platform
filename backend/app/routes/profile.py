from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import user_scope
from app.db.database import get_db
from app.models.user import User
from app.services import profile_service as ps
from app.services.habit_score import habit_score_service

router = APIRouter(
    prefix="/profile",
    tags=["User Profile and Habits"],
    dependencies=[Depends(user_scope)],
)

DifficultyPreference = Literal["beginner", "easy", "medium", "hard", "expert"]
ChallengePreference = Literal[
    "math", "logic", "memory", "word", "pattern", "riddle", "quiz"
]


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    timezone: str | None = None
    wake_time: str | None = Field(default=None, description="HH:MM")
    sleep_time: str | None = Field(default=None, description="HH:MM")
    sleep_duration_hours: float | None = Field(default=None, ge=3, le=14)
    difficulty_preference: DifficultyPreference | None = None
    preferred_challenge: ChallengePreference | None = None
    productivity_goals: list[str] | None = Field(default=None, max_length=10)
    habit_preferences: list[str] | None = Field(default=None, max_length=10)
    wake_up_goal: str | None = Field(default=None, max_length=255)
    wake_goal_days_per_week: int | None = Field(default=None, ge=1, le=7)


def _user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


def _clean_list(items: list[str]) -> list[str]:
    cleaned: list[str] = []
    for item in items:
        text = item.strip()[:80]
        if text and text.lower() not in {c.lower() for c in cleaned}:
            cleaned.append(text)
    return cleaned


@router.get("/options")
def profile_options():
    """Values the profile form can offer."""
    return {
        "difficulty_levels": ps.DIFFICULTY_LEVELS,
        "challenge_types": ps.CHALLENGE_TYPES,
    }


@router.get("/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = _user_or_404(db, user_id)
    profile = ps.get_or_create_profile(db, user_id)
    return ps.profile_dict(user, profile)


@router.put("/{user_id}")
def update_profile(
    user_id: int,
    body: ProfileUpdate,
    db: Session = Depends(get_db),
):
    user = _user_or_404(db, user_id)
    profile = ps.get_or_create_profile(db, user_id)
    data = body.model_dump(exclude_unset=True)

    try:
        if "timezone" in data and data["timezone"]:
            try:
                ZoneInfo(data["timezone"])
            except (ZoneInfoNotFoundError, ValueError):
                raise ValueError(
                    "Unknown time zone. Use a name such as Asia/Kolkata."
                )
            user.timezone = data["timezone"]

        if "full_name" in data and data["full_name"]:
            user.full_name = data["full_name"].strip()

        if "wake_time" in data:
            profile.wake_target = (
                ps.parse_hhmm(data["wake_time"]) if data["wake_time"] else None
            )

        if "sleep_time" in data:
            profile.sleep_target = (
                ps.parse_hhmm(data["sleep_time"]) if data["sleep_time"] else None
            )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if data.get("sleep_duration_hours") is not None:
        profile.daily_sleep_goal_minutes = int(
            round(data["sleep_duration_hours"] * 60)
        )

    if data.get("difficulty_preference"):
        profile.current_difficulty = data["difficulty_preference"]

    if data.get("preferred_challenge"):
        profile.preferred_challenge = data["preferred_challenge"]

    if data.get("productivity_goals") is not None:
        profile.productivity_goals = _clean_list(data["productivity_goals"])

    if data.get("habit_preferences") is not None:
        profile.habit_preferences = _clean_list(data["habit_preferences"])

    if "wake_up_goal" in data:
        goal = (data["wake_up_goal"] or "").strip()
        profile.wake_up_goal = goal or None

    if data.get("wake_goal_days_per_week") is not None:
        profile.wake_goal_days_per_week = data["wake_goal_days_per_week"]

    db.commit()
    db.refresh(profile)
    db.refresh(user)
    return ps.profile_dict(user, profile)


@router.get("/{user_id}/habit-profile")
def habit_profile(user_id: int, db: Session = Depends(get_db)):
    """Habit preferences, goals and current habit score in one place."""
    user = _user_or_404(db, user_id)
    profile = ps.get_or_create_profile(db, user_id)

    try:
        habit = habit_score_service.calculate_habit_score(
            db=db, user_id=user_id
        )
    except Exception:
        habit = {}

    return {
        "user_id": user_id,
        "habit_preferences": profile.habit_preferences or [],
        "productivity_goals": profile.productivity_goals or [],
        "wake_up_goal": ps.wake_goal_progress(db, user, profile),
        "habit_score": habit.get("habit_score"),
        "habit_components": habit.get("components", {}),
    }
