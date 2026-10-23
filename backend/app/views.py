from app.models import User, UserProfile


def profile_view(p: UserProfile | None) -> dict | None:
    if not p:
        return None
    return {
        "preferred_wake_time": p.preferred_wake_time.isoformat() if p.preferred_wake_time else None,
        "bedtime": p.bedtime.isoformat() if p.bedtime else None,
        "sleep_duration_minutes": p.sleep_duration_minutes, "timezone": p.timezone,
        "productivity_goal": p.productivity_goal, "wake_goal_streak": p.wake_goal_streak,
        "difficulty_preference": p.difficulty_preference, "current_difficulty": p.current_difficulty,
        "preferred_challenge_types": [t for t in (p.preferred_challenge_types or "").split(",") if t],
        "bedtime_reminders": p.bedtime_reminders, "browser_notifications": p.browser_notifications,
        "onboarded": p.onboarded,
    }


def user_view(u: User, with_profile: bool = True) -> dict:
    v = {"id": str(u.id), "full_name": u.full_name, "email": u.email, "role": u.role, "is_active": u.is_active,
         "coach_requested": u.coach_requested, "has_password": bool(u.hashed_password),
         "oauth_provider": u.oauth_provider, "created_at": u.created_at, "last_login_at": u.last_login_at}
    if with_profile:
        v["profile"] = profile_view(u.profile)
    return v
