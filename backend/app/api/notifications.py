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
