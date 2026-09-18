"""Alarm routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User
from ..schemas import AlarmCreateReq, AlarmDismissReq, AlarmRes, DismissRes
from ..api.deps import get_current_user
from ..services import alarm_service

router = APIRouter(prefix="/alarms", tags=["alarms"])


@router.get("", response_model=list[AlarmRes])
def list_alarms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all alarms for the current user."""
    return alarm_service.list_alarms(db, current_user.id)


@router.post("", response_model=AlarmRes)
def create_alarm(
    payload: AlarmCreateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new alarm with auto-computed, timezone-aware next_trigger."""
    return alarm_service.create_alarm(db, current_user, payload)


@router.put("/{alarm_id}", response_model=AlarmRes)
def update_alarm(
    alarm_id: int,
    payload: AlarmCreateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing alarm."""
    return alarm_service.update_alarm(db, current_user, alarm_id, payload)


@router.delete("/{alarm_id}", response_model=dict)
def delete_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an alarm."""
    return alarm_service.delete_alarm(db, current_user.id, alarm_id)


@router.post("/{alarm_id}/snooze", response_model=AlarmRes)
def snooze_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Snooze an alarm — increment snooze count and push next_trigger by 5 minutes."""
    return alarm_service.snooze_alarm(db, current_user.id, alarm_id)


@router.post("/{alarm_id}/dismiss", response_model=DismissRes)
def dismiss_alarm(
    alarm_id: int,
    request: AlarmDismissReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismiss an alarm by verifying challenge completion."""
    return alarm_service.dismiss_alarm(db, current_user, alarm_id, request)


@router.post("/{alarm_id}/notify", response_model=dict)
def notify_alarm_due(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a push notification that this alarm is due.

    Sends via the configured provider (Expo relay → FCM/APNs) to every token the
    owner registered. The payload carries the alarm id + challenge pointer so the
    pushed screen opens the correct challenge. Returns the delivery summary —
    ``configured=False`` means delivery is not enabled (no-op provider).
    """
    return alarm_service.notify_alarm_due(db, current_user, alarm_id)
