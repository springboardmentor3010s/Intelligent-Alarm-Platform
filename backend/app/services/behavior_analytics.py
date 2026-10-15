from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alarm import Alarm
from app.models.challenge_attempt import ChallengeAttempt
from app.models.wake_up_verification import WakeUpVerification


class BehaviorAnalyticsService:
    """
    Calculates behavioral metrics for a user
    using existing alarm, challenge, and
    wake-up verification data.
    """

    def __init__(self, days: int = 7):
        self.days = days

    def get_user_behavior(
        self,
        db: Session,
        user_id: int,
    ) -> dict:

        since = datetime.utcnow() - timedelta(
            days=self.days
        )

        # ---------------------------------------------------------
        # 1. Wake-up verification statistics
        # ---------------------------------------------------------

        verification_statement = (
            select(WakeUpVerification)
            .where(
                WakeUpVerification.user_id == user_id,
                WakeUpVerification.created_at >= since,
            )
            .order_by(
                WakeUpVerification.created_at.desc()
            )
        )

        verification_result = db.execute(
            verification_statement
        )

        verifications = list(
            verification_result.scalars().all()
        )

        total_verifications = len(verifications)

        successful_verifications = sum(
            1
            for verification in verifications
            if verification.successful
        )

        verification_success_rate = (
            successful_verifications
            / total_verifications
            if total_verifications > 0
            else 0.0
        )

        verification_times = [
            verification.response_time
            for verification in verifications
            if verification.response_time is not None
        ]

        average_verification_response_time = (
            sum(verification_times)
            / len(verification_times)
            if verification_times
            else 0.0
        )

        verification_attempts = [
            verification.attempt_number
            for verification in verifications
            if verification.attempt_number is not None
        ]

        average_verification_attempts = (
            sum(verification_attempts)
            / len(verification_attempts)
            if verification_attempts
            else 0.0
        )

        # ---------------------------------------------------------
        # 2. Challenge statistics
        # ---------------------------------------------------------

        challenge_statement = (
            select(ChallengeAttempt)
            .where(
                ChallengeAttempt.user_id == user_id,
                ChallengeAttempt.created_at >= since,
            )
            .order_by(
                ChallengeAttempt.created_at.desc()
            )
        )

        challenge_result = db.execute(
            challenge_statement
        )

        challenge_attempts = list(
            challenge_result.scalars().all()
        )

        total_challenges = len(challenge_attempts)

        correct_challenges = sum(
            1
            for attempt in challenge_attempts
            if attempt.is_correct
        )

        challenge_accuracy = (
            correct_challenges
            / total_challenges
            if total_challenges > 0
            else 0.0
        )

        challenge_response_times = [
            attempt.response_time
            for attempt in challenge_attempts
            if attempt.response_time is not None
        ]

        average_challenge_response_time = (
            sum(challenge_response_times)
            / len(challenge_response_times)
            if challenge_response_times
            else 0.0
        )

        challenge_attempt_numbers = [
            attempt.attempt_number
            for attempt in challenge_attempts
            if attempt.attempt_number is not None
        ]

        average_challenge_attempts = (
            sum(challenge_attempt_numbers)
            / len(challenge_attempt_numbers)
            if challenge_attempt_numbers
            else 0.0
        )

        # ---------------------------------------------------------
        # 3. Alarm statistics
        # ---------------------------------------------------------

        active_alarm_count = db.scalar(
            select(
                func.count(Alarm.id)
            ).where(
                Alarm.user_id == user_id,
                Alarm.enabled.is_(True),
            )
        ) or 0

        total_alarm_count = db.scalar(
            select(
                func.count(Alarm.id)
            ).where(
                Alarm.user_id == user_id,
            )
        ) or 0

        # ---------------------------------------------------------
        # 4. Behavior consistency
        # ---------------------------------------------------------

        consistency_score = self._calculate_consistency_score(
            verification_success_rate=verification_success_rate,
            average_verification_attempts=(
                average_verification_attempts
            ),
            total_verifications=total_verifications,
        )

        # ---------------------------------------------------------
        # 5. Overall behavior score
        # ---------------------------------------------------------

        behavior_score = self._calculate_behavior_score(
            verification_success_rate=(
                verification_success_rate
            ),
            challenge_accuracy=challenge_accuracy,
            consistency_score=consistency_score,
        )

        # ---------------------------------------------------------
        # 6. Return complete analytics
        # ---------------------------------------------------------

        return {
            "user_id": user_id,
            "analysis_period_days": self.days,

            "wake_up_behavior": {
                "total_verifications": total_verifications,
                "successful_verifications": (
                    successful_verifications
                ),
                "success_rate": round(
                    verification_success_rate,
                    2,
                ),
                "average_response_time": round(
                    average_verification_response_time,
                    2,
                ),
                "average_attempts": round(
                    average_verification_attempts,
                    2,
                ),
            },

            "cognitive_behavior": {
                "total_challenges": total_challenges,
                "correct_challenges": correct_challenges,
                "accuracy": round(
                    challenge_accuracy,
                    2,
                ),
                "average_response_time": round(
                    average_challenge_response_time,
                    2,
                ),
                "average_attempts": round(
                    average_challenge_attempts,
                    2,
                ),
            },

            "alarm_behavior": {
                "active_alarms": active_alarm_count,
                "total_alarms": total_alarm_count,
            },

            "consistency_score": round(
                consistency_score,
                2,
            ),

            "behavior_score": round(
                behavior_score,
                2,
            ),
        }

    @staticmethod
    def _calculate_consistency_score(
        verification_success_rate: float,
        average_verification_attempts: float,
        total_verifications: int,
    ) -> float:

        if total_verifications == 0:
            return 0.0

        success_component = (
            verification_success_rate * 70
        )

        if average_verification_attempts <= 1:
            attempt_component = 30

        elif average_verification_attempts <= 2:
            attempt_component = 20

        elif average_verification_attempts <= 3:
            attempt_component = 10

        else:
            attempt_component = 0

        return success_component + attempt_component

    @staticmethod
    def _calculate_behavior_score(
        verification_success_rate: float,
        challenge_accuracy: float,
        consistency_score: float,
    ) -> float:

        wake_up_score = (
            verification_success_rate * 100
        )

        cognitive_score = (
            challenge_accuracy * 100
        )

        behavior_score = (
            wake_up_score * 0.40
            + cognitive_score * 0.30
            + consistency_score * 0.30
        )

        return behavior_score


behavior_analytics_service = BehaviorAnalyticsService()