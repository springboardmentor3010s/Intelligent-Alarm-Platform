from fastapi import (
    Depends,
    HTTPException,
    status
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import User
from app.utils.security import decode_access_token



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user


def require_admin(
    current_user: User = Depends(
        get_current_user
    )
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


def require_wellness_coach(
    current_user: User = Depends(
        get_current_user
    )
):
    if current_user.role != "wellness_coach":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Wellness coach access required"
        )

    return current_user


def require_coach_or_admin(
    current_user: User = Depends(
        get_current_user
    )
):
    if current_user.role not in ["wellness_coach", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Wellness coach or Admin access required"
        )

    return current_user