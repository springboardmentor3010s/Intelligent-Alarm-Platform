"""Background scheduler: opens ringing sessions on time, wakes snoozed alarms, records missed alarms,
sends bedtime reminders. `tick` is a plain function so it can be unit-tested with a fake clock."""
import logging
import time
from datetime import timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.timeutil import local_now, local_to_utc, utcnow
from app.models import Alarm, UserProfile, WakeSession
from app.services import schedule, verification
from app.services.notify import notify

log = logging.getLogger("wakeful.jobs")
state = {"last_tick": None, "ticks": 0, "last_error": None}


def open_session(db: Session, alarm: Alarm, profile: UserProfile | None, local_date, ring_at, status="ringing"):
    s = WakeSession(
        user_id=alarm.user_id, alarm_id=alarm.id, label=alarm.label, local_date=local_date,
        scheduled_at=ring_at, status=status, sound=alarm.sound, volume=alarm.volume,
        max_snoozes=alarm.max_snoozes, snooze_minutes=alarm.snooze_minutes,
        difficulty=alarm.difficulty_override or (profile.current_difficulty if profile else "easy"),
        started_at=utcnow(), last_ring_at=utcnow(),
    )
    verification.init_session(s, alarm.verification_method)
    db.add(s)
    return s


def tick(db: Session, now=None, reminders: bool = True) -> dict:
    now = now or utcnow()
    out = {"opened": 0, "missed": 0, "woken_from_snooze": 0, "reminders": 0}

    # 1) open sessions for alarms that are due
    rows = (db.query(Alarm, UserProfile).outerjoin(UserProfile, UserProfile.user_id == Alarm.user_id)
            .filter(Alarm.is_active.is_(True)).all())
    for alarm, profile in rows:
        tz = profile.timezone if profile else "UTC"
        today = local_now(tz, now).date()
        ring = schedule.ring_utc(db, alarm, profile, today)
        if not ring or ring > now or ring < alarm.created_at:
            continue
        exists = db.query(WakeSession.id).filter(WakeSession.alarm_id == alarm.id,
                                                 WakeSession.local_date == today).first()
        if exists:
            continue
        if now - ring <= timedelta(minutes=settings.RING_GRACE_MINUTES):
            s = open_session(db, alarm, profile, today, ring)
            notify(db, alarm.user_id, "wake", f"⏰ {alarm.label} is ringing",
                   f"Your {alarm.label} alarm is ringing. Open Wakeful and solve the challenge to dismiss it.",
                   dedupe_key=f"ring:{alarm.id}:{today}")
            out["opened"] += 1
        else:
            open_session(db, alarm, profile, today, ring, status="missed")
            notify(db, alarm.user_id, "habit", f"Missed: {alarm.label}",
                   f"The {alarm.label} alarm rang while Wakeful wasn't open, so it was recorded as missed.",
                   dedupe_key=f"missed:{alarm.id}:{today}")
            out["missed"] += 1
        if alarm.one_time_date:
            alarm.is_active = False

    # 2) snooze finished -> ring again
    for s in db.query(WakeSession).filter(WakeSession.status == "snoozed", WakeSession.snoozed_until <= now).all():
        s.status, s.last_ring_at, s.snoozed_until = "ringing", now, None
        out["woken_from_snooze"] += 1

    # 3) nobody responded for too long -> missed
    cutoff = now - timedelta(minutes=settings.MISSED_AFTER_MINUTES)
    for s in db.query(WakeSession).filter(WakeSession.status == "ringing", WakeSession.last_ring_at < cutoff).all():
        s.status = "missed"
        if not s.is_practice:
            notify(db, s.user_id, "habit", f"Missed: {s.label}",
                   "The alarm rang for a long time without being dismissed, so it was recorded as missed.",
                   dedupe_key=f"missed-s:{s.id}")
        out["missed"] += 1

    # 4) bedtime reminders (30 minutes before the user's bedtime)
    for p in (db.query(UserProfile).filter(UserProfile.bedtime.isnot(None), UserProfile.bedtime_reminders.is_(True),
                                          UserProfile.onboarded.is_(True)).all() if reminders else []):
        ln = local_now(p.timezone, now)
        remind_at = local_to_utc(ln.date(), p.bedtime, p.timezone) - timedelta(minutes=30)
        if remind_at <= now <= remind_at + timedelta(minutes=10):
            if notify(db, p.user_id, "bedtime", "Time to wind down 🌙",
                      "Your bedtime is in about 30 minutes. Put screens away and get ready to rest.",
                      dedupe_key=f"bed:{ln.date()}"):
                out["reminders"] += 1
    db.commit()
    return out


def _run():
    db = SessionLocal()
    try:
        tick(db, reminders=int(time.time()) % 30 < settings.SCHEDULER_INTERVAL_SECONDS)
        state["last_tick"], state["last_error"] = utcnow(), None
        state["ticks"] += 1
    except Exception as exc:  # keep the scheduler alive no matter what
        db.rollback()
        state["last_error"] = str(exc)[:200]
        log.exception("scheduler tick failed")
    finally:
        db.close()


_scheduler: BackgroundScheduler | None = None


def start():
    global _scheduler
    if _scheduler or not settings.SCHEDULER_ENABLED:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_run, "interval", seconds=max(1, settings.SCHEDULER_INTERVAL_SECONDS), max_instances=1, coalesce=True, id="wakeful-tick")
    _scheduler.start()
    log.info("Alarm scheduler started (%ss interval)", settings.SCHEDULER_INTERVAL_SECONDS)


def stop():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
