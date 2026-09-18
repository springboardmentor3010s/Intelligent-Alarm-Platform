# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Authentication routes for Intelligent Cognitive Alarm Platform.

Handles registration, login, token refresh, password reset, and email
verification.  All security-sensitive events are recorded in the audit log.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.auth import AuthService
from ..services.token_service import (
    create_auth_token,
    verify_auth_token,
    revoke_all_tokens,
)
from ..services.audit_service import log_event
from ..integrations.email_sender import get_email_sender
from ..schemas.auth import (
    AuthRegisterReq,
    AuthLoginReq,
    AuthRes,
    UserProfileRes,
    RefreshReq,
    PasswordResetRequestReq,
    PasswordResetConfirmReq,
    EmailVerifyConfirmReq,
)
from ..Models import User, UserRole
from ..api.deps import get_current_user, get_or_create_role

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("auth")


# ──────────────────────────────────────────────────────────────────
# Registration & Login
# ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthRes)
async def register(
    payload: AuthRegisterReq,
    db: Session = Depends(get_db),
):
    """Register a new user."""
    normalized_email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = AuthService._hash_password(payload.password)
    user = User(
        email=normalized_email,
        full_name=payload.full_name,
        hashed_password=hashed_pw,
        timezone=payload.timezone,
        difficulty_preference=payload.difficulty_preference or "Medium",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Assign default "User" role (role based access control)
    user_role = get_or_create_role(db, "User", "Standard registered user")
    db.add(UserRole(user_id=user.id, role_id=user_role.id))

    # Issue tokens
    access_token = AuthService._create_access_token(subject=str(user.id))
    refresh_token = AuthService._create_refresh_token(subject=str(user.id))

    # Persist refresh token hash for rotation / revocation
    create_auth_token(db, user.id, "refresh", raw_token=refresh_token)

    db.commit()

    user_profile = UserProfileRes(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        timezone=user.timezone or "UTC",
        difficulty_preference=user.difficulty_preference or "Medium",
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )

    return AuthRes(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=3600,
        user=user_profile,
    )


@router.post("/login", response_model=AuthRes)
async def login(
    payload: AuthLoginReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """Login user and issue JWT tokens."""
    normalized_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    client_ip = request.client.host if request.client else None

    if not user or not AuthService._verify_password(payload.password, user.hashed_password):
        # Record failed login (persisted before raising so the event survives)
        log_event(db, "login.failed", actor_email=normalized_email, ip_address=client_ip)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        log_event(
            db, "login.blocked_inactive", user_id=user.id,
            actor_email=normalized_email, ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    access_token = AuthService._create_access_token(subject=str(user.id))
    refresh_token = AuthService._create_refresh_token(subject=str(user.id))

    # Persist refresh token hash for rotation / revocation
    create_auth_token(db, user.id, "refresh", raw_token=refresh_token)
    log_event(db, "login.success", user_id=user.id, actor_email=normalized_email, ip_address=client_ip)
    db.commit()

    user_profile = UserProfileRes(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        timezone=user.timezone or "UTC",
        difficulty_preference=user.difficulty_preference or "Medium",
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )

    return AuthRes(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=3600,
        user=user_profile,
    )


@router.get("/me", response_model=UserProfileRes)
async def me(
    current_user: User = Depends(get_current_user),
):
    """Get current user profile."""
    return UserProfileRes(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        timezone=current_user.timezone or "UTC",
        difficulty_preference=current_user.difficulty_preference or "Medium",
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )


# ──────────────────────────────────────────────────────────────────
# Token refresh
# ──────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=AuthRes)
async def refresh(
    payload: RefreshReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """Rotate a valid refresh token for a fresh access + refresh pair.

    The previous refresh token is revoked (single-use) so a replay always fails.
    """
    # Decode and validate the JWT envelope first
    decoded = AuthService._decode_token(payload.refresh_token)
    if decoded is None or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify against the server-side token store
    user_id = verify_auth_token(db, payload.refresh_token, "refresh")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired, revoked, or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issue new pair + persist new refresh token
    access_token = AuthService._create_access_token(subject=str(user.id))
    refresh_token = AuthService._create_refresh_token(subject=str(user.id))
    create_auth_token(db, user.id, "refresh", raw_token=refresh_token)

    client_ip = request.client.host if request.client else None
    log_event(db, "token.refreshed", user_id=user.id, actor_email=user.email, ip_address=client_ip)
    db.commit()

    user_profile = UserProfileRes(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        timezone=user.timezone or "UTC",
        difficulty_preference=user.difficulty_preference or "Medium",
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )

    return AuthRes(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=3600,
        user=user_profile,
    )


# ──────────────────────────────────────────────────────────────────
# Password reset
# ──────────────────────────────────────────────────────────────────

@router.post("/password-reset/request", status_code=status.HTTP_200_OK)
async def password_reset_request(
    payload: PasswordResetRequestReq,
    request: Request,
    db: Session = Depends(get_db),
    sender = Depends(get_email_sender),
):
    """Initiate a password reset.  Always returns 200 with a generic message
    to prevent user-enumeration attacks."""
    client_ip = request.client.host if request.client else None
    normalized_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()

    if user is not None and user.is_active:
        raw_token = create_auth_token(db, user.id, "password_reset")
        log_event(
            db, "password_reset.requested", user_id=user.id,
            actor_email=normalized_email, ip_address=client_ip,
        )
        db.commit()

        # Attempt delivery (best-effort; degrade gracefully)
        try:
            sender.send_password_reset(user.email, raw_token)
        except NotImplementedError:
            logger.info(
                "Password-reset token created but email provider not wired; "
                "token delivered via dev sender for user_id=%s",
                user.id,
            )
        except Exception:
            logger.exception("Unexpected error sending password-reset email")

    # Always return generic response regardless of whether user exists
    return {"message": "If an account exists with that email, a password reset link has been sent."}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def password_reset_confirm(
    payload: PasswordResetConfirmReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """Confirm a password-reset token and set a new password.

    The token is single-use and expires after 30 minutes.  All active refresh
    tokens for the user are revoked so any existing sessions are invalidated.
    """
    user_id = verify_auth_token(db, payload.token, "password_reset")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = AuthService._hash_password(payload.new_password)

    # Invalidate all existing sessions
    revoke_all_tokens(db, user.id, kind="refresh")

    client_ip = request.client.host if request.client else None
    log_event(
        db, "password_reset.completed", user_id=user.id,
        actor_email=user.email, ip_address=client_ip,
    )
    db.commit()

    return {"message": "Password updated successfully. Please log in with your new password."}


# ──────────────────────────────────────────────────────────────────
# Email verification
# ──────────────────────────────────────────────────────────────────

@router.post("/verify-email/request", status_code=status.HTTP_200_OK)
async def verify_email_request(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    sender = Depends(get_email_sender),
):
    """Send an email-verification link to the current user.

    Idempotent: if the user is already verified the token is not created.
    """
    if current_user.is_verified:
        return {"message": "Email is already verified."}

    raw_token = create_auth_token(db, current_user.id, "email_verification")

    try:
        sender.send_verification(current_user.email, raw_token)
    except NotImplementedError:
        logger.info(
            "Verification token created but email provider not wired; "
            "token delivered via dev sender for user_id=%s",
            current_user.id,
        )
    except Exception:
        logger.exception("Unexpected error sending verification email")

    db.commit()
    return {"message": "If your email is not yet verified, a verification link has been sent."}


@router.post("/verify-email/confirm", status_code=status.HTTP_200_OK)
async def verify_email_confirm(
    payload: EmailVerifyConfirmReq,
    db: Session = Depends(get_db),
):
    """Confirm an email-verification token and mark the user as verified."""
    user_id = verify_auth_token(db, payload.token, "email_verification")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    db.commit()

    return {"message": "Email verified successfully.", "is_verified": True}
