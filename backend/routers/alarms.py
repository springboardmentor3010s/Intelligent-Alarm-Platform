from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from database import get_db
from Models.alarm import Alarm
from Models.challenge import Challenge
from auth import get_current_user
from services.notification_service import create_notification

router = APIRouter(prefix="/alarms", tags=["Alarms"])


class AlarmCreateRequest(BaseModel):
    title: str
    time: str
    alarm_type: str = "Daily"
    days_of_week: Optional[str] = "Mon,Tue,Wed,Thu,Fri,Sat,Sun"
    challenge_type: Optional[str] = "Math Problems"
    difficulty: Optional[str] = "Beginner"
    snooze_limit: Optional[int] = 3
    sound_tone: Optional[str] = "Gentle Chimes"
    is_active: Optional[bool] = True
    reminder_message: Optional[str] = None
    num_challenges: Optional[int] = 1


class AlarmUpdateRequest(BaseModel):
    title: str
    time: str
    alarm_type: str
    days_of_week: str
    challenge_type: str
    difficulty: str
    snooze_limit: int
    sound_tone: str
    is_active: bool
    reminder_message: Optional[str] = None
    num_challenges: Optional[int] = 1


def alarm_response(alarm):
    return {
        "id": alarm.id,
        "title": alarm.title,
        "time": alarm.time,
        "alarm_type": alarm.alarm_type,
        "days_of_week": alarm.days_of_week,
        "is_active": alarm.is_active,
        "challenge_type": alarm.challenge_type,
        "difficulty": alarm.difficulty,
        "snooze_limit": alarm.snooze_limit,
        "sound_tone": alarm.sound_tone,
        "reminder_message": alarm.reminder_message,
        "num_challenges": alarm.num_challenges,
        "created_at": alarm.created_at.isoformat() if alarm.created_at else None
    }


@router.get("")
def get_alarms(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == user_id)
        .order_by(Alarm.id.desc())
        .all()
    )

    return [alarm_response(alarm) for alarm in alarms]


@router.post("")
def create_alarm(
    alarm_data: AlarmCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    if alarm_data.snooze_limit is not None and alarm_data.snooze_limit < 0:
        raise HTTPException(
            status_code=400,
            detail="Snooze limit cannot be negative"
        )

    new_alarm = Alarm(
        user_id=user_id,
        title=alarm_data.title,
        time=alarm_data.time,
        alarm_type=alarm_data.alarm_type,
        days_of_week=(
            alarm_data.days_of_week
            or "Mon,Tue,Wed,Thu,Fri,Sat,Sun"
        ),
        challenge_type=(
            alarm_data.challenge_type
            or "Math Problems"
        ),
        difficulty=(
            alarm_data.difficulty
            or "Beginner"
        ),
        snooze_limit=(
            alarm_data.snooze_limit
            if alarm_data.snooze_limit is not None
            else 3
        ),
        sound_tone=(
            alarm_data.sound_tone
            or "Gentle Chimes"
        ),
        is_active=(
            alarm_data.is_active
            if alarm_data.is_active is not None
            else True
        ),
        reminder_message=alarm_data.reminder_message,
        num_challenges=(
            alarm_data.num_challenges
            if alarm_data.num_challenges is not None
            else 1
        )
    )

    db.add(new_alarm)
    db.commit()
    db.refresh(new_alarm)

    # Dispatch scheduled alarm notification
    remind_text = f" Reminder: {new_alarm.reminder_message}" if new_alarm.reminder_message else ""
    create_notification(
        db=db,
        user_id=user_id,
        title=f"Alarm Scheduled: {new_alarm.title}",
        message=f"Alarm set for {new_alarm.time} ({new_alarm.days_of_week}). Challenge: {new_alarm.challenge_type} ({new_alarm.difficulty}).{remind_text}",
        category="alarm",
        priority="normal",
        link="/reminders",
        related_entity_type="alarm",
        related_entity_id=new_alarm.id,
        prevent_duplicate=True
    )

    return {
        "message": "Alarm created successfully",
        "alarm": alarm_response(new_alarm)
    }


@router.put("/{alarm_id}")
def update_alarm(
    alarm_id: int,
    alarm_data: AlarmUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    if alarm_data.snooze_limit < 0:
        raise HTTPException(
            status_code=400,
            detail="Snooze limit cannot be negative"
        )

    alarm.title = alarm_data.title
    alarm.time = alarm_data.time
    alarm.alarm_type = alarm_data.alarm_type
    alarm.days_of_week = alarm_data.days_of_week
    alarm.challenge_type = alarm_data.challenge_type
    alarm.difficulty = alarm_data.difficulty
    alarm.snooze_limit = alarm_data.snooze_limit
    alarm.sound_tone = alarm_data.sound_tone
    alarm.is_active = alarm_data.is_active
    alarm.reminder_message = alarm_data.reminder_message
    alarm.num_challenges = alarm_data.num_challenges

    db.commit()
    db.refresh(alarm)

    return {
        "message": "Alarm updated successfully",
        "alarm": alarm_response(alarm)
    }


@router.patch("/{alarm_id}/toggle")
def toggle_alarm(
    alarm_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    alarm.is_active = not alarm.is_active

    db.commit()
    db.refresh(alarm)

    return {
        "message": "Alarm state toggled",
        "is_active": alarm.is_active
    }


@router.post("/{alarm_id}/trigger")
def trigger_alarm(
    alarm_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    if not alarm.is_active:
        raise HTTPException(
            status_code=400,
            detail="Alarm is inactive"
        )

    return {
        "message": "Alarm triggered",
        "alarm_id": alarm.id,
        "title": alarm.title,
        "challenge_type": alarm.challenge_type,
        "difficulty": alarm.difficulty,
        "sound_tone": alarm.sound_tone,
        "requires_cognitive_challenge": True
    }


@router.get("/{alarm_id}/status")
def get_alarm_status(
    alarm_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    pending_challenge = (
        db.query(Challenge)
        .filter(
            Challenge.alarm_id == alarm_id,
            Challenge.user_id == user_id,
            Challenge.status == "pending"
        )
        .order_by(Challenge.id.desc())
        .first()
    )

    return {
        "alarm_id": alarm.id,
        "is_active": alarm.is_active,
        "requires_cognitive_challenge": True,
        "verification_status": (
            "challenge_pending"
            if pending_challenge
            else "not_started"
        ),
        "challenge_id": (
            pending_challenge.id
            if pending_challenge
            else None
        )
    }


@router.post("/{alarm_id}/dismiss")
def dismiss_alarm(
    alarm_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    pending_challenge = (
        db.query(Challenge)
        .filter(
            Challenge.alarm_id == alarm_id,
            Challenge.user_id == user_id,
            Challenge.status == "pending"
        )
        .first()
    )

    if pending_challenge:
        raise HTTPException(
            status_code=403,
            detail="Cognitive challenge must be completed before dismissing the alarm"
        )

    completed_challenge = (
        db.query(Challenge)
        .filter(
            Challenge.alarm_id == alarm_id,
            Challenge.user_id == user_id,
            Challenge.status == "completed"
        )
        .order_by(Challenge.id.desc())
        .first()
    )

    if not completed_challenge:
        raise HTTPException(
            status_code=403,
            detail="Wake-up verification has not been completed"
        )

    return {
        "message": "Alarm dismissed successfully",
        "alarm_id": alarm.id,
        "verification_status": "verified",
        "alarm_dismissed": True
    }


@router.delete("/{alarm_id}")
def delete_alarm(
    alarm_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    db.delete(alarm)
    db.commit()

    return {
        "message": "Alarm deleted successfully"
    }