# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Habit scoring routes for Intelligent Cognitive Alarm Platform."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
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
    """Get the user's habit score.

    Weighted composite (single source: `habit_scoring_service`):
    `overall = 0.35*wake_up_consistency + 0.25*challenge_completion
    + 0.20*snooze_reduction + 0.20*sleep_schedule_adherence`
    (each component 0-100). New accounts with no alarms and no attempts
    honestly report all zeros without writing a row.
    """
    return habit_scoring_service.get_or_compute_habit_score(db, current_user.id, date)


@router.get("/score/history", response_model=list)
def get_habit_score_history(
    days: int = Query(7, ge=1, le=365, description="History window in days (UTC, most recent first)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get habit score history for the last N days (UTC day boundaries).

    Days without a stored score are returned with `None` components so charts
    render honest gaps; report exports contain only recorded days.
    """
    return habit_scoring_service.get_habit_score_history(db, current_user.id, days)
