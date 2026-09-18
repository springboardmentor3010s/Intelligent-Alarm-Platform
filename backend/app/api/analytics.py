"""Analytics routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User
from ..api.deps import get_current_user
from ..services.analytics_service import get_user_analytics_summary
from ..services.recommendation_service import generate_recommendations
from ..services.adaptive_difficulty_service import AdaptiveDifficultyService
from ..schemas import RecommendationRes

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/me", response_model=dict)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's analytics summary (real values; no hardcoded placeholders)."""
    return get_user_analytics_summary(db, current_user.id)


@router.get("/recommendations", response_model=list[RecommendationRes])
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get personalized recommendations (sleep, wake-up, habit, challenge)."""
    return generate_recommendations(db, current_user.id)


@router.get("/ml-status")
def get_ml_status(
    current_user: User = Depends(get_current_user),
):
    """Get ML model status: availability, version, fallback, last training.

    The difficulty weights are synthetic-trained (never on real user data);
    see `AI_FEATURES.md` for provenance and limitations.
    """
    return AdaptiveDifficultyService.get_model_status()


@router.get("/anomalies", response_model=dict)
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Baseline anomaly assessment (statistical checks, gated on history).

    Returns `{"available": bool, ...}`; `available` is False with a reason
    when the user lacks the minimum scored history — never fabricated.
    """
    from ..ai_engine.anomaly import assess

    return assess(db, current_user.id)


@router.get("/forecast", response_model=dict)
def get_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Baseline performance forecast (linear trend, gated on history).

    Returns `{"available": bool, ...}`; `available` is False with a reason
    when the user lacks the minimum time-series data.
    """
    from ..ai_engine.performance_prediction import forecast

    return forecast(db, current_user.id)
