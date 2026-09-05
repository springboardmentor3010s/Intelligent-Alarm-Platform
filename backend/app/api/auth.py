"""Authentication routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.auth import AuthService
from ..schemas.auth import AuthRegisterReq, AuthLoginReq, AuthRes, UserProfileRes
from ..Models import User, UserRole
from ..api.deps import oauth2_scheme, get_current_user, get_or_create_role

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthRes)
async def register(
    payload: AuthRegisterReq,
    db: Session = Depends(get_db),
):
    """Register a new user."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = AuthService._hash_password(payload.password)
    user = User(
        email=payload.email,
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
    db.commit()

    # Create tokens
    access_token = AuthService._create_access_token(subject=str(user.id))
    refresh_token = AuthService._create_refresh_token(subject=str(user.id))
    
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
    db: Session = Depends(get_db),
):
    """Login user and issue JWT tokens."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not AuthService._verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = AuthService._create_access_token(subject=str(user.id))
    refresh_token = AuthService._create_refresh_token(subject=str(user.id))
    
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
    from ..schemas.auth import UserProfileRes
    
    user_profile = UserProfileRes(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        timezone=current_user.timezone or "UTC",
        difficulty_preference=current_user.difficulty_preference or "Medium",
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )
    
    return user_profile