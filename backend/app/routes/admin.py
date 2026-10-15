from datetime import datetime, timedelta, timezone

import jwt

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.models.alarm import Alarm
from app.models.challenge_attempt import ChallengeAttempt
from app.models.wake_up_verification import WakeUpVerification
from app.models.notification import Notification


router = APIRouter(prefix="/admin", tags=["Admin"])

settings = get_settings()

password_hash = PasswordHash.recommended()

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserStatusUpdate(BaseModel):
    is_active: bool


class Announcement(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=2000)


# ---------------------------------------------------------
# TOKEN CREATION
# ---------------------------------------------------------

def create_access_token(user: User) -> str:
    secret = settings.admin_jwt_secret

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured.",
        )

    now = datetime.now(timezone.utc)

    expires_at = now + timedelta(
        minutes=settings.admin_token_expire_minutes
    )

    payload = {
        "sub": str(user.id),
        "role": "admin",
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        secret,
        algorithm="HS256",
    )


# ---------------------------------------------------------
# ADMIN LOGIN
# ---------------------------------------------------------

@router.post("/login")
def admin_login(
    body: AdminLoginRequest,
    db: Session = Depends(get_db),
):
    if not settings.admin_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured.",
        )

    email = str(body.email).strip().lower()

    user = db.execute(
        select(User).where(
            func.lower(User.email) == email
        )
    ).scalar_one_or_none()

    # Do not reveal whether an email address exists.
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Only active administrator accounts can use this login.
    if user.role != "admin" or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Verify the password against the stored password hash.
    try:
        password_is_valid = password_hash.verify(
            body.password,
            user.password_hash,
        )
    except Exception:
        # An incompatible or invalid stored hash must not
        # be treated as a successful authentication.
        password_is_valid = False

    if not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.admin_token_expire_minutes * 60,
        "admin": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
    }


# ---------------------------------------------------------
# AUTHENTICATION AND ADMIN AUTHORIZATION
# ---------------------------------------------------------

def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not settings.admin_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured.",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.admin_jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )

        user_id = int(payload["sub"])

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
        KeyError,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)

    # Check the current database record on every request.
    if (
        user is None
        or user.role != "admin"
        or not user.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active admin account is required.",
        )

    return user


# ---------------------------------------------------------
# CURRENT ADMIN
# ---------------------------------------------------------

@router.get("/me")
def current_admin(
    admin: User = Depends(require_admin),
):
    return {
        "id": admin.id,
        "full_name": admin.full_name,
        "email": admin.email,
        "role": admin.role,
    }


# ---------------------------------------------------------
# ADMIN DASHBOARD
# ---------------------------------------------------------

@router.get("/dashboard")
def dashboard(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return {
        "total_users": (
            db.scalar(select(func.count(User.id))) or 0
        ),
        "active_users": (
            db.scalar(
                select(func.count(User.id)).where(
                    User.is_active.is_(True)
                )
            ) or 0
        ),
        "total_alarms": (
            db.scalar(select(func.count(Alarm.id))) or 0
        ),
        "enabled_alarms": (
            db.scalar(
                select(func.count(Alarm.id)).where(
                    Alarm.enabled.is_(True)
                )
            ) or 0
        ),
        "challenge_attempts": (
            db.scalar(
                select(func.count(ChallengeAttempt.id))
            ) or 0
        ),
        "wake_up_verifications": (
            db.scalar(
                select(func.count(WakeUpVerification.id))
            ) or 0
        ),
        "successful_wakeups": (
            db.scalar(
                select(func.count(WakeUpVerification.id)).where(
                    WakeUpVerification.successful.is_(True)
                )
            ) or 0
        ),
        "admin": {
            "id": admin.id,
            "full_name": admin.full_name,
            "email": admin.email,
        },
    }


# ---------------------------------------------------------
# LIST USERS
# ---------------------------------------------------------

@router.get("/users")
def list_users(
    limit: int = 100,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(max(0, offset))
        .limit(max(1, min(limit, 200)))
    ).scalars().all()

    return {
        "items": [
            {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at,
            }
            for user in users
        ]
    }


# ---------------------------------------------------------
# UPDATE USER STATUS
# ---------------------------------------------------------

@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    body: UserStatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.id == admin.id and not body.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own admin account.",
        )

    user.is_active = body.is_active

    db.commit()

    return {
        "id": user.id,
        "is_active": user.is_active,
        "message": "User status updated.",
    }


# ---------------------------------------------------------
# ADMIN ANALYTICS
# ---------------------------------------------------------

@router.get("/analytics")
def analytics(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users_by_role = db.execute(
        select(
            User.role,
            func.count(User.id),
        ).group_by(User.role)
    ).all()

    successful_wakeups = (
        db.scalar(
            select(func.count(WakeUpVerification.id)).where(
                WakeUpVerification.successful.is_(True)
            )
        ) or 0
    )

    total_verifications = (
        db.scalar(
            select(func.count(WakeUpVerification.id))
        ) or 0
    )

    correct_attempts = (
        db.scalar(
            select(func.count(ChallengeAttempt.id)).where(
                ChallengeAttempt.is_correct.is_(True)
            )
        ) or 0
    )

    total_attempts = (
        db.scalar(
            select(func.count(ChallengeAttempt.id))
        ) or 0
    )

    return {
        "users_by_role": [
            {
                "role": role,
                "count": count,
            }
            for role, count in users_by_role
        ],
        "wake_up_success_rate_percent": round(
            100 * successful_wakeups
            / max(1, total_verifications),
            1,
        ),
        "challenge_accuracy_percent": round(
            100 * correct_attempts
            / max(1, total_attempts),
            1,
        ),
    }


# ---------------------------------------------------------
# SEND ANNOUNCEMENTS
# ---------------------------------------------------------

@router.post("/announcements")
def announce(
    body: Announcement,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.execute(
        select(User).where(
            User.is_active.is_(True)
        )
    ).scalars().all()

    for user in users:
        db.add(
            Notification(
                user_id=user.id,
                title=body.title,
                message=body.message,
                category="announcement",
            )
        )

    db.commit()

    return {
        "message": "Announcement sent.",
        "recipients": len(users),
    }