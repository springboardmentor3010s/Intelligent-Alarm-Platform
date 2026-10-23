"""Dashboard analytics: habit score, behaviour, challenge performance, sleep, productivity, recommendations."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Recommendation, User
from app.services import analytics as A, recommendations as R

router = APIRouter(prefix="/insights", tags=["Analytics"])


def rec_view(r: Recommendation) -> dict:
    return {"id": str(r.id), "category": r.category, "title": r.title, "body": r.body,
            "is_dismissed": r.is_dismissed, "created_at": r.created_at}


@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    A.store_habit_score(db, user.id)  # keeps a daily history point for the trend chart
    db.commit()
    p = user.profile
    return {
        "habit": A.compute_habit_score(db, user.id), "wake": A.wake_stats(db, user.id, 14),
        "snooze": A.snooze_pattern(db, user.id), "challenges": A.challenge_stats(db, user.id, 30),
        "sleep": A.sleep_stats(db, user.id, 14), "productivity": A.productivity_correlation(db, user.id),
        "goal": {"target_streak": p.wake_goal_streak if p else 21, "current_streak": A.streaks(db, user.id)["current"],
                 "productivity_goal": p.productivity_goal if p else None},
    }


@router.get("/habit-history")
def habit_history(days: int = 30, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return A.habit_history(db, user.id, max(1, min(days, 365)))


@router.get("/challenges")
def challenges(days: int = 30, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return A.challenge_stats(db, user.id, max(1, min(days, 365)))


@router.get("/sleep")
def sleep(days: int = 30, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"sleep": A.sleep_stats(db, user.id, max(1, min(days, 365))),
            "productivity": A.productivity_correlation(db, user.id)}


@router.get("/behavior")
def behavior(days: int = 28, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = max(1, min(days, 365))
    return {"wake": A.wake_stats(db, user.id, d), "snooze": A.snooze_pattern(db, user.id, d),
            "challenges": A.challenge_stats(db, user.id, d)}


@router.get("/recommendations")
def recommendations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [rec_view(r) for r in R.refresh(db, user.id)]


@router.post("/recommendations/{rec_id}/dismiss")
def dismiss(rec_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(Recommendation).filter(Recommendation.id == rec_id, Recommendation.user_id == user.id).first()
    if not r:
        raise HTTPException(404, "Recommendation not found.")
    r.is_dismissed = True
    db.commit()
    return {"ok": True}
