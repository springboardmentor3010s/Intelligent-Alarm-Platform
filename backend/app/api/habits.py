"""Habit and analytics routes for Intelligent Cognitive Alarm Platform."""
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..Models import User, HabitScore
from ..api.deps import get_current_user
from ..services.analytics_service import (
    _compute_wake_up_consistency,
    _compute_challenge_completion,
    _compute_snooze_reduction,
    _compute_sleep_adherence,
    compute_habit_composite,
)
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("/score", response_model=dict)
def get_habit_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date: Optional[str] = None,
):
    """Get user's habit score with weighted composite: 35/25/20/20."""
    user_id = current_user.id

    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check for existing habit score first
    existing = db.query(HabitScore).filter(
        HabitScore.user_id == user_id,
        HabitScore.date == date,
    ).first()

    if existing:
        return {
            "date": existing.date,
            "wake_up_consistency": existing.wake_up_consistency,
            "challenge_completion": existing.challenge_completion,
            "snooze_reduction": existing.snooze_reduction,
            "sleep_schedule_adherence": existing.sleep_schedule_adherence,
            "overall_score": existing.overall_score,
        }

    # Compute each component from actual data
    wake_up = _compute_wake_up_consistency(db, user_id, date)
    challenge = _compute_challenge_completion(db, user_id, date)
    snooze = _compute_snooze_reduction(db, user_id, date)
    sleep = _compute_sleep_adherence(db, user_id, date)

    # Weighted composite: 35/25/20/20
    overall = compute_habit_composite(wake_up, challenge, snooze, sleep)

    habit_score = HabitScore(
        user_id=user_id,
        date=date,
        wake_up_consistency=wake_up,
        challenge_completion=challenge,
        snooze_reduction=snooze,
        sleep_schedule_adherence=sleep,
        overall_score=overall,
    )
    try:
        db.add(habit_score)
        db.commit()
        db.refresh(habit_score)
    except IntegrityError:
        # Concurrent write for the same (user, date) lost the race; read winner.
        db.rollback()
        existing = db.query(HabitScore).filter(
            HabitScore.user_id == user_id,
            HabitScore.date == date,
        ).first()
        if existing:
            habit_score = existing
        else:
            db.rollback()

    return {
        "date": habit_score.date,
        "wake_up_consistency": habit_score.wake_up_consistency,
        "challenge_completion": habit_score.challenge_completion,
        "snooze_reduction": habit_score.snooze_reduction,
        "sleep_schedule_adherence": habit_score.sleep_schedule_adherence,
        "overall_score": habit_score.overall_score,
    }


@router.get("/score/history", response_model=list)
def get_habit_score_history(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get habit score history for the last N days."""
    user_id = current_user.id
    today = datetime.now(timezone.utc).date()

    scores = []
    for i in range(days):
        target_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        habit_score = db.query(HabitScore).filter(
            HabitScore.user_id == user_id,
            HabitScore.date == target_date,
        ).first()

        if habit_score:
            scores.append({
                "date": habit_score.date,
                "overall_score": habit_score.overall_score,
                "wake_up_consistency": habit_score.wake_up_consistency,
                "challenge_completion": habit_score.challenge_completion,
                "snooze_reduction": habit_score.snooze_reduction,
                "sleep_schedule_adherence": habit_score.sleep_schedule_adherence,
            })
        else:
            scores.append({
                "date": target_date,
                "overall_score": None,
                "wake_up_consistency": None,
                "challenge_completion": None,
                "snooze_reduction": None,
                "sleep_schedule_adherence": None,
            })

    return scores
