"""Analytics routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..Models import User
from ..api.deps import get_current_user
from ..services.analytics_service import get_user_analytics_summary
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
    from ..services.recommendation_service import generate_recommendations
    return generate_recommendations(db, current_user.id)


@router.get("/ml-status")
def get_ml_status(
    current_user: User = Depends(get_current_user),
):
    """Get ML model status (for diagnostics)."""
    from ..services.ml_inference import MLInferenceService
    return MLInferenceService.get_model_status()