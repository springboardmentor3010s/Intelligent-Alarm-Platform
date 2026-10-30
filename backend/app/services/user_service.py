# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""User identity, profile, and settings service.

Owns authentication (register/login/JWT), profile serialization + updates, and
per-user app preference settings. `services.auth` re-exports `AuthService` for
backward compatibility.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import Role, User, UserRole
from ..schemas.auth import UserProfileRes
from ..schemas import UserProfileUpdateReq, SettingsUpdateReq
from ..core.config import get_secret_key


class AuthService:
    """Authentication service handling user registration and login."""

    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60
    REFRESH_TOKEN_EXPIRE_DAYS = 30

    @classmethod
    def _secret_key(cls) -> str:
        """Read the JWT secret lazily via config (fail-fast in production)."""
        return get_secret_key()

    @classmethod
    def _hash_password(cls, password: str) -> str:
        """Hash password using bcrypt."""
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @classmethod
    def _verify_password(cls, plain: str, hashed: str) -> bool:
        """Verify password against bcrypt hash."""
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

    @classmethod
    def _create_access_token(
        cls, subject: str, expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token."""
        now = datetime.now(timezone.utc)
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=cls.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sub": subject, "exp": expire, "iat": now, "jti": uuid4().hex}
        encoded_jwt = jwt.encode(to_encode, cls._secret_key(), algorithm=cls.ALGORITHM)
        return encoded_jwt

    @classmethod
    def _create_refresh_token(cls, subject: str) -> str:
        """Create JWT refresh token."""
        expire = datetime.now(timezone.utc) + timedelta(days=cls.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode = {"sub": subject, "exp": expire, "iat": datetime.now(timezone.utc), "type": "refresh", "jti": uuid4().hex}
        encoded_jwt = jwt.encode(to_encode, cls._secret_key(), algorithm=cls.ALGORITHM)
        return encoded_jwt

    @classmethod
    def _decode_token(cls, token: str) -> Optional[dict]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(token, cls._secret_key(), algorithms=[cls.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None


_SETTING_KEYS = {"notifications", "auto_dismiss", "vibrate", "time_format"}

_ROLE_PRIORITY = ("Administrator", "Wellness Coach", "User")


def primary_role(db: Session, user_id: int) -> str:
    """Most-privileged role name held by a user (defaults to 'User')."""
    names = {
        name
        for (name,) in db.query(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    }
    for role in _ROLE_PRIORITY:
        if role in names:
            return role
    return "User"


def to_profile(user: User, role: str = "User") -> UserProfileRes:
    """Serialize a User ORM row to the API profile shape."""
    return UserProfileRes(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        timezone=user.timezone or "UTC",
        difficulty_preference=user.difficulty_preference or "Medium",
        is_active=user.is_active,
        is_verified=user.is_verified,
        role=role,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


def update_profile(
    db: Session, user: User, payload: UserProfileUpdateReq
) -> UserProfileRes:
    """Apply editable profile fields (full_name, timezone, difficulty)."""
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.difficulty_preference is not None:
        user.difficulty_preference = payload.difficulty_preference

    db.commit()
    db.refresh(user)
    return to_profile(user, primary_role(db, user.id))


def get_user_settings(user: User) -> Dict[str, object]:
    """Return the user's app preferences with defaults applied."""
    settings = user.settings or {}
    time_format = settings.get("time_format", "12")
    if time_format not in ("12", "24"):
        time_format = "12"
    return {
        "notifications": bool(settings.get("notifications", True)),
        "auto_dismiss": bool(settings.get("auto_dismiss", False)),
        "vibrate": bool(settings.get("vibrate", True)),
        "time_format": time_format,
    }


def update_user_setting(
    key: str, payload: SettingsUpdateReq, db: Session, user: User
) -> Dict[str, object]:
    """Update a single app preference (e.g. PUT /users/notifications)."""
    if key not in _SETTING_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting: {key}. Allowed: {', '.join(sorted(_SETTING_KEYS))}",
        )

    settings = dict(user.settings or {})
    value = getattr(payload, key)
    if value is None:
        raise HTTPException(
            status_code=400,
            detail=f"Missing value for setting: {key}",
        )
    if key == "time_format" and value not in ("12", "24"):
        raise HTTPException(
            status_code=400,
            detail="time_format must be either '12' or '24'",
        )
    settings[key] = value
    user.settings = settings

    db.commit()
    db.refresh(user)
    return {key: value, "status": "success"}
