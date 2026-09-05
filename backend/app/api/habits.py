"""Habit and analytics routes for Intelligent Cognitive Alarm Platform."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..Models import User, HabitScore, Alarm, ChallengeAttempt
from ..api.deps import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/habits", tags=["habits"])


def _compute_wake_up_consistency(db: Session, user_id: int, target_date: str) -> int:
    """Compute wake-up consistency score (0-100) based on alarm dismissal patterns.
    
    Weight: 35% of overall habit score.
    Scoring: % of alarms dismissed within 15 min of trigger, penalized by snoozes.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)
    
    # Get alarms triggered on this day
    alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= day_start,
        Alarm.next_trigger < day_end,
    ).all()
    
    if not alarms:
        return 70  # Default / no data penalty
    
    total = len(alarms)
    dismissed_on_time = 0
    total_snooze_penalty = 0
    
    for alarm in alarms:
        # Each alarm with times_snoozed == 0 counts as "dismissed on time"
        # Each snooze reduces the score
        if alarm.times_snoozed == 0:
            dismissed_on_time += 1
        total_snooze_penalty += min(alarm.times_snoozed, 5)  # Cap at 5 snoozes per alarm
    
    on_time_rate = dismissed_on_time / total
    snooze_penalty = min(total_snooze_penalty / (total * 3), 1.0)  # Normalize penalty
    
    score = int((on_time_rate * 100) * (1 - snooze_penalty * 0.3))
    return max(0, min(100, score))


def _compute_challenge_completion(db: Session, user_id: int, target_date: str) -> int:
    """Compute challenge completion score (0-100).
    
    Weight: 25% of overall habit score.
    Scoring: % of challenge attempts completed (all questions correct) on this day.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)
    
    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= day_start,
        ChallengeAttempt.created_at < day_end,
    ).all()
    
    if not attempts:
        return 50  # Default: no attempts = below average
    
    total = len(attempts)
    completed = sum(1 for a in attempts if a.completed)
    
    # Also factor in accuracy
    total_q = sum(a.total_questions for a in attempts) or 1
    correct = sum(a.correct_answers for a in attempts)
    accuracy = correct / total_q
    
    completion_rate = completed / total
    score = int((completion_rate * 60) + (accuracy * 40))
    return max(0, min(100, score))


def _compute_snooze_reduction(db: Session, user_id: int, target_date: str) -> int:
    """Compute snooze reduction score (0-100).
    
    Weight: 20% of overall habit score.
    Scoring: inverse of total snoozes today vs 7-day average.
    Lower snooze count = higher score.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)
    week_ago = day_start - timedelta(days=7)
    
    # Today's snooze count
    today_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= day_start,
        Alarm.next_trigger < day_end,
    ).all()
    today_snoozes = sum(a.times_snoozed for a in today_alarms)
    
    # 7-day average snooze count
    week_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= week_ago,
        Alarm.next_trigger < day_end,
    ).all()
    
    if not week_alarms:
        return 70  # Default / no data
    
    # Count total snoozes across the week
    total_week_snoozes = sum(a.times_snoozed for a in week_alarms)
    days_with_alarms = len(set(a.next_trigger.date() for a in week_alarms))
    avg_daily_snoozes = total_week_snoozes / max(days_with_alarms, 1)
    
    if avg_daily_snoozes == 0:
        return 100  # Perfect: no snoozes at all
    
    # Score: how much better today is vs average
    reduction_ratio = 1 - (today_snoozes / (avg_daily_snoozes * 2))  # 2x avg = 0 score
    score = int(reduction_ratio * 100)
    return max(0, min(100, score))


def _compute_sleep_adherence(db: Session, user_id: int, target_date: str) -> int:
    """Compute sleep schedule adherence score (0-100).
    
    Weight: 20% of overall habit score.
    Scoring: consistency of alarm trigger times relative to user's preferred wake-up window.
    Uses cron-like regularity of alarm next_trigger times.
    """
    day_start = datetime.strptime(target_date, "%Y-%m-%d")
    week_ago = day_start - timedelta(days=7)
    day_end = day_start + timedelta(days=1)
    
    # Get all alarms in the last 7 days
    week_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id,
        Alarm.next_trigger >= week_ago,
        Alarm.next_trigger < day_end,
        Alarm.is_enabled == True,
    ).all()
    
    if not week_alarms:
        return 60  # Default / no data
    
    # Extract trigger hours and compute consistency
    trigger_hours = [a.next_trigger.hour + a.next_trigger.minute / 60.0 for a in week_alarms]
    
    if len(trigger_hours) < 2:
        return 70
    
    mean_hour = sum(trigger_hours) / len(trigger_hours)
    variance = sum((h - mean_hour) ** 2 for h in trigger_hours) / len(trigger_hours)
    std_dev = variance ** 0.5
    
    # Lower std dev = more consistent schedule
    # std_dev of 0 = perfect (100), std_dev of 3+ hours = poor (0)
    consistency = max(0, 1 - (std_dev / 3.0))
    score = int(consistency * 100)
    return max(0, min(100, score))


@router.get("/score", response_model=dict)
def get_habit_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date: Optional[str] = None,
):
    """Get user's habit score with weighted composite: 35/25/20/20."""
    user_id = current_user.id
    
    if not date:
        date = datetime.utcnow().strftime("%Y-%m-%d")
    
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
    overall = int(wake_up * 0.35 + challenge * 0.25 + snooze * 0.20 + sleep * 0.20)
    
    habit_score = HabitScore(
        user_id=user_id,
        date=date,
        wake_up_consistency=wake_up,
        challenge_completion=challenge,
        snooze_reduction=snooze,
        sleep_schedule_adherence=sleep,
        overall_score=overall,
    )
    db.add(habit_score)
    db.commit()
    db.refresh(habit_score)
    
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
    today = datetime.utcnow().date()
    
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