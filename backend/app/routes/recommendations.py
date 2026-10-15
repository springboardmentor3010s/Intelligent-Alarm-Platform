from fastapi import APIRouter, Depends, HTTPException

from app.core.security import user_scope
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.personalized_recommendation import (
    personalized_recommendation_service,
)


router = APIRouter(
    prefix="/recommendations",
    tags=["Personalized Recommendations"],
    dependencies=[Depends(user_scope)],
)


@router.get("/{user_id}")
def get_personalized_recommendation(
    user_id: int,
    current_difficulty: str = "medium",
    db: Session = Depends(get_db),
):
    """
    Generate a personalized cognitive challenge
    recommendation for a user.
    """

    try:

        current_difficulty = (
            current_difficulty
            .strip()
            .lower()
        )

        if current_difficulty not in {
            "beginner",
            "easy",
            "medium",
            "hard",
            "expert",
        }:
            raise HTTPException(
                status_code=400,
                detail=(
                    "current_difficulty must be beginner, "
                    "easy, medium, hard, or expert."
                ),
            )

        recommendation = (
            personalized_recommendation_service
            .get_recommendation(
                db=db,
                user_id=user_id,
                current_difficulty=current_difficulty,
            )
        )

        return recommendation

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate personalized "
                "recommendation: "
                f"{str(error)}"
            ),
        ) from error