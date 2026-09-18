# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Feedback routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User
from ..api.deps import get_current_user
from ..schemas import FeedbackSubmitReq, FeedbackRes
from ..services.feedback_service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackRes)
def submit_feedback(
    payload: FeedbackSubmitReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist a feedback submission for the current user."""
    return FeedbackService.create(db, current_user, payload)
