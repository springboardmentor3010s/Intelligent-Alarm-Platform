from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.analytics_service import (
    get_dashboard,
    get_performance,
    generate_recommendations,
)
from ..models.recommendation import Recommendation
from ..utils.deps import get_current_user


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard & Analytics"],
)


# ============================================================
# FULL DASHBOARD  (backward compatibility)
# GET /api/dashboard
# ============================================================

@router.get("")
def dashboard(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    data = get_dashboard(db, user)
    data["recommendations"] = generate_recommendations(
        db,
        user,
        dashboard_data=data,
    )
    return data


# ============================================================
# STATS  →  frontend getDashboardStats()
# GET /api/dashboard/stats
# ============================================================

@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Returns all core dashboard metrics including:
    - habit_score (real weighted formula)
    - habit_score_breakdown (component percentages)
    - challenge_accuracy, completion_rate
    - snooze_count, alarm_completions
    - average_challenge_time
    - 7-day wake consistency
    - recommended_difficulty + difficulty_reason
    """
    data = get_dashboard(db, user)
    data["recommendations"] = generate_recommendations(
        db,
        user,
        dashboard_data=data,
    )
    return data


# ============================================================
# RECOMMENDATIONS  →  frontend getRecommendations()
# GET /api/dashboard/recommendations
# ============================================================

@router.get("/recommendations")
def dashboard_recommendations(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Returns structured, personalized recommendations generated from
    ACTUAL user behavioral data.

    - Data-driven: all text references real user metrics
    - Deduplicated: same title not repeated within 20h
    - Persisted: stored in DB for history tracking
    - Max 5 recommendations, sorted by priority (high → medium → low)

    Returns: [...]
    """
    return generate_recommendations(db, user)


@router.get("/recommendations/history")
def recommendation_history(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    records = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user.id)
        .order_by(Recommendation.created_at.desc(), Recommendation.id.desc())
        .all()
    )
    return [
        {
            "id": item.id,
            "title": item.title,
            "reason": item.reason,
            "suggested_action": item.suggested_action,
            "supporting_metric": item.supporting_metric,
            "category": item.category,
            "priority": item.priority,
            "is_acted_upon": item.is_acted_upon,
            "is_dismissed": item.is_dismissed,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in records
    ]


# ============================================================
# PERFORMANCE  →  frontend getPerformanceStats()
# GET /api/dashboard/performance
# ============================================================

@router.get("/performance")
def dashboard_performance(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Returns chart-ready performance data:
    - accuracy_timeline (last 10 questions)
    - challenge_type_distribution (pie)
    - wake_quality (bar by week)
    - readiness (radar)
    """
    return get_performance(db, user)