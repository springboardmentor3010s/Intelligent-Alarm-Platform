from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer),
                     db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                                 headers={"WWW-Authenticate": "Bearer"})
    if not creds:
        raise unauthorized
    payload = decode_access_token(creds.credentials)
    if not payload:
        raise unauthorized
    try:
        uid = UUID(payload.get("sub", ""))
    except ValueError:
        raise unauthorized
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise unauthorized
    return user  # role is always re-read from the DB, never trusted from the token


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to do that.")
        return user
    return checker
