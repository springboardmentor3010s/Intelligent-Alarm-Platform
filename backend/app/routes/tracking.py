from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user, user_scope
from app.db.database import get_db
from app.models.productivity_log import ProductivityLog
from app.models.recommendation_event import RecommendationEvent
from app.models.sleep_log import SleepLog
from app.models.user import User
from app.services.alarm_service import user_tz

router = APIRouter(
    prefix="/tracking",
    tags=["Sleep, Productivity and Engagement Tracking"],
    dependencies=[Depends(user_scope)],
)


class SleepLogRequest(BaseModel):
    user_id: int | None = None
    sleep_date: date = Field(description="Date of the morning you woke up")
    bed_time: datetime
    wake_time: datetime
    quality: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=500)


class ProductivityLogRequest(BaseModel):
    user_id: int | None = None
    log_date: date
    rating: int = Field(ge=1, le=10)
    tasks_planned: int | None = Field(default=None, ge=0, le=500)
    tasks_completed: int | None = Field(default=None, ge=0, le=500)
    focus_minutes: int | None = Field(default=None, ge=0, le=1440)
    notes: str | None = Field(default=None, max_length=500)


class RecommendationEventRequest(BaseModel):
    user_id: int | None = None
    recommendation_id: str = Field(min_length=1, max_length=80)
    action: Literal["viewed", "accepted", "dismissed"]
    source: str = Field(default="dashboard", max_length=30)


def _target_user(db: Session, current: User, user_id: int | None) -> User:
    user = db.get(User, user_id or current.id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


def _aware(value: datetime, user: User) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=user_tz(user))
    return value


def _sleep_dict(row: SleepLog) -> dict:
    return {
        "id": row.id,
        "sleep_date": row.sleep_date.isoformat(),
        "bed_time": row.bed_time,
        "wake_time": row.wake_time,
        "duration_minutes": row.duration_minutes,
        "quality": row.quality,
        "notes": row.notes,
    }


def _productivity_dict(row: ProductivityLog) -> dict:
    return {
        "id": row.id,
        "log_date": row.log_date.isoformat(),
        "rating": row.rating,
        "tasks_planned": row.tasks_planned,
        "tasks_completed": row.tasks_completed,
        "focus_minutes": row.focus_minutes,
        "notes": row.notes,
    }


# ---------------------------------------------------------
# SLEEP
# ---------------------------------------------------------

@router.post("/sleep", status_code=201)
def save_sleep(
    body: SleepLogRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a night of sleep. One entry per date; saving again replaces it."""
    user = _target_user(db, current, body.user_id)
    bed = _aware(body.bed_time, user)
    wake = _aware(body.wake_time, user)
    minutes = int((wake - bed).total_seconds() // 60)

    if minutes < 60 or minutes > 20 * 60:
        raise HTTPException(
            status_code=400,
            detail="Sleep must be between 1 and 20 hours. Check the times.",
        )
    if body.sleep_date > datetime.now(timezone.utc).date() + timedelta(days=1):
        raise HTTPException(status_code=400, detail="The date is in the future.")

    row = db.execute(
        select(SleepLog).where(
            SleepLog.user_id == user.id, SleepLog.sleep_date == body.sleep_date
        )
    ).scalar_one_or_none()
    if row is None:
        row = SleepLog(user_id=user.id, sleep_date=body.sleep_date)
        db.add(row)
    row.bed_time, row.wake_time = bed, wake
    row.duration_minutes = minutes
    row.quality, row.notes = body.quality, body.notes
    db.commit()
    db.refresh(row)
    return _sleep_dict(row)


@router.get("/sleep/{user_id}")
def list_sleep(user_id: int, days: int = 30, db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc).date() - timedelta(days=max(1, min(days, 365)))
    rows = db.execute(
        select(SleepLog)
        .where(SleepLog.user_id == user_id, SleepLog.sleep_date >= since)
        .order_by(SleepLog.sleep_date.desc())
    ).scalars().all()
    return {"items": [_sleep_dict(r) for r in rows]}


@router.delete("/sleep/{user_id}/{log_id}")
def delete_sleep(user_id: int, log_id: int, db: Session = Depends(get_db)):
    row = db.get(SleepLog, log_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Sleep entry not found.")
    db.delete(row)
    db.commit()
    return {"message": "Sleep entry deleted."}


# ---------------------------------------------------------
# PRODUCTIVITY
# ---------------------------------------------------------

@router.post("/productivity", status_code=201)
def save_productivity(
    body: ProductivityLogRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _target_user(db, current, body.user_id)
    if (
        body.tasks_planned is not None
        and body.tasks_completed is not None
        and body.tasks_completed > body.tasks_planned
    ):
        raise HTTPException(
            status_code=400,
            detail="Completed tasks cannot be more than planned tasks.",
        )

    row = db.execute(
        select(ProductivityLog).where(
            ProductivityLog.user_id == user.id,
            ProductivityLog.log_date == body.log_date,
        )
    ).scalar_one_or_none()
    if row is None:
        row = ProductivityLog(user_id=user.id, log_date=body.log_date, rating=body.rating)
        db.add(row)
    row.rating = body.rating
    row.tasks_planned = body.tasks_planned
    row.tasks_completed = body.tasks_completed
    row.focus_minutes = body.focus_minutes
    row.notes = body.notes
    db.commit()
    db.refresh(row)
    return _productivity_dict(row)


@router.get("/productivity/{user_id}")
def list_productivity(user_id: int, days: int = 30, db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc).date() - timedelta(days=max(1, min(days, 365)))
    rows = db.execute(
        select(ProductivityLog)
        .where(ProductivityLog.user_id == user_id, ProductivityLog.log_date >= since)
        .order_by(ProductivityLog.log_date.desc())
    ).scalars().all()
    return {"items": [_productivity_dict(r) for r in rows]}


@router.delete("/productivity/{user_id}/{log_id}")
def delete_productivity(user_id: int, log_id: int, db: Session = Depends(get_db)):
    row = db.get(ProductivityLog, log_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Entry not found.")
    db.delete(row)
    db.commit()
    return {"message": "Entry deleted."}


# ---------------------------------------------------------
# RECOMMENDATION ENGAGEMENT
# ---------------------------------------------------------

@router.post("/recommendation-events", status_code=201)
def record_recommendation_event(
    body: RecommendationEventRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _target_user(db, current, body.user_id)
    db.add(
        RecommendationEvent(
            user_id=user.id,
            recommendation_id=body.recommendation_id,
            action=body.action,
            source=body.source,
        )
    )
    db.commit()
    return {"message": "Recorded."}
