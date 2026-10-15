"""Shared authentication and authorization helpers.

Every token (user, wellness coach, administrator) is a JWT signed with the
same secret. The role is always re-read from the database, never trusted from
the token, so changing a role or deactivating an account takes effect at once.
"""
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models.coach_assignment import CoachAssignment
from app.models.user import User

settings = get_settings()

password_hasher = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token",
    auto_error=False,
)

ROLE_USER = "user"
ROLE_COACH = "coach"
ROLE_ADMIN = "admin"
STAFF_ROLES = {ROLE_COACH, ROLE_ADMIN}


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return password_hasher.verify(password, hashed)
    except Exception:
        # An unreadable stored hash must never count as a valid login.
        return False


def _secret() -> str:
    secret = settings.token_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )
    return secret


def create_access_token(user: User) -> tuple[str, int]:
    """Return (token, lifetime in seconds)."""
    minutes = (
        settings.admin_token_expire_minutes
        if user.role in STAFF_ROLES
        else settings.user_token_expire_minutes
    )
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role,
            "iat": now,
            "exp": now + timedelta(minutes=minutes),
        },
        _secret(),
        algorithm="HS256",
    )
    return token, minutes * 60


def create_state_token(purpose: str, minutes: int = 10) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"purpose": purpose, "iat": now, "exp": now + timedelta(minutes=minutes)},
        _secret(),
        algorithm="HS256",
    )


def verify_state_token(token: str, purpose: str) -> bool:
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return False
    return payload.get("purpose") == purpose


def user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "timezone": user.timezone,
    }


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            _secret(),
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account is not available.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(*roles: str):
    allowed = set(roles)

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to do this.",
            )
        return user

    return checker


def ensure_access(db: Session, current: User, target_user_id: int) -> None:
    """Allow the user themselves, an admin, or a coach assigned to the user."""
    if current.role == ROLE_ADMIN or current.id == target_user_id:
        return

    if current.role == ROLE_COACH:
        assigned = db.execute(
            select(CoachAssignment.id).where(
                CoachAssignment.coach_id == current.id,
                CoachAssignment.user_id == target_user_id,
            )
        ).first()
        if assigned:
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this user's data.",
    )


def ensure_owner_or_admin(current: User, owner_id: int) -> None:
    """For writes: only the owner or an admin may change the record."""
    if current.role != ROLE_ADMIN and current.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only change your own data.",
        )


async def user_scope(
    request: Request,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Router dependency for endpoints that act on a user_id.

    The user_id may be in the path, the query string or a JSON body. Writes
    (POST, PUT, PATCH, DELETE) are limited to the owner or an admin, so a
    coach can only read the data of the users assigned to them.
    """
    raw = request.path_params.get("user_id")
    if raw is None:
        raw = request.query_params.get("user_id")

    if raw is None and request.method in {"POST", "PUT", "PATCH"}:
        try:
            body = await request.json()
        except Exception:
            body = None
        if isinstance(body, dict):
            raw = body.get("user_id")

    if raw is None:
        return current

    try:
        target = int(raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id must be a whole number.",
        )

    ensure_access(db, current, target)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        ensure_owner_or_admin(current, target)
    return current
