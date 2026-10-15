from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.rl_q_value import RLQValue
from app.services.behavior_analytics import (
    behavior_analytics_service,
)
from app.services.reinforcement_learning import (
    reinforcement_learning_service,
)


class PersonalizedRecommendationService:
    """
    Generates personalized cognitive challenge
    recommendations using behavior analytics and
    reinforcement learning.
    """

    CHALLENGE_TYPES = [
        "math",
        "logic",
        "memory",
        "word",
        "pattern",
        "riddle",
        "quiz",
    ]

    def get_recommendation(
        self,
        db: Session,
        user_id: int,
        current_difficulty: str = "medium",
    ) -> dict:
        """
        Generate a personalized challenge recommendation.
        """

        # ---------------------------------------------------------
        # 1. Get user's behavioral analytics
        # ---------------------------------------------------------

        behavior = (
            behavior_analytics_service.get_user_behavior(
                db=db,
                user_id=user_id,
            )
        )

        cognitive = behavior["cognitive_behavior"]

        # ---------------------------------------------------------
        # 2. Extract performance metrics
        # ---------------------------------------------------------

        accuracy = cognitive["accuracy"]

        if 0 <= accuracy <= 1:
            accuracy *= 100

        response_time = cognitive["average_response_time"]

        average_attempts = cognitive["average_attempts"]

        current_difficulty = (
            current_difficulty
            .strip()
            .lower()
        )

        # ---------------------------------------------------------
        # 3. Get RL recommendation for CURRENT state
        # ---------------------------------------------------------

        rl_recommendation = (
            reinforcement_learning_service.get_recommendation(
                db=db,
                user_id=user_id,
                accuracy=accuracy,
                response_time=response_time,
                attempts=average_attempts,
                current_difficulty=current_difficulty,
            )
        )

        recommended_difficulty = (
            rl_recommendation["recommended_difficulty"]
        )

        q_values = rl_recommendation["q_values"]

        # ---------------------------------------------------------
        # 4. Check whether CURRENT state has learned Q-values
        # ---------------------------------------------------------

        has_current_state_q_value = any(
            abs(float(value)) > 0.000001
            for value in q_values.values()
        )

        # ---------------------------------------------------------
        # 5. Check whether the USER has ANY learned Q-values
        # ---------------------------------------------------------

        learned_q_value_count = (
            db.query(RLQValue)
            .filter(
                RLQValue.user_id == user_id,
                RLQValue.q_value != 0,
            )
            .count()
        )

        has_any_learned_q_value = (
            learned_q_value_count > 0
        )

        # ---------------------------------------------------------
        # 6. Select challenge type
        # ---------------------------------------------------------

        if accuracy >= 80:

            if response_time <= 5:
                challenge_type = "logic"
                reason = (
                    "High accuracy with fast responses. "
                    "A logic challenge is recommended "
                    "to provide additional cognitive "
                    "complexity."
                )

            else:
                challenge_type = "memory"
                reason = (
                    "High accuracy with moderate or "
                    "slower responses. A memory challenge "
                    "is recommended to vary the cognitive "
                    "task."
                )

        elif accuracy >= 50:

            challenge_type = "math"
            reason = (
                "Moderate recent accuracy. A math "
                "challenge is recommended to reinforce "
                "structured problem solving."
            )

        else:

            challenge_type = "word"
            reason = (
                "Lower recent accuracy. A word challenge "
                "is recommended to provide a different "
                "cognitive task while maintaining "
                "engagement."
            )

        # ---------------------------------------------------------
        # 7. Determine decision source
        # ---------------------------------------------------------

        if has_current_state_q_value:
            decision_source = "q_learning"
        else:
            decision_source = "rule_based_fallback"

        # ---------------------------------------------------------
        # 8. Return personalized recommendation
        # ---------------------------------------------------------

        return {
            "user_id": user_id,

            "recommendation": {
                "challenge_type": challenge_type,
                "difficulty": recommended_difficulty,
                "reason": reason,
            },

            "decision": {
                "source": decision_source,
                "method": "q_learning_plus_behavior_rules",
            },

            "user_metrics": {
                "accuracy": round(
                    accuracy,
                    2,
                ),
                "average_response_time": round(
                    response_time,
                    2,
                ),
                "average_attempts": round(
                    average_attempts,
                    2,
                ),
                "current_difficulty": current_difficulty,
            },

            "reinforcement_learning": {
                "state": rl_recommendation["state"],
                "q_values": q_values,
                "recommended_difficulty": recommended_difficulty,

                # Current state learning
                "has_learned_q_value": (
                    has_current_state_q_value
                ),

                # Overall user learning
                "has_any_learned_q_value": (
                    has_any_learned_q_value
                ),

                "learned_q_value_count": (
                    learned_q_value_count
                ),
            },
        }


personalized_recommendation_service = (
    PersonalizedRecommendationService()
)