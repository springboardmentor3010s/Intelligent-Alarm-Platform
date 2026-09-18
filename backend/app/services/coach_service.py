"""Wellness-coach cohort service for Intelligent Cognitive Alarm Platform.

Coaches operate on an explicit assignment scope (`coach_assignments`): a coach
may list and inspect only users assigned to them. Administrators manage the
assignments and retain full visibility. Every read path enforces the scope so
a coach can never view users outside their authorized cohort.

All metric values are assembled from the same single-source services the
personal dashboards use (`habit_scoring_service`, `behavior_analytics_service`),
so coach views, user dashboards, and report exports always agree.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import CoachAssignment, Role, User, UserRole
from ..schemas import AdminUserRes
from . import habit_scoring_service
from .behavior_analytics_service import (
    compute_wake_up_consistency_trend,
    get_user_analytics_summary,
)

COACH_ROLE = "Wellness Coach"
ADMIN_ROLE = "Administrator"


def user_role_names(db: Session, user_id: int) -> set:
    rows = (
        db.query(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    )
    return {name for (name,) in rows}


def is_coach(db: Session, user_id: int) -> bool:
    return COACH_ROLE in user_role_names(db, user_id)


def is_admin(db: Session, user_id: int) -> bool:
    return ADMIN_ROLE in user_role_names(db, user_id)


def _require_user(db: Session, user_id: int, label: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail=f"{label} user not found")
    return user


def assign_user(db: Session, coach_id: int, user_id: int) -> CoachAssignment:
    """Assign a user to a coach's cohort (called from an admin-only route)."""
    coach = _require_user(db, coach_id, "Coach")
    if not is_coach(db, coach_id):
        raise HTTPException(status_code=400, detail="Target coach does not hold the Wellness Coach role")
    target = _require_user(db, user_id, "Assigned")
    if coach_id == user_id:
        raise HTTPException(status_code=400, detail="A coach cannot be assigned to themselves")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Cannot assign an inactive user")

    existing = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == user_id,
    ).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="User is already assigned to this coach")

    row = CoachAssignment(coach_id=coach.id, user_id=target.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def unassign_user(db: Session, coach_id: int, user_id: int) -> None:
    """Remove a user from a coach's cohort (called from an admin-only route)."""
    row = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == user_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(row)
    db.commit()


def assigned_user_ids(db: Session, coach_id: int) -> List[int]:
    rows = db.query(CoachAssignment.user_id).filter(CoachAssignment.coach_id == coach_id).all()
    return [user_id for (user_id,) in rows]


def assert_coach_scope(db: Session, coach_id: int, user_id: int) -> None:
    """Raise 403 unless `user_id` is inside the coach's authorized cohort."""
    if is_admin(db, coach_id):
        return
    scoped = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == user_id,
    ).first()
    if scoped is None:
        raise HTTPException(
            status_code=403,
            detail="User is outside your assigned coaching cohort",
        )


def _admin_user_row(db: Session, user: User) -> AdminUserRes:
    return AdminUserRes(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at or datetime.now(timezone.utc),
        last_login=None,
        role=(sorted(user_role_names(db, user.id)) or ["User"])[-1],
    )


def list_cohort_users(db: Session, coach_id: int) -> List[AdminUserRes]:
    """Users visible to a coach: admins see everyone, coaches see assignments."""
    if is_admin(db, coach_id):
        users = db.query(User).order_by(User.id.asc()).all()
    else:
        ids = assigned_user_ids(db, coach_id)
        if not ids:
            return []
        users = db.query(User).filter(User.id.in_(ids)).order_by(User.id.asc()).all()
    return [_admin_user_row(db, u) for u in users]


def get_cohort_user_detail(db: Session, coach_id: int, user_id: int) -> dict:
    """Scoped per-user coaching view: habit adherence, sleep trend, challenge
    performance, and week-over-week progress — all from the shared services."""
    assert_coach_scope(db, coach_id, user_id)
    user = _require_user(db, user_id, "Cohort")

    history = habit_scoring_service.get_habit_score_history(db, user_id, days=7)
    scored = [h for h in history if h.get("overall_score") is not None]
    latest = habit_scoring_service.get_or_compute_habit_score(db, user_id)

    analytics = get_user_analytics_summary(db, user_id)
    sleep_trend = [h.get("sleep_schedule_adherence") for h in history]
    wake_trend = [h.get("wake_up_consistency") for h in history]

    progress = None
    if len(scored) >= 2:
        oldest, newest = scored[-1]["overall_score"], scored[0]["overall_score"]
        progress = {
            "oldest_score": oldest,
            "latest_score": newest,
            "delta": newest - oldest,
            "direction": "improving" if newest - oldest > 5 else ("declining" if newest - oldest < -5 else "stable"),
        }

    return {
        "user": _admin_user_row(db, user).model_dump(),
        "habit_score": latest,
        "habit_history": history,
        "analytics": analytics,
        "sleep_trend": sleep_trend,
        "wake_up_trend": wake_trend,
        "wake_up_consistency_trend": compute_wake_up_consistency_trend(db, user_id, days=7),
        "challenge_performance": analytics.get("recent_activity", {}).get("challenge_accuracy_by_type", {}),
        "progress": progress,
    }
