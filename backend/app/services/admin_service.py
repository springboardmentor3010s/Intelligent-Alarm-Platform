# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Admin service for Intelligent Cognitive Alarm Platform.

Platform-wide user listing and aggregation for the admin dashboard. Routers
delegate here so `api/dashboard.py` stays thin beyond RBAC guards.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..Models import User, Alarm, Challenge, ChallengeAttempt, HabitScore, Role, UserRole
from ..schemas import AdminUserRes, AdminAnalyticsRes


def _measured_uptime(db: Session) -> float:
    """Measured lifetime API success ratio (never a hard-coded constant)."""
    from .system_status import system_uptime_percentage

    return system_uptime_percentage(db)


def _measured_uptime_seconds() -> float:
    from .system_status import uptime_seconds

    return uptime_seconds()


def _measured_db_connected(db: Session) -> bool:
    from .system_status import get_system_health

    try:
        return bool(get_system_health(db).get("db_connected", False))
    except Exception:
        return False


def list_users(db: Session) -> list[AdminUserRes]:
    """List all users with their effective role name."""
    users = db.query(User).all()
    result = []
    for u in users:
        user_role = db.query(UserRole).filter(UserRole.user_id == u.id).first()
        role_name = "User"
        if user_role:
            role = db.query(Role).filter(Role.id == user_role.role_id).first()
            if role:
                role_name = role.name

        result.append(AdminUserRes(
            id=u.id,
            email=u.email,
            is_active=u.is_active,
            is_verified=u.is_verified,
            created_at=u.created_at or datetime.utcnow(),
            last_login=None,  # TODO: track last login
            role=role_name,
        ))

    return result


def platform_analytics(db: Session) -> AdminAnalyticsRes:
    """Aggregate platform-wide metrics (Admin only)."""
    total_users = db.query(User).count() or 0

    # Active users today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    active_users_today = db.query(User).filter(
        User.updated_at >= today_start,
    ).count() or 0

    # New users this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_this_week = db.query(User).filter(
        User.created_at >= week_ago,
    ).count() or 0

    # Alarm dismissal success rate
    total_alarms = db.query(Alarm).count() or 1
    dismissed_alarms = db.query(Alarm).filter(~Alarm.is_enabled).count() or 0
    alarm_dismissal_rate = dismissed_alarms / total_alarms

    # Platform average habit score
    avg_habit = db.query(func.avg(HabitScore.overall_score)).scalar() or 0.0

    # Top challenge types by attempt count
    challenge_counts = db.query(
        ChallengeAttempt.challenge_id,
        func.count(ChallengeAttempt.id).label("count"),
    ).group_by(ChallengeAttempt.challenge_id).order_by(func.count(ChallengeAttempt.id).desc()).limit(5).all()

    top_challenges = []
    for cid, count in challenge_counts:
        challenge = db.query(Challenge).filter(Challenge.id == cid).first() if cid else None
        top_challenges.append({
            "challenge_type": challenge.challenge_type if challenge else "Unknown",
            "attempt_count": count,
        })

    return AdminAnalyticsRes(
        total_users=total_users,
        active_users_today=active_users_today,
        new_users_this_week=new_users_this_week,
        alarm_dismissal_success_rate=round(alarm_dismissal_rate, 4),
        platform_habit_score_avg=round(float(avg_habit), 2),
        top_challenge_types=top_challenges,
        system_uptime_percentage=_measured_uptime(db),
        uptime_seconds=_measured_uptime_seconds(),
        db_connected=_measured_db_connected(db),
    )
