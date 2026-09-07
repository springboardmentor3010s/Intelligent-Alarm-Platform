"""Recommendation engine (AI/ML).

Concrete adapter over `services.recommendation_service` exposing the
`RecommendationEngine` interface. Recommendations are rule-generated from real
analytics (FR-RE-001..004); the interface allows a future model-based engine.
"""

from typing import Any, List

from sqlalchemy.orm import Session


def recommend(db: Session, user_id: int) -> List[Any]:
    """Return priority-sorted personalized recommendations."""
    from ..services.recommendation_service import generate_recommendations

    return generate_recommendations(db, user_id)
