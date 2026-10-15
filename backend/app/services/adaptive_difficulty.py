
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.challenge import Challenge
from app.models.challenge_attempt import ChallengeAttempt


DIFFICULTY_LEVELS = ["beginner", "easy", "medium", "hard", "expert"]


class AdaptiveDifficultyEngine:
    """
    Determines the next challenge difficulty for a user
    based on their recent challenge performance.
    """

    def __init__(self, history_limit: int = 5):
        self.history_limit = history_limit

    def get_next_difficulty(
        self,
        db: Session,
        user_id: int,
        current_difficulty: str,
    ) -> dict:

        current_difficulty = current_difficulty.lower()

        if current_difficulty not in DIFFICULTY_LEVELS:
            current_difficulty = "easy"

        attempts = self._get_recent_attempts(
            db=db,
            user_id=user_id,
        )

        # No previous performance available.
        # Return the complete result structure expected
        # by the challenge generation route.
        if not attempts:
            performance_score = self._calculate_performance_score(
                accuracy=0.0,
                average_response_time=0.0,
            )

            return {
                "current_difficulty": current_difficulty,
                "next_difficulty": current_difficulty,
                "decision": "keep",
                "reason": "No previous challenge history available.",
                "accuracy": 0.0,
                "average_response_time": 0.0,
                "performance_score": round(
                    performance_score,
                    2,
                ),
                "attempts_analyzed": 0,
            }

        accuracy = self._calculate_accuracy(attempts)

        average_response_time = (
            self._calculate_average_response_time(attempts)
        )

        performance_score = self._calculate_performance_score(
            accuracy=accuracy,
            average_response_time=average_response_time,
        )

        next_difficulty, decision = self._determine_difficulty(
            current_difficulty=current_difficulty,
            performance_score=performance_score,
        )

        reason = self._generate_reason(
            accuracy=accuracy,
            average_response_time=average_response_time,
            performance_score=performance_score,
            decision=decision,
            current_difficulty=current_difficulty,
            next_difficulty=next_difficulty,
        )

        return {
            "current_difficulty": current_difficulty,
            "next_difficulty": next_difficulty,
            "decision": decision,
            "reason": reason,
            "accuracy": round(accuracy, 2),
            "average_response_time": round(
                average_response_time,
                2,
            ),
            "performance_score": round(
                performance_score,
                2,
            ),
            "attempts_analyzed": len(attempts),
        }

    def _get_recent_attempts(
        self,
        db: Session,
        user_id: int,
    ) -> list[ChallengeAttempt]:

        statement = (
            select(ChallengeAttempt)
            .where(
                ChallengeAttempt.user_id == user_id
            )
            .order_by(
                ChallengeAttempt.created_at.desc()
            )
            .limit(self.history_limit)
        )

        result = db.execute(statement)

        return list(result.scalars().all())

    @staticmethod
    def _calculate_accuracy(
        attempts: list[ChallengeAttempt],
    ) -> float:

        if not attempts:
            return 0.0

        correct_count = sum(
            1
            for attempt in attempts
            if attempt.is_correct
        )

        return correct_count / len(attempts)

    @staticmethod
    def _calculate_average_response_time(
        attempts: list[ChallengeAttempt],
    ) -> float:

        if not attempts:
            return 0.0

        total_time = sum(
            attempt.response_time
            for attempt in attempts
        )

        return total_time / len(attempts)

    @staticmethod
    def _calculate_performance_score(
        accuracy: float,
        average_response_time: float,
    ) -> float:

        """
        Performance score is calculated using:

        70% accuracy
        30% response speed

        Response-time scoring:
        <= 5 sec   -> 100
        <= 10 sec  -> 80
        <= 20 sec  -> 60
        <= 30 sec  -> 40
        > 30 sec   -> 20
        """

        accuracy_score = accuracy * 100

        if average_response_time <= 5:
            speed_score = 100

        elif average_response_time <= 10:
            speed_score = 80

        elif average_response_time <= 20:
            speed_score = 60

        elif average_response_time <= 30:
            speed_score = 40

        else:
            speed_score = 20

        performance_score = (
            accuracy_score * 0.70
            + speed_score * 0.30
        )

        return performance_score

    @staticmethod
    def _determine_difficulty(
        current_difficulty: str,
        performance_score: float,
    ) -> tuple[str, str]:

        current_index = DIFFICULTY_LEVELS.index(
            current_difficulty
        )

        # Strong performance
        if performance_score >= 80:

            if current_index < len(DIFFICULTY_LEVELS) - 1:
                return (
                    DIFFICULTY_LEVELS[current_index + 1],
                    "increase",
                )

            return (
                current_difficulty,
                "keep",
            )

        # Weak performance
        if performance_score < 50:

            if current_index > 0:
                return (
                    DIFFICULTY_LEVELS[current_index - 1],
                    "decrease",
                )

            return (
                current_difficulty,
                "keep",
            )

        # Average performance
        return (
            current_difficulty,
            "keep",
        )

    @staticmethod
    def _generate_reason(
        accuracy: float,
        average_response_time: float,
        performance_score: float,
        decision: str,
        current_difficulty: str,
        next_difficulty: str,
    ) -> str:

        accuracy_percentage = round(
            accuracy * 100
        )

        if decision == "increase":
            return (
                f"Strong recent performance: "
                f"{accuracy_percentage}% accuracy with an "
                f"average response time of "
                f"{average_response_time:.1f} seconds. "
                f"Difficulty increased from "
                f"{current_difficulty} to "
                f"{next_difficulty}."
            )

        if decision == "decrease":
            return (
                f"Recent performance indicates difficulty "
                f"adjustment is needed: "
                f"{accuracy_percentage}% accuracy with an "
                f"average response time of "
                f"{average_response_time:.1f} seconds. "
                f"Difficulty decreased from "
                f"{current_difficulty} to "
                f"{next_difficulty}."
            )

        return (
            f"Performance is currently stable: "
            f"{accuracy_percentage}% accuracy with an "
            f"average response time of "
            f"{average_response_time:.1f} seconds. "
            f"Difficulty remains at "
            f"{current_difficulty}."
        )


adaptive_difficulty_engine = AdaptiveDifficultyEngine()
