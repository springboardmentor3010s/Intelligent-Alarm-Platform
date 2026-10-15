from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.models.user import User
from app.services import tracking_metrics as tm
from app.services.behavior_analytics import (
    behavior_analytics_service,
)

# Weighted scoring model from the project specification.
HABIT_WEIGHTS = {
    "wake_up_consistency": 0.35,
    "challenge_completion": 0.25,
    "snooze_reduction": 0.20,
    "sleep_schedule_adherence": 0.20,
}


class HabitScoreService:
    """
    Calculates the habit score:

        Wake-Up Consistency          35%
        Challenge Completion Success 25%
        Snooze Reduction             20%
        Sleep Schedule Adherence     20%

    A component with no recorded data (for example no sleep logs yet) is
    left out and the remaining weights are scaled up to add to 100%, so
    missing data never counts as a zero.
    """

    def calculate_habit_score(
        self,
        db: Session,
        user_id: int,
    ) -> dict:

        behavior = (
            behavior_analytics_service.get_user_behavior(
                db=db,
                user_id=user_id,
            )
        )

        wake_up = behavior["wake_up_behavior"]
        cognitive = behavior["cognitive_behavior"]
        days = behavior["analysis_period_days"]

        # ---------------------------------------------------------
        # 1. Wake-up consistency
        # ---------------------------------------------------------

        wake_up_score = (
            wake_up["success_rate"] * 100
            if wake_up["total_verifications"] > 0
            else None
        )

        # ---------------------------------------------------------
        # 2. Challenge completion success
        # ---------------------------------------------------------

        challenge_score = None
        if cognitive["total_challenges"] > 0:
            challenge_score = (
                cognitive["accuracy"] * 100
                if cognitive["accuracy"] <= 1
                else cognitive["accuracy"]
            )

        # ---------------------------------------------------------
        # 3. Snooze reduction and 4. sleep schedule adherence
        # ---------------------------------------------------------

        now = datetime.now(timezone.utc)
        since = now - timedelta(days=days)

        events = tm.load_alarm_events(db, [user_id], since, now)
        snooze_score = tm.snooze_reduction_component(events)

        user = db.get(User, user_id)
        profile = db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).scalar_one_or_none()

        sleep_logs = tm.load_sleep_logs(
            db, [user_id], since.date(), now.date()
        )
        sleep_score = tm.sleep_adherence_component(
            sleep_logs,
            profile.daily_sleep_goal_minutes if profile else 480,
            profile.sleep_target if profile else None,
            ZoneInfo(user.timezone) if user and user.timezone else ZoneInfo("UTC"),
        )

        components = {
            "wake_up_consistency": wake_up_score,
            "challenge_completion": challenge_score,
            "snooze_reduction": snooze_score,
            "sleep_schedule_adherence": sleep_score,
        }

        available = {
            name: value
            for name, value in components.items()
            if value is not None
        }

        if available:
            total_weight = sum(HABIT_WEIGHTS[n] for n in available)
            habit_score = sum(
                HABIT_WEIGHTS[n] * v for n, v in available.items()
            ) / total_weight
            weights_used = {
                n: round(HABIT_WEIGHTS[n] / total_weight, 3)
                for n in available
            }
        else:
            habit_score = 0.0
            weights_used = {}

        return {
            "user_id": user_id,

            "habit_score": round(habit_score, 2),

            "components": {
                name: (round(value, 2) if value is not None else None)
                for name, value in components.items()
            },

            "weights": HABIT_WEIGHTS,

            "weights_used": weights_used,

            "partial": len(available) < len(HABIT_WEIGHTS),

            "analysis_period_days": days,
        }


habit_score_service = HabitScoreService()
