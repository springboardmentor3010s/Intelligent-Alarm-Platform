"""Profile helpers: value checks and wake-up goal tracking."""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.models.user import User
from app.models.wake_up_verification import WakeUpVerification

DIFFICULTY_LEVELS = ["beginner", "easy", "medium", "hard", "expert"]
CHALLENGE_TYPES = [
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
]


def parse_hhmm(value: str) -> time:
    try:
        return datetime.strptime(value.strip(), "%H:%M").time()
    except ValueError:
        raise ValueError("Time must be in HH:MM format.")


def format_hhmm(value: time | None) -> str | None:
    return value.strftime("%H:%M") if value else None


def get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def profile_dict(user: User, profile: UserProfile) -> dict:
    return {
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "timezone": user.timezone,
        "wake_time": format_hhmm(profile.wake_target),
        "sleep_time": format_hhmm(profile.sleep_target),
        "sleep_duration_hours": round(
            profile.daily_sleep_goal_minutes / 60, 2
        ),
        "difficulty_preference": profile.current_difficulty,
        "preferred_challenge": profile.preferred_challenge,
        "productivity_goals": profile.productivity_goals or [],
        "habit_preferences": profile.habit_preferences or [],
        "wake_up_goal": profile.wake_up_goal,
        "wake_goal_days_per_week": profile.wake_goal_days_per_week,
    }


def wake_goal_progress(db: Session, user: User, profile: UserProfile) -> dict:
    """Days in the last 7 with at least one successful wake-up."""
    tz = ZoneInfo(user.timezone or "UTC")
    since = datetime.now(timezone.utc) - timedelta(days=7)

    rows = db.execute(
        select(WakeUpVerification.created_at).where(
            WakeUpVerification.user_id == user.id,
            WakeUpVerification.successful.is_(True),
            WakeUpVerification.created_at >= since,
        )
    ).scalars().all()

    days = set()
    for created in rows:
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days.add(created.astimezone(tz).date())

    goal = profile.wake_goal_days_per_week or 7
    achieved = len(days)
    return {
        "goal_days_per_week": goal,
        "days_achieved": achieved,
        "percent": round(min(100.0, 100 * achieved / goal), 1),
        "goal_text": profile.wake_up_goal,
        "met": achieved >= goal,
    }
