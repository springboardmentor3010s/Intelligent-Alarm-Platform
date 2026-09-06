"""Alarm routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, time as dtime, timezone
from zoneinfo import ZoneInfo
from ..database import get_db
from ..Models import User, Alarm, Challenge, ChallengeAttempt, HabitScore
from ..schemas import AlarmCreateReq, AlarmDismissReq, AlarmRes, DismissRes
from ..api.deps import get_current_user

router = APIRouter(prefix="/alarms", tags=["alarms"])


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


@router.get("", response_model=list[AlarmRes])
def list_alarms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all alarms for the current user."""
    alarms = db.query(Alarm).filter(Alarm.user_id == current_user.id).all()
    return [_to_alarm_res(a) for a in alarms]


@router.post("", response_model=AlarmRes)
def create_alarm(
    payload: AlarmCreateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new alarm with auto-computed, timezone-aware next_trigger."""
    tz = _user_tz(current_user)

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
        user_id=current_user.id,
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


@router.put("/{alarm_id}", response_model=AlarmRes)
def update_alarm(
    alarm_id: int,
    payload: AlarmCreateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing alarm."""
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id,
    ).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    alarm.title = payload.title
    alarm.alarm_type = payload.type

    tz = _user_tz(current_user)
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


@router.delete("/{alarm_id}", response_model=dict)
def delete_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an alarm."""
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id,
    ).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    db.delete(alarm)
    db.commit()
    return {"status": "success", "message": "Alarm deleted"}


@router.post("/{alarm_id}/snooze", response_model=AlarmRes)
def snooze_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Snooze an alarm — increment snooze count and push next_trigger by 5 minutes."""
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id,
    ).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    if not alarm.is_enabled:
        raise HTTPException(status_code=400, detail="Alarm already dismissed")

    # Cap snoozes at 5
    if alarm.times_snoozed >= 5:
        raise HTTPException(status_code=400, detail="Maximum snooze limit reached")

    alarm.times_snoozed += 1
    alarm.next_trigger = datetime.now(timezone.utc) + timedelta(minutes=5)

    db.commit()
    db.refresh(alarm)
    return _to_alarm_res(alarm)


@router.post("/{alarm_id}/dismiss", response_model=DismissRes)
def dismiss_alarm(
    alarm_id: int,
    request: AlarmDismissReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismiss an alarm by verifying challenge completion.
    
    Flow:
    1. Verify alarm belongs to current user and is enabled
    2. Verify challenge attempt exists and was completed successfully
    3. Mark alarm as dismissed, compute next trigger for recurring alarms
    4. Update habit score with fresh computation
    """
    # 1. Find the alarm
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id,
    ).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    
    if not alarm.is_enabled:
        raise HTTPException(status_code=400, detail="Alarm already dismissed")
    
    # 2. Find and verify the challenge attempt
    attempt = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.id == request.challenge_attempt_id,
        ChallengeAttempt.user_id == current_user.id,
    ).first()
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Challenge attempt not found")
    
    # Verify the challenge was completed correctly (all questions correct)
    if not attempt.completed or attempt.correct_answers < attempt.total_questions:
        raise HTTPException(
            status_code=400,
            detail="Challenge not completed successfully. All questions must be answered correctly.",
        )
    
    # 3. Mark alarm as dismissed (disabled)
    alarm.is_enabled = False

    # Compute next trigger for recurring alarms, preserving the alarm's wake-up time
    if alarm.alarm_type != "One-Time":
        tz = _user_tz(current_user)
        hour = alarm.next_trigger.hour if alarm.next_trigger else 7
        minute = alarm.next_trigger.minute if alarm.next_trigger else 0
        wake_time = dtime(hour=hour, minute=minute)
        next_trigger = _compute_next_trigger(alarm.alarm_type, wake_time, tz).astimezone(timezone.utc)
        alarm.next_trigger = next_trigger
        alarm.is_enabled = True
    # OneTime alarms stay disabled
    
    # 4. Update habit score using the proper weighted computation
    from ..services.analytics_service import (
        _compute_wake_up_consistency,
        _compute_challenge_completion,
        _compute_snooze_reduction,
        _compute_sleep_adherence,
        compute_habit_composite,
    )
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check for existing habit score
    habit_score = db.query(HabitScore).filter(
        HabitScore.user_id == current_user.id,
        HabitScore.date == today,
    ).first()
    
    # Recompute all components from actual data
    wake_up = _compute_wake_up_consistency(db, current_user.id, today)
    challenge = _compute_challenge_completion(db, current_user.id, today)
    snooze = _compute_snooze_reduction(db, current_user.id, today)
    sleep = _compute_sleep_adherence(db, current_user.id, today)
    overall = compute_habit_composite(wake_up, challenge, snooze, sleep)
    
    if habit_score:
        habit_score.wake_up_consistency = wake_up
        habit_score.challenge_completion = challenge
        habit_score.snooze_reduction = snooze
        habit_score.sleep_schedule_adherence = sleep
        habit_score.overall_score = overall
    else:
        habit_score = HabitScore(
            user_id=current_user.id,
            date=today,
            wake_up_consistency=wake_up,
            challenge_completion=challenge,
            snooze_reduction=snooze,
            sleep_schedule_adherence=sleep,
            overall_score=overall,
        )
        db.add(habit_score)
    
    db.commit()
    
    return DismissRes(
        alarm_id=alarm.id,
        successfully_dismissed=True,
        new_habit_score_update=True,
        next_trigger=alarm.next_trigger.isoformat() if alarm.next_trigger and alarm.is_enabled else None,
    )
