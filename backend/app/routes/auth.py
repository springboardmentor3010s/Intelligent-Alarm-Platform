from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import User, UserProfile
from app.utils.limiter import limiter

from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
)

from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
)

from app.utils.dependencies import get_current_user


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


# =========================================================
# REGISTER
# =========================================================

@router.post("/register")
@limiter.limit("20/minute")
def register(
    request: Request,
    data: RegisterRequest,
    db: Session = Depends(get_db),
    x_user_timezone: Optional[str] = Header(None, alias="X-User-Timezone"),
):
    # Check if email already exists
    existing_user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Determine assigned role safely (default: user, allow: wellness_coach, prevent self-assigning admin)
    requested_role = (data.role or "user").strip().lower()
    assigned_role = "wellness_coach" if requested_role == "wellness_coach" else "user"

    # Create user
    user = User(
        name=data.name.strip(),
        email=data.email,
        password_hash=hash_password(data.password),
        role=assigned_role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize UserProfile with client timezone if supplied
    if x_user_timezone and isinstance(x_user_timezone, str) and x_user_timezone.strip():
        profile = UserProfile(
            user_id=user.id,
            time_zone=x_user_timezone.strip(),
        )
        db.add(profile)
        db.commit()

    return {
        "message": "User registered successfully",

        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
@limiter.limit("30/minute")
def login(
    request: Request,
    data: LoginRequest,
    db: Session = Depends(get_db),
    x_user_timezone: Optional[str] = Header(None, alias="X-User-Timezone"),
):
    # Find user
    user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    # Verify password
    if not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    # Sync UserProfile timezone if currently unconfigured
    if x_user_timezone and isinstance(x_user_timezone, str) and x_user_timezone.strip():
        profile = (
            db.query(UserProfile)
            .filter(UserProfile.user_id == user.id)
            .first()
        )
        if not profile:
            new_profile = UserProfile(
                user_id=user.id,
                time_zone=x_user_timezone.strip(),
            )
            db.add(new_profile)
            db.commit()
        elif not profile.time_zone:
            profile.time_zone = x_user_timezone.strip()
            db.commit()

    # Create JWT
    access_token = create_access_token(
        user.id,
        user.role,
    )

    return {
        "message": "Login successful",

        "access_token": access_token,

        "token_type": "bearer",

        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


# =========================================================
# CURRENT USER
# =========================================================

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }