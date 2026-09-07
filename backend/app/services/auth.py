"""Authentication service for Intelligent Cognitive Alarm Platform."""

import os
import jwt
import bcrypt
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from app.Models import User
from ..schemas.auth import AuthRegisterReq, AuthLoginReq, AuthRes, UserProfileRes


class AuthService:
    """Authentication service handling user registration and login."""

    SECRET_KEY = os.getenv(
        "SECRET_KEY", "change_this_to_a_very_random_secret_key_min_32_bytes"
    )
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60
    REFRESH_TOKEN_EXPIRE_DAYS = 30

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
        encoded_jwt = jwt.encode(to_encode, cls.SECRET_KEY, algorithm=cls.ALGORITHM)
        return encoded_jwt

    @classmethod
    def _create_refresh_token(cls, subject: str) -> str:
        """Create JWT refresh token."""
        expire = datetime.now(timezone.utc) + timedelta(days=cls.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode = {"sub": subject, "exp": expire, "iat": datetime.now(timezone.utc), "type": "refresh", "jti": uuid4().hex}
        encoded_jwt = jwt.encode(to_encode, cls.SECRET_KEY, algorithm=cls.ALGORITHM)
        return encoded_jwt

    @classmethod
    def _decode_token(cls, token: str) -> Optional[dict]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(token, cls.SECRET_KEY, algorithms=[cls.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    @classmethod
    async def register(
        cls, payload: AuthRegisterReq, db: Session
    ) -> AuthRes:
        """Register a new user."""
        # Check if user exists
        from app.Models import User
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create user with hashed password
        hashed_pw = cls._hash_password(payload.password)
        user = User(
            email=payload.email,
            hashed_password=hashed_pw,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create tokens
        access_token = cls._create_access_token(subject=str(user.id))
        refresh_token = cls._create_refresh_token(str(user.id))

        # Build user profile response
        user_profile = UserProfileRes(
            id=user.id,
            email=user.email,
            timezone=payload.timezone,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at.isoformat() if user.created_at else "",
        )

        return AuthRes(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=cls.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_profile,
        )

    @classmethod
    async def login(
        cls, payload: AuthLoginReq, db: Session
    ) -> AuthRes:
        """Login user and issue JWT tokens."""
        user = db.query(User).filter(User.email == payload.email).first()
        if not user or not cls._verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = cls._create_access_token(subject=str(user.id))
        refresh_token = cls._create_refresh_token(str(user.id))

        user_profile = UserProfileRes(
            id=user.id,
            email=user.email,
            timezone="UTC",
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at.isoformat() if user.created_at else "",
        )

        return AuthRes(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=cls.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_profile,
        )
