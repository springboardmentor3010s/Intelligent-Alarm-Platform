from datetime import datetime, timedelta, timezone

from jose import jwt

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from ..config import settings


ALGORITHM = "HS256"


def hash_password(password: str):

    return generate_password_hash(
        password
    )


def verify_password(
    password: str,
    password_hash: str
):

    return check_password_hash(
        password_hash,
        password
    )


def create_access_token(data: dict):

    payload = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    )

    payload["exp"] = expire

    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=ALGORITHM
    )


def decode_access_token(token: str):

    return jwt.decode(
        token,
        settings.secret_key,
        algorithms=[ALGORITHM]
    )