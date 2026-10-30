# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Feedback service for Intelligent Cognitive Alarm Platform.

Persists user-submitted feedback (mobile app) against the authenticated user.
Follows the same boundary pattern as `notification_service`: thin static
methods the router calls, with commit semantics handled here.
"""

from sqlalchemy.orm import Session

from ..Models import User, Feedback
from ..schemas import FeedbackSubmitReq


class FeedbackService:
    """Boundary for user-feedback persistence and review."""

    @staticmethod
    def create(db: Session, user: User, payload: FeedbackSubmitReq) -> Feedback:
        """Store a feedback submission and return the created record."""
        record = Feedback(
            user_id=user.id,
            category=payload.category,
            rating=payload.rating,
            message=payload.message,
            contact_email=payload.contact_email or user.email,
            status="new",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def list_admin(db: Session, limit: int = 100) -> list[Feedback]:
        """Newest-first feedback rows for admin review."""
        return (
            db.query(Feedback)
            .order_by(Feedback.created_at.desc(), Feedback.id.desc())
            .limit(limit)
            .all()
        )
