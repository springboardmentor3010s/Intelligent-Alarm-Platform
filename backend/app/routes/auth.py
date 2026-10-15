import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rate_limit import login_limiter
from app.core.security import (
    ROLE_USER,
    create_access_token,
    create_state_token,
    get_current_user,
    hash_password,
    user_payload,
    verify_password,
    verify_state_token,
)
from app.db.database import get_db
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.profile import UserProfile
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    timezone: str = "Asia/Kolkata"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def _check_password_strength(password: str) -> None:
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter and one number.",
        )


def _check_timezone(name: str) -> str:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown time zone. Use a name such as Asia/Kolkata.",
        )
    return name


def _token_response(user: User) -> dict:
    token, lifetime = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": lifetime,
        "user": user_payload(user),
    }


def _create_user(
    db: Session,
    full_name: str,
    email: str,
    password: str,
    timezone_name: str,
    provider: str = "local",
) -> User:
    user = User(
        full_name=full_name.strip(),
        email=email,
        password_hash=hash_password(password),
        role=ROLE_USER,  # self-service sign-up can never create staff
        timezone=timezone_name,
        auth_provider=provider,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id))
    db.add(NotificationPreference(user_id=user.id))
    db.add(
        Notification(
            user_id=user.id,
            title="Welcome to Cognitive Alarm",
            message=(
                "Set your wake-up time in Settings, then create your "
                "first alarm."
            ),
            category="general",
        )
    )
    return user


def _limiter_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{email}|{host}"


def _authenticate(
    request: Request, db: Session, email: str, password: str
) -> User:
    email = email.strip().lower()
    key = _limiter_key(request, email)

    if login_limiter.is_blocked(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please try again in 15 minutes.",
        )

    user = db.execute(
        select(User).where(func.lower(User.email) == email)
    ).scalar_one_or_none()

    valid = (
        user is not None
        and user.is_active
        and verify_password(password, user.password_hash)
    )

    if not valid:
        login_limiter.record_failure(key)
        # The same message for every failure: do not reveal which emails exist.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    login_limiter.reset(key)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return user


# ---------------------------------------------------------
# REGISTER, LOGIN, TOKEN
# ---------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    _check_password_strength(body.password)
    timezone_name = _check_timezone(body.timezone)

    existing = db.execute(
        select(User.id).where(func.lower(User.email) == email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = _create_user(
        db, body.full_name, email, body.password, timezone_name
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    db.refresh(user)
    return _token_response(user)


@router.post("/login")
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _authenticate(request, db, str(body.email), body.password)
    return _token_response(user)


@router.post("/token")
def oauth2_password_token(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """OAuth2 password flow. It lets the Swagger "Authorize" button work."""
    user = _authenticate(request, db, form.username, form.password)
    return _token_response(user)


@router.get("/me")
def me(current: User = Depends(get_current_user)):
    return user_payload(current)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    _check_password_strength(body.new_password)
    current.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed."}


# ---------------------------------------------------------
# GOOGLE OAUTH2 LOGIN
# ---------------------------------------------------------

@router.get("/oauth/providers")
def oauth_providers():
    return {"google": settings.google_oauth_enabled}


@router.get("/oauth/google/login")
def google_login():
    if not settings.google_oauth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured.",
        )
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": create_state_token("google_oauth"),
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}")


def _login_redirect(**params) -> RedirectResponse:
    base = settings.frontend_url.rstrip("/") + "/login"
    if "error" in params:
        return RedirectResponse(f"{base}?{urlencode(params)}")
    return RedirectResponse(f"{base}#{urlencode(params)}")


@router.get("/oauth/google/callback")
def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    if error or not code or not state:
        return _login_redirect(error="Google sign-in was cancelled.")

    if not settings.google_oauth_enabled:
        return _login_redirect(error="Google login is not configured.")

    # The state value stops forged callbacks (CSRF).
    if not verify_state_token(state, "google_oauth"):
        return _login_redirect(error="Sign-in expired. Please try again.")

    import httpx

    try:
        token_response = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        info_response = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        info_response.raise_for_status()
        info = info_response.json()
    except (httpx.HTTPError, KeyError, ValueError):
        return _login_redirect(error="Google sign-in failed. Please try again.")

    email = str(info.get("email", "")).strip().lower()
    if not email or not info.get("email_verified"):
        return _login_redirect(error="Your Google email is not verified.")

    user = db.execute(
        select(User).where(func.lower(User.email) == email)
    ).scalar_one_or_none()

    if user is None:
        user = _create_user(
            db,
            info.get("name") or email.split("@")[0],
            email,
            secrets.token_urlsafe(32),  # unusable password for OAuth accounts
            "Asia/Kolkata",
            provider="google",
        )
    elif not user.is_active:
        return _login_redirect(error="This account is disabled.")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token, _ = create_access_token(user)
    return _login_redirect(token=token)
