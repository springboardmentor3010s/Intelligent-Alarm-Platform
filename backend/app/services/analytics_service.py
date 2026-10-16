# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Behavioral analytics aggregate facade.

Re-exports the habit-scoring and behavior-analytics domain modules so the
original `services.analytics_service` import path keeps working for routers,
smoke scripts, and tests.

Canonical homes:
- Habit scoring components + composite: `habit_scoring_service`
- Derived behavior analytics + `/analytics/me` summary: `behavior_analytics_service`
"""

from .behavior_analytics_service import (
    compute_recent_activity,
    compute_sleep_duration_avg,
    compute_sleep_windows,
    compute_wake_up_consistency_trend,
    get_user_analytics_summary,
)
from .habit_scoring_service import (
    compute_habit_composite,
    compute_streak_length,
    get_habit_score_history,
    get_or_compute_habit_score,
    refresh_habit_score,
)

__all__ = [
    "compute_habit_composite",
    "compute_recent_activity",
    "compute_sleep_duration_avg",
    "compute_sleep_windows",
    "compute_streak_length",
    "compute_wake_up_consistency_trend",
    "get_habit_score_history",
    "get_or_compute_habit_score",
    "get_user_analytics_summary",
    "refresh_habit_score",
]
