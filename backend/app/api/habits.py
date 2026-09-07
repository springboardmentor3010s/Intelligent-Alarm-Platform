"""Habit scoring routes for Intelligent Cognitive Alarm Platform."""

from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User
from ..api.deps import get_current_user
from ..services import habit_scoring_service

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("/score", response_model=dict)
def get_habit_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date: Optional[str] = None,
):
    """Get user's habit score with weighted composite: 35/25/20/20."""
    return habit_scoring_service.get_or_compute_habit_score(db, current_user.id, date)


@router.get("/score/history", response_model=list)
def get_habit_score_history(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get habit score history for the last N days."""
    return habit_scoring_service.get_habit_score_history(db, current_user.id, days)
