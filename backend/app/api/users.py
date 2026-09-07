"""User profile and settings routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict

from ..database import get_db
from ..Models import User
from ..schemas import UserProfileUpdateReq, SettingsUpdateReq
from ..schemas.auth import UserProfileRes
from ..api.deps import get_current_user
from ..services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/profile", response_model=UserProfileRes)
def get_profile(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's profile."""
    return user_service.to_profile(current_user)


@router.put("/profile", response_model=UserProfileRes)
def update_profile(
    payload: UserProfileUpdateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile (full_name, timezone, difficulty)."""
    return user_service.update_profile(db, current_user, payload)


@router.get("/settings", response_model=Dict[str, bool])
def get_settings(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's app preferences."""
    return user_service.get_user_settings(current_user)


@router.put("/{key}", response_model=Dict[str, object])
def update_setting(
    key: str,
    payload: SettingsUpdateReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a single app preference (e.g. PUT /users/notifications)."""
    return user_service.update_user_setting(key, payload, db, current_user)
