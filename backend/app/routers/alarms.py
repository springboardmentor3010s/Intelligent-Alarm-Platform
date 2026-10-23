"""Alarm CRUD (fully editable), repeat rules, smart scheduling and the upcoming-schedule endpoint."""
from datetime import timedelta
from uuid import UUID
from zoneinfo import available_timezones

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.timeutil import local_now, utcnow
from app.models import ALARM_TYPES, CHALLENGE_TYPES, LEVELS, SOUNDS, VERIFY_METHODS, Alarm, User
from app.schemas import AlarmIn
from app.services import schedule, verification

router = APIRouter(prefix="/alarms", tags=["Alarms"])


def alarm_view(db: Session, a: Alarm, profile) -> dict:
    return {
        "id": str(a.id), "label": a.label, "time": a.time.isoformat(), "alarm_type": a.alarm_type,
        "repeat_days": schedule.parse_days(a.repeat_days), "one_time_date": a.one_time_date,
        "is_active": a.is_active, "sound": a.sound, "volume": a.volume,
        "challenge_types": [t for t in (a.challenge_types or "").split(",") if t] or None,
        "difficulty_override": a.difficulty_override, "verification_method": a.verification_method,
        "max_snoozes": a.max_snoozes, "snooze_minutes": a.snooze_minutes, "smart_window_minutes": a.smart_window_minutes,
        "effective_time": schedule.effective_time(db, a, profile).strftime("%H:%M"),
        "next_ring_at": schedule.next_ring(db, a, profile) if a.is_active else None,
    }


def _apply(a: Alarm, p: AlarmIn, user: User) -> None:
    a.label, a.time, a.alarm_type, a.is_active = p.label, p.time, p.alarm_type, p.is_active
    a.sound, a.volume = p.sound, p.volume
    a.challenge_types = ",".join(p.challenge_types) if p.challenge_types else None
    a.difficulty_override, a.verification_method = p.difficulty_override, p.verification_method
    a.max_snoozes, a.snooze_minutes, a.smart_window_minutes = p.max_snoozes, p.snooze_minutes, p.smart_window_minutes
    if p.alarm_type == "one_time":
        tz = user.profile.timezone if user.profile else "UTC"
        ln = local_now(tz)
        d = p.one_time_date or (ln.date() if p.time > ln.time().replace(tzinfo=None) else ln.date() + timedelta(days=1))
        a.one_time_date, a.repeat_days = d, ",".join(str(x) for x in range(7))
    else:
        a.one_time_date = None
        a.repeat_days = ",".join(str(x) for x in p.resolved_days())
    a.created_at = utcnow()  # an edit re-arms the alarm: it will not fire retroactively for a time already past


@router.get("/meta")
def meta():
    return {"alarm_types": ALARM_TYPES, "sounds": SOUNDS, "challenge_types": CHALLENGE_TYPES, "levels": LEVELS,
            "verification_methods": [{"id": m, "description": verification.DESCRIPTIONS[m]} for m in VERIFY_METHODS],
            "timezones": sorted(z for z in available_timezones() if "/" in z and not z.startswith(("Etc/", "posix", "right")))}


@router.get("/schedule")
def upcoming(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = []
    for a in db.query(Alarm).filter(Alarm.user_id == user.id, Alarm.is_active.is_(True)).all():
        r = schedule.next_ring(db, a, user.profile)
        if r:
            items.append({"alarm_id": str(a.id), "label": a.label, "ring_at": r})
    items.sort(key=lambda x: x["ring_at"])
    return {"server_now": utcnow(), "next": items[0] if items else None, "upcoming": items[:5]}


@router.get("")
def list_alarms(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Alarm).filter(Alarm.user_id == user.id).order_by(Alarm.time.asc()).all()
    return [alarm_view(db, a, user.profile) for a in rows]


@router.post("", status_code=201)
def create_alarm(payload: AlarmIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(Alarm).filter(Alarm.user_id == user.id).count() >= settings.MAX_ALARMS_PER_USER:
        raise HTTPException(409, f"You can have at most {settings.MAX_ALARMS_PER_USER} alarms.")
    a = Alarm(user_id=user.id, time=payload.time)
    _apply(a, payload, user)
    db.add(a)
    db.commit()
    return alarm_view(db, a, user.profile)


def _owned(db: Session, user: User, alarm_id: UUID) -> Alarm:
    a = db.query(Alarm).filter(Alarm.id == alarm_id, Alarm.user_id == user.id).first()
    if not a:
        raise HTTPException(404, "Alarm not found.")
    return a


@router.put("/{alarm_id}")
def update_alarm(alarm_id: UUID, payload: AlarmIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _owned(db, user, alarm_id)
    _apply(a, payload, user)
    db.commit()
    return alarm_view(db, a, user.profile)


@router.post("/{alarm_id}/toggle")
def toggle(alarm_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _owned(db, user, alarm_id)
    a.is_active = not a.is_active
    if a.is_active:
        a.created_at = utcnow()
    db.commit()
    return alarm_view(db, a, user.profile)


@router.delete("/{alarm_id}")
def delete_alarm(alarm_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, user, alarm_id))
    db.commit()
    return {"ok": True}
