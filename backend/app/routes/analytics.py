from fastapi import APIRouter, Depends, HTTPException

from app.core.security import user_scope
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.behavior_analytics import (
    behavior_analytics_service,
)
from app.services.pattern_analytics import get_patterns
from app.services.habit_score import (
    habit_score_service,
)


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(user_scope)],
)


# ---------------------------------------------------------
# BEHAVIOR ANALYTICS
# ---------------------------------------------------------

@router.get("/behavior/{user_id}")
def get_behavior_analytics(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Get 7-day behavioral analytics for a user.
    """

    try:
        result = (
            behavior_analytics_service.get_user_behavior(
                db=db,
                user_id=user_id,
            )
        )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to calculate behavior analytics: "
                f"{str(error)}"
            ),
        )


# ---------------------------------------------------------
# HABIT SCORE
# ---------------------------------------------------------

@router.get("/habit-score/{user_id}")
def get_habit_score(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Get the user's habit score and component breakdown.
    """

    try:
        result = (
            habit_score_service.calculate_habit_score(
                db=db,
                user_id=user_id,
            )
        )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to calculate habit score: "
                f"{str(error)}"
            ),
        )


# ---------------------------------------------------------
# ANALYTICS SUMMARY
# ---------------------------------------------------------

@router.get("/summary/{user_id}")
def get_analytics_summary(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Get combined behavior analytics and habit score.
    """

    try:
        behavior = (
            behavior_analytics_service.get_user_behavior(
                db=db,
                user_id=user_id,
            )
        )

        habit_score = (
            habit_score_service.calculate_habit_score(
                db=db,
                user_id=user_id,
            )
        )

        return {
            "user_id": user_id,
            "analysis_period_days": behavior[
                "analysis_period_days"
            ],
            "behavior": behavior,
            "habit_score": habit_score,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to calculate analytics summary: "
                f"{str(error)}"
            ),
        )


# ---------------------------------------------------------
# PATTERNS: SNOOZE, WAKE-UP, SLEEP, PRODUCTIVITY
# ---------------------------------------------------------

@router.get("/patterns/{user_id}")
def get_pattern_analytics(
    user_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
):
    """Snooze, wake-up, sleep and productivity patterns."""
    return get_patterns(db, user_id, max(7, min(days, 180)))
