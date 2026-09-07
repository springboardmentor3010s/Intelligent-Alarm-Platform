"""Behavior analysis engine (AI/ML).

Concrete adapter over `services.behavior_analytics_service` implementing the
`BehaviorAnalyzer` interface. All values are derived from real data.
"""

from typing import Any, Dict

from sqlalchemy.orm import Session


def analyze(
    db: Session, user_id: int, days: int = 7
) -> Dict[str, Any]:
    """Return the user's analytics summary (backward-compatible keys)."""
    from ..services.behavior_analytics_service import get_user_analytics_summary

    return get_user_analytics_summary(db, user_id)


def recent_activity(db: Session, user_id: int, days: int = 7) -> Dict[str, Any]:
    """Return the per-day activity breakdown for the last N days."""
    from ..services.behavior_analytics_service import compute_recent_activity

    return compute_recent_activity(db, user_id, days)


def sleep_duration_avg(db: Session, user_id: int) -> float:
    """Estimate average nightly sleep duration in hours."""
    from ..services.behavior_analytics_service import compute_sleep_duration_avg

    return compute_sleep_duration_avg(db, user_id)
