"""Alarm service for Intelligent Cognitive Alarm Platform.

Owns the full alarm lifecycle: timezone-aware next_trigger computation,
challenge linking, CRUD, snooze, and dismissal (including the habit-score
refresh). Routers delegate here so `api/alarms.py` stays thin.
"""

from datetime import datetime, timedelta, time as dtime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import User, Alarm, Challenge
from ..schemas import AlarmCreateReq, AlarmDismissReq, AlarmRes, DismissRes
from ..services.habit_scoring_service import refresh_habit_score
from ..services.verification_service import verify_finished_attempt


def _user_tz(current_user: User) -> ZoneInfo:
    """Resolve the user's IANA timezone with a UTC fallback."""
    tz_name = current_user.timezone or "UTC"
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo("UTC")


def _parse_time(value) -> dtime | None:
    """Parse an HH:MM string into a datetime.time, or None."""
    if not value:
        return None
    try:
        hour, minute = value.split(":")
        return dtime(hour=int(hour), minute=int(minute))
    except (ValueError, AttributeError):
        return None


def _compute_next_trigger(alarm_type: str, wake_time: dtime, tz: ZoneInfo) -> datetime:
    """Compute the next alarm trigger (local tz) for the given type and wake time."""
    now = datetime.now(tz)
    start = now.replace(hour=wake_time.hour, minute=wake_time.minute, second=0, microsecond=0)

    if alarm_type == "One-Time":
        return start if start > now else start + timedelta(days=1)

    if alarm_type == "Weekday":
        for i in range(1, 8):
            candidate = (now + timedelta(days=i)).replace(
                hour=wake_time.hour, minute=wake_time.minute, second=0, microsecond=0
            )
            if candidate.weekday() < 5:  # Mon-Fri
                return candidate
        return start

    if alarm_type == "Weekend":
        for i in range(1, 8):
            candidate = (now + timedelta(days=i)).replace(
                hour=wake_time.hour, minute=wake_time.minute, second=0, microsecond=0
            )
            if candidate.weekday() >= 5:  # Sat/Sun
                return candidate
        return start

    # Daily (and any other type): next occurrence after now
    return start if start > now else start + timedelta(days=1)


def _link_challenge(db: Session, challenge_type: str, difficulty: str) -> Challenge:
    """Return an active Challenge for the given type/difficulty, creating it if missing."""
    challenge = (
        db.query(Challenge)
        .filter(Challenge.challenge_type == challenge_type, Challenge.difficulty == difficulty)
        .first()
    )
    if challenge is None:
        challenge = Challenge(
            title=f"{challenge_type} challenge",
            description=f"Adaptive {challenge_type} challenge at {difficulty} difficulty",
            challenge_type=challenge_type,
            difficulty=difficulty,
            is_active=True,
        )
        db.add(challenge)
        db.flush()
    return challenge


def _to_alarm_res(alarm: Alarm) -> AlarmRes:
    """Serialize an Alarm ORM object, pulling challenge metadata from its linked Challenge."""
    tz = _user_tz(alarm.user)
    next_trigger = alarm.next_trigger
    if next_trigger is not None and next_trigger.tzinfo is None:
        next_trigger = next_trigger.replace(tzinfo=timezone.utc)
    local_time = next_trigger.astimezone(tz) if next_trigger else None
    return AlarmRes(
        id=alarm.id,
        user_id=alarm.user_id,
        title=alarm.title,
        alarm_type=alarm.alarm_type,
        next_trigger=next_trigger,
        is_enabled=alarm.is_enabled,
        challenge_id=alarm.challenge_id,
        challenge_type=alarm.challenge.challenge_type if alarm.challenge else None,
        difficulty=alarm.challenge.difficulty if alarm.challenge else None,
        recurrence=alarm.recurrence,
        time=local_time.strftime("%H:%M") if local_time else None,
        times_snoozed=alarm.times_snoozed,
        created_at=alarm.created_at,
    )


def _find_owned_alarm(db: Session, user_id: int, alarm_id: int) -> Alarm:
    """Return the user's alarm or raise a 404 (matches legacy behavior)."""
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == user_id,
    ).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return alarm


def list_alarms(db: Session, user_id: int) -> list[AlarmRes]:
    """List all alarms for the current user."""
    alarms = db.query(Alarm).filter(Alarm.user_id == user_id).all()
    return [_to_alarm_res(a) for a in alarms]


def create_alarm(db: Session, user: User, payload: AlarmCreateReq) -> AlarmRes:
    """Create a new alarm with auto-computed, timezone-aware next_trigger."""
    tz = _user_tz(user)

    if payload.next_trigger:
        next_trigger = payload.next_trigger
    else:
        wake_time = _parse_time(payload.time) or dtime(hour=7, minute=0)
        # Compute in the user's zone, then store as UTC-aware datetime
        next_trigger = _compute_next_trigger(payload.type, wake_time, tz).astimezone(timezone.utc)

    challenge_id = None
    if payload.challenge_type:
        challenge = _link_challenge(db, payload.challenge_type, payload.difficulty or "Medium")
        challenge_id = challenge.id

    alarm = Alarm(
        user_id=user.id,
        title=payload.title,
        alarm_type=payload.type,
        is_enabled=True,
        times_snoozed=0,
        next_trigger=next_trigger,
        challenge_id=challenge_id,
        recurrence=payload.recurrence,
    )
    db.add(alarm)
    db.commit()
    db.refresh(alarm)
    return _to_alarm_res(alarm)


def update_alarm(
    db: Session, user: User, alarm_id: int, payload: AlarmCreateReq
) -> AlarmRes:
    """Update an existing alarm."""
    alarm = _find_owned_alarm(db, user.id, alarm_id)

    alarm.title = payload.title
    alarm.alarm_type = payload.type

    tz = _user_tz(user)
    if payload.next_trigger:
        alarm.next_trigger = payload.next_trigger
    elif payload.time:
        wake_time = _parse_time(payload.time)
        if wake_time:
            alarm.next_trigger = _compute_next_trigger(payload.type, wake_time, tz).astimezone(timezone.utc)

    if payload.challenge_type:
        challenge = _link_challenge(db, payload.challenge_type, payload.difficulty or "Medium")
        alarm.challenge_id = challenge.id
    if payload.recurrence is not None:
        alarm.recurrence = payload.recurrence

    db.commit()
    db.refresh(alarm)
    return _to_alarm_res(alarm)


def delete_alarm(db: Session, user_id: int, alarm_id: int) -> dict:
    """Delete an alarm."""
    alarm = _find_owned_alarm(db, user_id, alarm_id)
    db.delete(alarm)
    db.commit()
    return {"status": "success", "message": "Alarm deleted"}


def snooze_alarm(db: Session, user_id: int, alarm_id: int) -> AlarmRes:
    """Snooze an alarm — increment snooze count and push next_trigger by 5 minutes."""
    alarm = _find_owned_alarm(db, user_id, alarm_id)

    if not alarm.is_enabled:
        raise HTTPException(status_code=400, detail="Alarm already dismissed")

    # Cap snoozes at 5
    if alarm.times_snoozed >= 5:
        raise HTTPException(status_code=400, detail="Maximum snooze limit reached")

    alarm.times_snoozed += 1

    # Snooze postpones the alarm: +5 minutes from its scheduled time, but never
    # earlier than 5 minutes from now (covers alarms that are already ringing).
    base = alarm.next_trigger or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    base = max(datetime.now(timezone.utc), base)
    alarm.next_trigger = base + timedelta(minutes=5)

    db.commit()
    db.refresh(alarm)
    return _to_alarm_res(alarm)


def dismiss_alarm(
    db: Session, user: User, alarm_id: int, request: AlarmDismissReq
) -> DismissRes:
    """Dismiss an alarm by verifying challenge completion.

    Flow:
    1. Verify alarm belongs to current user and is enabled
    2. Verify challenge attempt exists and was completed successfully
    3. Mark alarm as dismissed, compute next trigger for recurring alarms
    4. Update habit score with fresh computation
    """
    alarm = _find_owned_alarm(db, user.id, alarm_id)

    if not alarm.is_enabled:
        raise HTTPException(status_code=400, detail="Alarm already dismissed")

    # Verify the challenge completed correctly (all questions correct)
    verify_finished_attempt(db, user.id, request.challenge_attempt_id)

    # Mark alarm as dismissed (disabled)
    alarm.is_enabled = False

    # Compute next trigger for recurring alarms, preserving the alarm's wake-up time
    if alarm.alarm_type != "One-Time":
        tz = _user_tz(user)
        if alarm.next_trigger:
            nt = alarm.next_trigger
            if nt.tzinfo is None:
                nt = nt.replace(tzinfo=timezone.utc)
            local_nt = nt.astimezone(tz)
            hour, minute = local_nt.hour, local_nt.minute
        else:
            hour, minute = 7, 0
        wake_time = dtime(hour=hour, minute=minute)
        next_trigger = _compute_next_trigger(alarm.alarm_type, wake_time, tz).astimezone(timezone.utc)
        alarm.next_trigger = next_trigger
        alarm.is_enabled = True
    # OneTime alarms stay disabled

    # Update habit score using the proper weighted computation
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    refresh_habit_score(db, user.id, today)

    return DismissRes(
        alarm_id=alarm.id,
        successfully_dismissed=True,
        new_habit_score_update=True,
        next_trigger=alarm.next_trigger.isoformat() if alarm.next_trigger and alarm.is_enabled else None,
    )
