
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    ensure_access,
    ensure_owner_or_admin,
    get_current_user,
    user_scope,
)
from app.db.database import get_db
from app.models.alarm import Alarm
from app.models.alarm_event import AlarmEvent
from app.models.user import User
from app.models.wake_up_verification import WakeUpVerification
from app.schemas.alarm import (
    AlarmCreateRequest,
    AlarmDismissRequest,
    AlarmMessageResponse,
    AlarmResponse,
    AlarmToggleRequest,
    AlarmUpdateRequest,
)
from app.services import alarm_service
from app.services.adaptive_difficulty import adaptive_difficulty_engine
from app.services.profile_service import get_or_create_profile, parse_hhmm


SNOOZE_MINUTES = 5
VERIFICATION_MAX_AGE = timedelta(hours=2)

router = APIRouter(
    prefix="/alarms",
    tags=["Alarms"],
    dependencies=[Depends(user_scope)],
)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def _to_response(alarm: Alarm, user: User) -> AlarmResponse:
    next_time = None

    if alarm.enabled:
        upcoming = alarm_service.next_occurrence(
            alarm.recurrence,
            alarm.alarm_time,
            alarm_service.user_tz(user),
        )
        next_time = upcoming.isoformat() if upcoming else None

    return AlarmResponse(
        id=alarm.id,
        user_id=alarm.user_id,
        title=alarm.title,
        alarm_time=alarm.alarm_time.strftime("%H:%M"),
        recurrence=alarm.recurrence,
        challenge_type=alarm.challenge_type,
        difficulty=alarm.difficulty,
        snooze_limit=alarm.snooze_limit,
        enabled=alarm.enabled,
        next_trigger=next_time,
    )


def _user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


def _alarm_for_read(
    db: Session,
    alarm_id: int,
    current: User,
) -> Alarm:
    alarm = db.get(Alarm, alarm_id)

    if alarm is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alarm not found",
        )

    ensure_access(db, current, alarm.user_id)
    return alarm


def _alarm_for_write(
    db: Session,
    alarm_id: int,
    current: User,
) -> Alarm:
    alarm = _alarm_for_read(db, alarm_id, current)
    ensure_owner_or_admin(current, alarm.user_id)
    return alarm


def _parse_time(value: str):
    try:
        return parse_hhmm(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="alarm_time must be in HH:MM format",
        )


def _record_event(
    db: Session,
    alarm: Alarm,
    event_type: str,
    details: dict | None = None,
) -> AlarmEvent:
    event = AlarmEvent(
        alarm_id=alarm.id,
        user_id=alarm.user_id,
        event_type=event_type,
        details=details,
    )

    db.add(event)
    return event


def _as_utc(value: datetime) -> datetime:
    """
    Normalize a datetime to timezone-aware UTC.

    Naive timestamps in this application are treated as UTC.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


# ---------------------------------------------------------
# CREATE, LIST, UPDATE, DELETE
# ---------------------------------------------------------

@router.post(
    "/",
    response_model=AlarmResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_alarm(
    request: AlarmCreateRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_id = request.user_id or current.id
    user = _user_or_404(db, target_id)
    alarm_time = _parse_time(request.alarm_time)

    alarm = Alarm(
        user_id=user.id,
        title=request.title.strip(),
        alarm_time=alarm_time,
        recurrence=request.recurrence,
        challenge_type=request.challenge_type,
        difficulty=request.difficulty,
        snooze_limit=request.snooze_limit,
        enabled=True,
    )

    db.add(alarm)
    db.commit()
    db.refresh(alarm)

    return _to_response(alarm, user)


@router.get(
    "/user/{user_id}",
    response_model=list[AlarmResponse],
)
def get_user_alarms(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = _user_or_404(db, user_id)

    alarms = db.execute(
        select(Alarm)
        .where(Alarm.user_id == user_id)
        .order_by(Alarm.alarm_time)
    ).scalars().all()

    return [_to_response(alarm, user) for alarm in alarms]


@router.get("/next/{user_id}")
def get_next_alarm(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Return the enabled alarm that rings soonest."""
    user = _user_or_404(db, user_id)

    alarms = db.execute(
        select(Alarm).where(
            Alarm.user_id == user_id,
            Alarm.enabled.is_(True),
        )
    ).scalars().all()

    tz = alarm_service.user_tz(user)
    best = None

    for alarm in alarms:
        when = alarm_service.next_occurrence(
            alarm.recurrence,
            alarm.alarm_time,
            tz,
        )

        if when and (best is None or when < best[0]):
            best = (when, alarm)

    if best is None:
        return {"alarm": None}

    return {
        "alarm": _to_response(best[1], user),
        "next_trigger": best[0].isoformat(),
    }


@router.get("/history/{user_id}")
def alarm_history(
    user_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return alarm history, newest first."""
    _user_or_404(db, user_id)

    rows = db.execute(
        select(AlarmEvent, Alarm.title)
        .join(Alarm, Alarm.id == AlarmEvent.alarm_id)
        .where(AlarmEvent.user_id == user_id)
        .order_by(AlarmEvent.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()

    return {
        "items": [
            {
                "id": event.id,
                "alarm_id": event.alarm_id,
                "alarm_title": title,
                "event_type": event.event_type,
                "details": event.details,
                "created_at": event.created_at,
            }
            for event, title in rows
        ]
    }


@router.get("/smart-suggestion/{user_id}")
def smart_suggestion(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Preview the Smart Adaptive settings for a user."""
    _user_or_404(db, user_id)
    profile = get_or_create_profile(db, user_id)

    try:
        next_difficulty = adaptive_difficulty_engine.get_next_difficulty(
            db=db,
            user_id=user_id,
            current_difficulty=profile.current_difficulty,
        )["next_difficulty"]
    except Exception:
        next_difficulty = None

    return alarm_service.build_smart_suggestion(
        profile,
        alarm_service.recent_snooze_rate(db, user_id),
        next_difficulty,
    )


@router.get("/{alarm_id}", response_model=AlarmResponse)
def get_alarm(
    alarm_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = _alarm_for_read(db, alarm_id, current)
    user = _user_or_404(db, alarm.user_id)

    return _to_response(alarm, user)


@router.put("/{alarm_id}", response_model=AlarmResponse)
def update_alarm(
    alarm_id: int,
    request: AlarmUpdateRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = _alarm_for_write(db, alarm_id, current)
    data = request.model_dump(exclude_unset=True)

    if data.get("alarm_time"):
        alarm.alarm_time = _parse_time(data.pop("alarm_time"))
    else:
        data.pop("alarm_time", None)

    for key, value in data.items():
        if value is not None:
            setattr(
                alarm,
                key,
                value.strip() if key == "title" else value,
            )

    db.commit()
    db.refresh(alarm)

    return _to_response(alarm, _user_or_404(db, alarm.user_id))


@router.patch(
    "/{alarm_id}/toggle",
    response_model=AlarmResponse,
)
def toggle_alarm(
    alarm_id: int,
    request: AlarmToggleRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = _alarm_for_write(db, alarm_id, current)
    alarm.enabled = request.enabled

    db.commit()
    db.refresh(alarm)

    return _to_response(alarm, _user_or_404(db, alarm.user_id))


@router.delete(
    "/{alarm_id}",
    response_model=AlarmMessageResponse,
)
def delete_alarm(
    alarm_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = _alarm_for_write(db, alarm_id, current)

    db.delete(alarm)
    db.commit()

    return AlarmMessageResponse(
        message="Alarm deleted successfully."
    )


# ---------------------------------------------------------
# SMART ADAPTIVE ALARM
# ---------------------------------------------------------

@router.post("/{alarm_id}/apply-smart", response_model=AlarmResponse)
def apply_smart_settings(
    alarm_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply Smart Adaptive settings to an alarm."""
    alarm = _alarm_for_write(db, alarm_id, current)
    profile = get_or_create_profile(db, alarm.user_id)

    try:
        next_difficulty = adaptive_difficulty_engine.get_next_difficulty(
            db=db,
            user_id=alarm.user_id,
            current_difficulty=alarm.difficulty,
        )["next_difficulty"]
    except Exception:
        next_difficulty = None

    suggestion = alarm_service.build_smart_suggestion(
        profile,
        alarm_service.recent_snooze_rate(db, alarm.user_id),
        next_difficulty,
    )

    alarm.recurrence = "smart"
    alarm.challenge_type = suggestion["challenge_type"]
    alarm.snooze_limit = suggestion["snooze_limit"]

    if suggestion["alarm_time"]:
        alarm.alarm_time = parse_hhmm(suggestion["alarm_time"])

    db.commit()
    db.refresh(alarm)

    return _to_response(alarm, _user_or_404(db, alarm.user_id))


# ---------------------------------------------------------
# RING, SNOOZE, DISMISS
# ---------------------------------------------------------

@router.post("/{alarm_id}/trigger")
def trigger_alarm(
    alarm_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record that the alarm rang."""
    alarm = _alarm_for_write(db, alarm_id, current)
    user = _user_or_404(db, alarm.user_id)

    _record_event(db, alarm, "triggered")
    db.commit()

    used = alarm_service.snoozes_used_today(db, alarm, user)

    return {
        "alarm_id": alarm.id,
        "snooze_limit": alarm.snooze_limit,
        "snoozes_used": used,
        "snoozes_remaining": max(0, alarm.snooze_limit - used),
    }


@router.post("/{alarm_id}/snooze")
def snooze_alarm(
    alarm_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Snooze the alarm within its daily snooze limit."""
    alarm = _alarm_for_write(db, alarm_id, current)
    user = _user_or_404(db, alarm.user_id)

    used = alarm_service.snoozes_used_today(db, alarm, user)

    if used >= alarm.snooze_limit:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Snooze limit reached. Complete the wake-up "
                "challenge to dismiss this alarm."
            ),
        )

    _record_event(
        db,
        alarm,
        "snoozed",
        {"minutes": SNOOZE_MINUTES},
    )
    db.commit()

    return {
        "alarm_id": alarm.id,
        "snooze_minutes": SNOOZE_MINUTES,
        "snoozes_used": used + 1,
        "snoozes_remaining": alarm.snooze_limit - used - 1,
    }


@router.post("/{alarm_id}/dismiss")
def dismiss_alarm(
    alarm_id: int,
    request: AlarmDismissRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dismiss an alarm only after a recent, successful verification.

    Verification age is measured from completed_at, not created_at.
    """

    # 1. Check alarm access and ownership.
    alarm = _alarm_for_write(db, alarm_id, current)

    # 2. Find and validate the verification.
    verification = db.get(
        WakeUpVerification,
        request.verification_id,
    )

    if (
        verification is None
        or verification.user_id != alarm.user_id
        or (
            verification.alarm_id is not None
            and verification.alarm_id != alarm.id
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification does not belong to this alarm.",
        )

    # 3. Require a successfully completed verification.
    if (
        not verification.successful
        or verification.status != "completed"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete the wake-up verification before dismissing.",
        )

    # 4. Validate the actual completion time.
    completed = verification.completed_at

    if completed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The verification completion time is missing. "
                "Please complete a new verification."
            ),
        )

    completed_utc = _as_utc(completed)
    now_utc = datetime.now(timezone.utc)
    age = now_utc - completed_utc

    if age > VERIFICATION_MAX_AGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification is too old. Verify again.",
        )

    # Do not accept timestamps that are unexpectedly in the future.
    if age < timedelta(seconds=-60):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The verification completion time is invalid. "
                "Please verify again."
            ),
        )

    # 5. Prevent reuse of a verification that already dismissed this alarm.
    previous_events = db.execute(
        select(AlarmEvent).where(
            AlarmEvent.alarm_id == alarm.id,
            AlarmEvent.event_type == "dismissed",
        )
    ).scalars().all()

    already_used = any(
        (event.details or {}).get("verification_id") == verification.id
        for event in previous_events
    )

    if already_used:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This verification was already used "
                "to dismiss the alarm."
            ),
        )

    # 6. Record dismissal and disable one-time alarms.
    _record_event(
        db,
        alarm,
        "dismissed",
        {"verification_id": verification.id},
    )

    if alarm.recurrence == "once":
        alarm.enabled = False

    db.commit()

    return {
        "alarm_id": alarm.id,
        "dismissed": True,
        "alarm_enabled": alarm.enabled,
        "message": "Alarm dismissed. Have a great day!",
    }
