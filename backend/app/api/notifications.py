# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Notification routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User
from ..api.deps import get_current_user
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushRegisterReq(BaseModel):
    """Request body for push-token registration."""

    token: str = Field(..., min_length=1, max_length=512, description="Device push token")
    platform: str = Field("android", pattern="^(android|ios|web)$")


@router.post("/register", response_model=dict)
def register_device_token(
    payload: PushRegisterReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register (idempotent) a device push token for the current user."""
    push_token = NotificationService.register_token(
        db, current_user, payload.token, payload.platform
    )
    return {
        "id": push_token.id,
        "token": push_token.token,
        "platform": push_token.platform,
        "registered": True,
    }


@router.delete("/register", response_model=dict)
def deregister_device_token(
    payload: PushRegisterReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a device push token from the current user."""
    removed = NotificationService.deregister_token(db, current_user, payload.token)
    return {"token": payload.token, "deregistered": removed}


@router.get("/tokens", response_model=list[dict])
def list_device_tokens(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's registered push tokens."""
    return NotificationService.list_tokens(db, current_user)


@router.get("/status", response_model=dict)
def notification_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Describe the push delivery configuration (provider, configured status).

    This is a diagnostics read: it reports whether real FCM/APNs delivery is
    enabled and how many device tokens the current user has registered. It does
    not itself deliver anything.
    """
    from ..integrations import messaging

    provider = messaging.get_provider()
    tokens = NotificationService.list_tokens(db, current_user)
    return {
        "provider": getattr(provider, "name", "unknown"),
        "configured": not isinstance(provider, messaging.NoopProvider),
        "registered_tokens": len(tokens),
        "message": (
            "Push delivery configured via Expo push relay."
            if not isinstance(provider, messaging.NoopProvider)
            else "Push delivery not configured (PUSH_PROVIDER=expo to enable)."
        ),
    }


@router.post("/test", response_model=dict)
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deliver a test notification to the current user's devices.

    Requires ``PUSH_PROVIDER=expo`` and at least one registered token. The
    summary is returned verbatim so callers can see sent/failed counts.
    """
    return NotificationService.send_test(db, current_user)


class TriggerReq(BaseModel):
    """Generic trigger notification request."""
    title: str | None = Field(None, description="Optional notification title")
    body: str | None = Field(None, description="Optional notification body")
    data: dict | None = Field(None, description="Extra data payload")


class ChallengeTriggerReq(TriggerReq):
    challenge_id: int | None = Field(None)


class HabitTriggerReq(TriggerReq):
    habit_id: int | None = Field(None)


@router.post("/triggers/bedtime", response_model=dict)
def trigger_bedtime(
    payload: TriggerReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NotificationService.send_bedtime_reminder(
        db,
        current_user,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )


@router.post("/triggers/challenge", response_model=dict)
def trigger_challenge(
    payload: ChallengeTriggerReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NotificationService.send_challenge_reminder(
        db,
        current_user,
        challenge_id=payload.challenge_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )


@router.post("/triggers/habit", response_model=dict)
def trigger_habit(
    payload: HabitTriggerReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NotificationService.send_habit_alert(
        db,
        current_user,
        habit_id=payload.habit_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )


@router.post("/triggers/progress", response_model=dict)
def trigger_progress(
    payload: TriggerReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NotificationService.send_progress_notification(
        db,
        current_user,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )
