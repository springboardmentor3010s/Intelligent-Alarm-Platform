"""User profile and settings routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict

from ..database import get_db
from ..Models import User
from ..schemas import UserProfileUpdateReq, SettingsUpdateReq
from ..schemas.auth import UserProfileRes
from ..api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

_SETTING_KEYS = {"notifications", "auto_dismiss", "vibrate"}


def _to_profile(user: User) -> UserProfileRes:
    return UserProfileRes(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        timezone=user.timezone or "UTC",
        difficulty_preference=user.difficulty_preference or "Medium",
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.get("/profile", response_model=UserProfileRes)
def get_profile(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's profile."""
    return _to_profile(current_user)


@router.put("/profile", response_model=UserProfileRes)
def update_profile(
    payload: UserProfileUpdateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile (full_name, timezone, difficulty)."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    if payload.difficulty_preference is not None:
        current_user.difficulty_preference = payload.difficulty_preference

    db.commit()
    db.refresh(current_user)
    return _to_profile(current_user)


@router.get("/settings", response_model=Dict[str, bool])
def get_settings(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's app preferences."""
    settings = current_user.settings or {}
    return {
        "notifications": bool(settings.get("notifications", True)),
        "auto_dismiss": bool(settings.get("auto_dismiss", False)),
        "vibrate": bool(settings.get("vibrate", True)),
    }


@router.put("/{key}", response_model=Dict[str, object])
def update_setting(
    key: str,
    payload: SettingsUpdateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a single app preference (e.g. PUT /users/notifications)."""
    if key not in _SETTING_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown setting: {key}. Allowed: {', '.join(sorted(_SETTING_KEYS))}",
        )

    settings = dict(current_user.settings or {})
    value = getattr(payload, key)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing boolean value for setting: {key}",
        )
    settings[key] = value
    current_user.settings = settings

    db.commit()
    return {key: value, "status": "success"}
