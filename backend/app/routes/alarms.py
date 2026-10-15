from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import (
    Alarm,
    AlarmSession,
    CognitiveChallenge,
    User,
)
from app.schemas.alarm import (
    AlarmCreate,
    AlarmResponse,
    AlarmUpdate,
)
from app.utils.dependencies import get_current_user
from app.services.adaptive_difficulty import get_alarm_adaptive_status
from app.services.alarm_trigger_service import (
    check_due_alarms_for_user,
    trigger_alarm_for_user,
    has_alarm_triggered_today,
    get_current_time_in_user_tz,
    get_user_timezone,
)


router = APIRouter(
    prefix="/api/alarms",
    tags=["Alarms"],
)


# ============================================================
# VALID VALUES
# ============================================================

VALID_CHALLENGE_TYPES = {
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
}

VALID_DIFFICULTIES = {
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
}


# ============================================================
# CREATE ALARM
# ============================================================

@router.post(
    "",
    response_model=AlarmResponse,
)
def create_alarm(
    alarm_data: AlarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_user_timezone: Optional[str] = Header(None, alias="X-User-Timezone"),
):
    if x_user_timezone:
        get_user_timezone(current_user, db, client_tz=x_user_timezone)
    challenge_type = alarm_data.challenge_type.strip().lower()
    difficulty = alarm_data.difficulty.strip().lower()

    # Validate challenge type
    if challenge_type not in VALID_CHALLENGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported challenge type: {challenge_type}",
        )

    # Validate difficulty
    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported difficulty: {difficulty}",
        )

    alarm = Alarm(
        user_id=current_user.id,
        name=alarm_data.name.strip(),
        alarm_time=alarm_data.alarm_time,
        alarm_type=alarm_data.alarm_type,
        repeat_pattern=alarm_data.repeat_pattern,
        is_active=True,

        # Cognitive preferences
        challenge_type=challenge_type,
        difficulty=difficulty,
    )

    db.add(alarm)
    db.commit()
    db.refresh(alarm)

    return alarm


# ============================================================
# GET ALL USER ALARMS
# ============================================================

@router.get(
    "",
    response_model=list[AlarmResponse],
)
def get_alarms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == current_user.id)
        .order_by(Alarm.alarm_time)
        .all()
    )

    return alarms


# ============================================================
# GET SINGLE ALARM
# ============================================================

@router.get(
    "/{alarm_id}",
    response_model=AlarmResponse,
)
def get_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    return alarm


# ============================================================
# UPDATE ALARM
# ============================================================

@router.put(
    "/{alarm_id}",
    response_model=AlarmResponse,
)
def update_alarm(
    alarm_id: int,
    alarm_data: AlarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    challenge_type = alarm_data.challenge_type.strip().lower()
    difficulty = alarm_data.difficulty.strip().lower()

    # Validate challenge type
    if challenge_type not in VALID_CHALLENGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported challenge type: {challenge_type}",
        )

    # Validate difficulty
    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported difficulty: {difficulty}",
        )

    # Update normal alarm information
    alarm.name = alarm_data.name.strip()
    alarm.alarm_time = alarm_data.alarm_time
    alarm.alarm_type = alarm_data.alarm_type
    alarm.repeat_pattern = alarm_data.repeat_pattern
    alarm.is_active = alarm_data.is_active

    # Update cognitive preferences
    alarm.challenge_type = challenge_type
    alarm.difficulty = difficulty

    db.commit()
    db.refresh(alarm)

    return alarm


# ============================================================
# DELETE ALARM
# ============================================================

@router.delete(
    "/{alarm_id}",
)
def delete_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    # Delete sessions first
    db.query(AlarmSession).filter(
        AlarmSession.alarm_id == alarm.id
    ).delete(
        synchronize_session=False
    )

    # Delete challenges
    db.query(CognitiveChallenge).filter(
        CognitiveChallenge.alarm_id == alarm.id
    ).delete(
        synchronize_session=False
    )

    # Delete alarm
    db.delete(alarm)

    db.commit()

    return {
        "message": "Alarm deleted successfully",
        "alarm_id": alarm_id,
    }


# ============================================================
# TOGGLE ALARM ACTIVE / INACTIVE
# ============================================================

@router.patch(
    "/{alarm_id}/toggle",
    response_model=AlarmResponse,
)
def toggle_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    alarm.is_active = not alarm.is_active

    db.commit()
    db.refresh(alarm)

    return alarm


# ============================================================
# GET ALARM ADAPTIVE DIFFICULTY STATUS
# ============================================================

@router.get(
    "/{alarm_id}/adaptive-difficulty",
)
def get_alarm_adaptive_difficulty(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    return get_alarm_adaptive_status(alarm_id, db)


# ============================================================
# ALARM TRIGGER & WAKE-UP REAL-TIME DETECTION
# ============================================================

@router.get(
    "/triggers/due",
)
def get_due_alarms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_user_timezone: Optional[str] = Header(None, alias="X-User-Timezone"),
):
    """
    Evaluates current time in user's timezone against active alarms.
    Returns currently due alarms with duplicate trigger protection.
    """
    due_alarms = check_due_alarms_for_user(
        current_user,
        db,
        auto_trigger=True,
        client_tz=x_user_timezone,
    )
    return {
        "due_count": len(due_alarms),
        "due_alarms": due_alarms,
    }


@router.post(
    "/{alarm_id}/trigger",
)
def trigger_alarm(
    alarm_id: int,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_user_timezone: Optional[str] = Header(None, alias="X-User-Timezone"),
):
    """
    Explicitly triggers an alarm for the authenticated user:
    - Validates alarm ownership and active status.
    - Idempotently prevents duplicate triggers for the same calendar date.
    - Generates system notification and returns deep link metadata.
    """
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    try:
        result = trigger_alarm_for_user(
            alarm,
            current_user,
            db,
            force=force,
            client_tz=x_user_timezone,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=403,
            detail=str(e),
        )


@router.get(
    "/{alarm_id}/trigger-status",
)
def get_alarm_trigger_status(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_user_timezone: Optional[str] = Header(None, alias="X-User-Timezone"),
):
    """
    Checks if an alarm has already triggered today in the user's timezone.
    """
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    user_now = get_current_time_in_user_tz(current_user, db, client_tz=x_user_timezone)
    triggered_today = has_alarm_triggered_today(alarm.id, current_user.id, user_now, db)

    return {
        "alarm_id": alarm.id,
        "is_active": alarm.is_active,
        "triggered_today": triggered_today,
        "user_time": user_now.strftime("%Y-%m-%d %H:%M:%S"),
        "alarm_time": alarm.alarm_time.strftime("%H:%M") if hasattr(alarm.alarm_time, "strftime") else str(alarm.alarm_time)[:5],
    }