from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.db.database import get_db
from app.core.security import get_current_user
from app.services.habit_scoring import calculate_habit_score
from app.services.behavioral_analytics import calculate_behavioral_summary
from app.services.recommendation_engine import generate_recommendations
from app.models.models import WakeUpSession, UserProfile
from app.schemas.schemas import StreakOut

router = APIRouter(prefix="/analytics", tags=["Analytics M3"])


@router.get("/streak", response_model=StreakOut)
def streak(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Consecutive days with at least one WAKE_UP_VERIFIED session."""
    sessions = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.user_id == current_user.id,
            WakeUpSession.status == "WAKE_UP_VERIFIED",
            WakeUpSession.verified_at.isnot(None),
        )
        .all()
    )
    verified_dates = sorted({s.verified_at.date() for s in sessions}, reverse=True)

    current_streak = 0
    longest_streak = 0
    if verified_dates:
        # current streak — count back from today
        check = date.today()
        for d in verified_dates:
            if d == check or d == check - timedelta(days=1):
                current_streak += 1
                check = d - timedelta(days=1) if d == check else check - timedelta(days=2)
            else:
                break
        # longest streak
        run = 1
        for i in range(1, len(verified_dates)):
            if (verified_dates[i - 1] - verified_dates[i]).days == 1:
                run += 1
                longest_streak = max(longest_streak, run)
            else:
                run = 1
        longest_streak = max(longest_streak, run, current_streak)

    return StreakOut(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_verified_date=str(verified_dates[0]) if verified_dates else None,
    )


@router.get("/sleep-debt")
def sleep_debt(
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Compare intended sleep duration vs actual wake-up deviation over `days`."""
    from datetime import datetime, timedelta as td
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    intended_hours = profile.sleep_duration if profile else 8
    preferred_str = profile.preferred_wake_up_time if profile else "07:00"
    try:
        ph, pm = map(int, preferred_str.split(":"))
        preferred_minutes = ph * 60 + pm
    except Exception:
        preferred_minutes = 7 * 60

    cutoff = datetime.now() - td(days=days)
    sessions = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.user_id == current_user.id,
            WakeUpSession.status == "WAKE_UP_VERIFIED",
            WakeUpSession.verified_at.isnot(None),
            WakeUpSession.started_at >= cutoff,
        )
        .all()
    )

    daily_debt = []
    total_debt_minutes = 0
    for s in sessions:
        actual_minutes = s.verified_at.hour * 60 + s.verified_at.minute
        diff = actual_minutes - preferred_minutes
        # positive = woke up late (sleep debt), negative = woke up early
        total_debt_minutes += max(0, diff)
        daily_debt.append({
            "date": str(s.verified_at.date()),
            "actual_wake": s.verified_at.strftime("%H:%M"),
            "target_wake": preferred_str,
            "deviation_minutes": diff,
        })

    avg_debt = round(total_debt_minutes / len(sessions), 1) if sessions else 0.0
    return {
        "intended_sleep_hours": intended_hours,
        "target_wake_time": preferred_str,
        "days": days,
        "sessions_analysed": len(sessions),
        "total_late_minutes": total_debt_minutes,
        "avg_late_minutes_per_day": avg_debt,
        "daily": sorted(daily_debt, key=lambda x: x["date"], reverse=True),
    }


@router.get("/habit-score")
def habit_score(
    days: int = Query(default=7, ge=1, le=90, description="Analysis window in days"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Official habit score with full component breakdown.

    Formula:
        Wake-Up Consistency   × 35%
      + Challenge Completion  × 25%
      + Snooze Reduction      × 20%
      + Sleep Adherence       × 20%
    """
    return calculate_habit_score(db, current_user.id, days)


@router.get("/behavioral")
def behavioral(
    days: int = Query(default=7, ge=1, le=90, description="Analysis window in days"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Behavioral analytics summary for the given time window.
    Returns wakeup consistency, challenge completion, snooze behavior,
    and sleep adherence — each with detailed sub-metrics.
    """
    return calculate_behavioral_summary(db, current_user.id, days)


@router.get("/recommendations")
def recommendations(
    days: int = Query(default=7, ge=1, le=90, description="Analysis window in days"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Rule-based personalized recommendations based on behavioral analytics.
    NOT machine learning — deterministic rule-based engine.
    """
    return generate_recommendations(db, current_user.id, days)


@router.get("/user/{user_id}/streak", response_model=StreakOut)
def streak_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Admin/Coach: get streak data for any user."""
    from app.core.security import require_role
    if current_user.role not in ("ADMINISTRATOR", "WELLNESS_COACH"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    sessions = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.user_id == user_id,
            WakeUpSession.status == "WAKE_UP_VERIFIED",
            WakeUpSession.verified_at.isnot(None),
        )
        .all()
    )
    verified_dates = sorted({s.verified_at.date() for s in sessions}, reverse=True)
    current_streak = longest_streak = 0
    if verified_dates:
        check = date.today()
        for d in verified_dates:
            if d == check or d == check - timedelta(days=1):
                current_streak += 1
                check = d - timedelta(days=1) if d == check else check - timedelta(days=2)
            else:
                break
        run = 1
        for i in range(1, len(verified_dates)):
            if (verified_dates[i - 1] - verified_dates[i]).days == 1:
                run += 1
                longest_streak = max(longest_streak, run)
            else:
                run = 1
        longest_streak = max(longest_streak, run, current_streak)
    return StreakOut(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_verified_date=str(verified_dates[0]) if verified_dates else None,
    )


@router.get("/user/{user_id}/recommendations")
def recommendations_for_user(
    user_id: int,
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Admin/Coach: get recommendations for any user."""
    if current_user.role not in ("ADMINISTRATOR", "WELLNESS_COACH"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return generate_recommendations(db, user_id, days)
