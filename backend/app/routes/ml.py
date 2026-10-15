from fastapi import APIRouter, Depends, HTTPException

from app.core.security import user_scope
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.behavior_analytics import (
    behavior_analytics_service,
)
from app.services.reinforcement_learning import (
    reinforcement_learning_service,
)


router = APIRouter(
    prefix="/ml",
    tags=["Machine Learning"],
    dependencies=[Depends(user_scope)],
)


@router.get("/adaptive-decision/{user_id}")
def get_adaptive_decision(
    user_id: int,
    current_difficulty: str = "medium",
    db: Session = Depends(get_db),
):
    """
    Generate an adaptive difficulty recommendation
    using behavior analytics and persistent Q-learning.
    """

    try:
        # ---------------------------------------------------------
        # 1. Get user's current behavioral analytics
        # ---------------------------------------------------------

        behavior = (
            behavior_analytics_service.get_user_behavior(
                db=db,
                user_id=user_id,
            )
        )

        cognitive = behavior["cognitive_behavior"]

        # ---------------------------------------------------------
        # 2. Extract cognitive performance metrics
        # ---------------------------------------------------------

        accuracy = cognitive["accuracy"]

        # Analytics stores accuracy as a ratio:
        # 1.0 = 100%
        # 0.5 = 50%
        #
        # RL state expects percentage values.
        if 0 <= accuracy <= 1:
            accuracy = accuracy * 100

        response_time = (
            cognitive["average_response_time"]
        )

        attempts = (
            cognitive["average_attempts"]
        )

        # ---------------------------------------------------------
        # 3. Validate current difficulty
        # ---------------------------------------------------------

        current_difficulty = (
            current_difficulty.strip().lower()
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

        # ---------------------------------------------------------
        # 4. Ask the Q-learning agent for a recommendation
        # ---------------------------------------------------------

        recommendation = (
            reinforcement_learning_service.get_recommendation(
                db=db,
                user_id=user_id,
                accuracy=accuracy,
                response_time=response_time,
                attempts=attempts,
                current_difficulty=current_difficulty,
            )
        )

        # ---------------------------------------------------------
        # 5. Return ML decision
        # ---------------------------------------------------------

        return {
            "user_id": user_id,

            "input_metrics": {
                "accuracy": round(
                    accuracy,
                    2,
                ),
                "average_response_time": round(
                    response_time,
                    2,
                ),
                "average_attempts": round(
                    attempts,
                    2,
                ),
                "current_difficulty": (
                    current_difficulty
                ),
            },

            "rl_decision": recommendation,
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate adaptive decision: "
                f"{str(error)}"
            ),
        ) from error