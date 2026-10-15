from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db

# Primary hasher: argon2 — no passlib, no bcrypt dependency
_password_hash = PasswordHash((Argon2Hasher(),))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    """Hash a password using argon2."""
    return _password_hash.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a password against its hash.
    Supports argon2 hashes (new) and bcrypt hashes (legacy migration).
    """
    if hashed.startswith("$argon2"):
        return _password_hash.verify(plain, hashed)

    # Legacy bcrypt hash — use bcrypt directly (no passlib)
    if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
        try:
            import bcrypt as _bcrypt
            return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False

    return False


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_oauth_state_token() -> str:
    """Short-lived, signed CSRF token for the OAuth2 authorize/callback round-trip."""
    import secrets
    payload = {
        "purpose": "oauth_state",
        "nonce": secrets.token_urlsafe(8),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_oauth_state_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("purpose") == "oauth_state"
    except JWTError:
        return False


def create_oauth_signup_token(provider: str, provider_id: str, email: str, name: str) -> str:
    """Short-lived token carrying a brand-new OAuth identity until the user picks a role.
    Deliberately has no "sub" claim so get_current_user() can never accept it as an access token."""
    payload = {
        "purpose": "oauth_signup",
        "provider": provider,
        "provider_id": provider_id,
        "email": email,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_oauth_signup_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "oauth_signup":
            return None
        return payload
    except JWTError:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    from app.models.models import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def require_role(*roles: str):
    def checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return checker
