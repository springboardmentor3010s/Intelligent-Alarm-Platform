"""Daily sleep & productivity check-ins (feeds sleep analytics, habit scoring and productivity correlation)."""
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import SleepLog, User
from app.schemas import SleepLogIn
from app.services.analytics import today_of

router = APIRouter(prefix="/sleep", tags=["Sleep"])


def _view(l: SleepLog) -> dict:
    return {"id": str(l.id), "log_date": l.log_date, "bedtime": l.bedtime.strftime("%H:%M"),
            "wake_time": l.wake_time.strftime("%H:%M"), "duration_minutes": l.duration_minutes,
            "quality": l.quality, "productivity": l.productivity}


@router.get("")
def list_logs(days: int = 60, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    since = today_of(db, user.id) - timedelta(days=max(1, min(days, 365)))
    rows = db.query(SleepLog).filter(SleepLog.user_id == user.id, SleepLog.log_date >= since) \
        .order_by(SleepLog.log_date.desc()).all()
    return [_view(r) for r in rows]


@router.put("")
def upsert(payload: SleepLogIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = today_of(db, user.id)
    if payload.log_date > today + timedelta(days=1) or payload.log_date < today - timedelta(days=365):
        raise HTTPException(422, "Date is out of range.")
    start = datetime.combine(payload.log_date, payload.bedtime)
    end = datetime.combine(payload.log_date, payload.wake_time)
    if end <= start:
        start -= timedelta(days=1)  # bedtime was the evening before
    minutes = int((end - start).total_seconds() // 60)
    if not 60 <= minutes <= 18 * 60:
        raise HTTPException(422, "Sleep duration must be between 1 and 18 hours.")
    row = db.query(SleepLog).filter(SleepLog.user_id == user.id, SleepLog.log_date == payload.log_date).first() \
        or SleepLog(user_id=user.id, log_date=payload.log_date)
    row.bedtime, row.wake_time, row.duration_minutes = payload.bedtime, payload.wake_time, minutes
    row.quality, row.productivity = payload.quality, payload.productivity
    db.add(row)
    db.commit()
    return _view(row)


@router.delete("/{log_id}")
def delete(log_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SleepLog).filter(SleepLog.id == log_id, SleepLog.user_id == user.id).first()
    if not row:
        raise HTTPException(404, "Log not found.")
    db.delete(row)
    db.commit()
    return {"ok": True}
