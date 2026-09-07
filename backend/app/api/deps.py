"""Security and role-based access control dependencies for CerebroKognit.

Centralizes JWT auth (`get_current_user`), the OAuth2 bearer scheme, and
RBAC guards (`require_roles`, `get_or_create_role`).
"""

from jwt import PyJWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import Role, UserRole, User
from ..services.auth import AuthService

# OAuth2 password bearer scheme for JWT tokens
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate JWT and return the current user."""
    try:
        payload_data = AuthService._decode_token(token)
        if payload_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id: int = payload_data.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


def require_roles(*role_names: str):
    """Dependency factory requiring the current user to hold at least one given role.

    Usage:
        current_user: User = Depends(require_roles("Administrator", "Wellness Coach"))
    """
    def _dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        rows = (
            db.query(Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(UserRole.user_id == current_user.id)
            .all()
        )
        granted = {name for (name,) in rows}
        if not granted.intersection(role_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(role_names)}",
            )
        return current_user

    return _dependency


def get_or_create_role(db: Session, name: str, description: str = "") -> Role:
    """Return the role with the given name, creating it if missing."""
    role = db.query(Role).filter(Role.name == name).first()
    if role is None:
        role = Role(name=name, description=description)
        db.add(role)
        db.flush()
    return role
