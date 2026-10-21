from sqlalchemy import func
from typing import Optional

from sqlalchemy.orm import Session

from ..models.coach_assignment import CoachAssignment
from ..models.user import User


def assign_unassigned_users(db: Session, assigned_by_id: Optional[int]) -> int:
    """Assign each unassigned user to the coach with the smallest roster."""
    coaches = (
        db.query(User)
        .filter(User.role == "wellness_coach")
        .order_by(User.id.asc())
        .all()
    )
    if not coaches:
        return 0

    workload = {
        coach_id: count
        for coach_id, count in db.query(
            CoachAssignment.coach_id,
            func.count(CoachAssignment.id),
        )
        .join(User, User.id == CoachAssignment.coach_id)
        .filter(User.role == "wellness_coach")
        .group_by(CoachAssignment.coach_id)
        .all()
    }
    assigned_users = (
        db.query(CoachAssignment.user_id)
        .join(User, User.id == CoachAssignment.coach_id)
        .filter(User.role == "wellness_coach")
        .distinct()
    )
    unassigned_users = (
        db.query(User)
        .filter(User.role == "user", ~User.id.in_(assigned_users))
        .order_by(User.id.asc())
        .all()
    )

    for user in unassigned_users:
        coach = min(coaches, key=lambda item: (workload.get(item.id, 0), item.id))
        db.add(CoachAssignment(
            coach_id=coach.id,
            user_id=user.id,
            assigned_by_id=assigned_by_id,
        ))
        workload[coach.id] = workload.get(coach.id, 0) + 1

    return len(unassigned_users)


def ensure_user_has_coach(db: Session, user: User, assigned_by_id: Optional[int]) -> bool:
    """Assign one user when coaches exist and the user has no current coach."""
    if user.role != "user":
        return False
    if db.query(CoachAssignment.id).join(
        User, User.id == CoachAssignment.coach_id
    ).filter(
        CoachAssignment.user_id == user.id,
        User.role == "wellness_coach",
    ).first():
        return False

    coaches = (
        db.query(User)
        .filter(User.role == "wellness_coach")
        .order_by(User.id.asc())
        .all()
    )
    if not coaches:
        return False

    counts = dict(
        db.query(CoachAssignment.coach_id, func.count(CoachAssignment.id))
        .join(User, User.id == CoachAssignment.coach_id)
        .filter(User.role == "wellness_coach")
        .group_by(CoachAssignment.coach_id)
        .all()
    )
    coach = min(coaches, key=lambda item: (counts.get(item.id, 0), item.id))
    db.add(CoachAssignment(
        coach_id=coach.id,
        user_id=user.id,
        assigned_by_id=assigned_by_id,
    ))
    return True
