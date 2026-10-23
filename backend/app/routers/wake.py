"""Ringing sessions: the active alarm, answering challenges, snoozing, test rings and history."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.ratelimit import limit
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.timeutil import local_now, utcnow
from app.models import Alarm, WakeSession, User
from app.schemas import AnswerIn, TestRingIn
from app.services import verification, wake as wake_svc
from app.services.analytics import finished_sessions

router = APIRouter(prefix="/wake", tags=["Wake-up verification"])


def _own(db: Session, user: User, sid: UUID) -> WakeSession:
    s = db.query(WakeSession).filter(WakeSession.id == sid, WakeSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Alarm session not found.")
    return s


@router.get("/active")
def active(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(WakeSession).filter(WakeSession.user_id == user.id, WakeSession.status.in_(["ringing", "snoozed"]))
            .order_by(WakeSession.started_at.asc()).all())
    rows.sort(key=lambda s: 0 if s.status == "ringing" else 1)
    if not rows:
        return {"session": None}
    view = wake_svc.session_view(db, rows[0])
    db.commit()  # persists a freshly issued challenge
    return {"session": view}


@router.post("/{session_id}/answer", dependencies=[Depends(limit("answer", 90, 60))])
def answer(session_id: UUID, payload: AnswerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return wake_svc.answer(db, _own(db, user, session_id), payload.instance_id, payload.answer)


@router.post("/{session_id}/snooze")
def snooze(session_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return wake_svc.snooze(db, _own(db, user, session_id))


@router.post("/test", dependencies=[Depends(limit("testring", 12, 60))])
def test_ring(payload: TestRingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Practice ring: identical experience to a real alarm but excluded from all statistics."""
    for old in db.query(WakeSession).filter(WakeSession.user_id == user.id, WakeSession.is_practice.is_(True),
                                            WakeSession.status.in_(["ringing", "snoozed"])).all():
        old.status = "missed"
    alarm = db.query(Alarm).filter(Alarm.id == payload.alarm_id, Alarm.user_id == user.id).first() if payload.alarm_id else None
    tz = user.profile.timezone if user.profile else "UTC"
    s = WakeSession(user_id=user.id, alarm_id=None, is_practice=True, label=(alarm.label if alarm else "Test alarm"),
                    local_date=local_now(tz).date(), scheduled_at=utcnow(), status="ringing",
                    sound=alarm.sound if alarm else "classic", volume=alarm.volume if alarm else 80,
                    max_snoozes=alarm.max_snoozes if alarm else 2, snooze_minutes=1,
                    difficulty=(alarm.difficulty_override if alarm and alarm.difficulty_override else
                                (user.profile.current_difficulty if user.profile else "easy")))
    verification.init_session(s, alarm.verification_method if alarm else "puzzle")
    db.add(s)
    db.flush()
    view = wake_svc.session_view(db, s)
    db.commit()
    return {"session": view}


@router.post("/{session_id}/cancel")
def cancel_practice(session_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _own(db, user, session_id)
    if not s.is_practice:
        raise HTTPException(409, "Only test alarms can be cancelled — solve the challenge to dismiss a real alarm.")
    s.status = "missed"
    db.commit()
    return {"ok": True}


@router.get("/history")
def history(days: int = 30, limit_: int = 100, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    days, limit_ = max(1, min(days, 365)), max(1, min(limit_, 300))
    rows = list(reversed(finished_sessions(db, user.id, days)))[:limit_]
    return [{"id": str(s.id), "label": s.label, "date": s.local_date, "scheduled_at": s.scheduled_at,
             "status": s.status, "snoozes": s.snooze_count, "wrong_answers": s.wrong_count,
             "method": s.verification_method, "alertness": s.alertness_score,
             "seconds_to_dismiss": round((s.dismissed_at - s.started_at).total_seconds()) if s.dismissed_at else None}
            for s in rows]
