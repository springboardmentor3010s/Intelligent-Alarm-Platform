"""User profile and settings routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import Dict

from ..database import get_db
from ..Models import User
from ..schemas import UserProfileUpdateReq, SettingsUpdateReq
from ..schemas.auth import UserProfileRes
from ..api.deps import get_current_user
from ..services import user_service
from ..services.token_service import revoke_all_tokens
from ..services.audit_service import log_event

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


@router.get("/settings", response_model=Dict[str, object])
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


@router.post("/deactivate", status_code=200)
def deactivate_account(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Self-service account deactivation.

    Sets ``is_active`` to False and revokes every active refresh token so
    existing sessions are immediately invalidated.
    """
    current_user.is_active = False
    revoke_all_tokens(db, current_user.id)
    log_event(
        db, "user.deactivated",
        user_id=current_user.id,
        actor_email=current_user.email,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "Account deactivated. You will no longer be able to log in."}
