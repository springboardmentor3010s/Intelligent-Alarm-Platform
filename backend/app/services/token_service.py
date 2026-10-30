# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Token storage service for refresh, password-reset, and email-verification tokens.

Only SHA-256 hashes of raw tokens are persisted.  The raw plaintext is returned
to the caller (API endpoint) exactly once and never stored or logged.
"""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..Models import AuthToken

# Default expiry windows per token kind
_KIND_TTL = {
    "refresh": timedelta(days=30),
    "password_reset": timedelta(minutes=30),
    "email_verification": timedelta(hours=24),
}


def hash_token(token: str) -> str:
    """Return the hex-encoded SHA-256 hash of a plaintext token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_auth_token(
    db: Session,
    user_id: int,
    kind: str,
    raw_token: str | None = None,
    ttl: timedelta | None = None,
) -> str:
    """Persist a new token and return the raw plaintext (seen once by the caller).

    If *raw_token* is not provided a secure random token is generated.  This is
    the only time the raw value is ever returned.
    """
    if raw_token is None:
        raw_token = secrets.token_urlsafe(48)
    token_hash = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + (ttl or _KIND_TTL.get(kind, timedelta(hours=1)))

    row = AuthToken(
        user_id=user_id,
        kind=kind,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(row)
    db.flush()
    return raw_token


def verify_auth_token(
    db: Session,
    raw_token: str,
    kind: str,
) -> int | None:
    """Validate a raw token and return the owning user_id on success.

    On success the token row is immediately marked as *used* (used_at set,
    revoked=True) making it single-use.  Returns ``None`` on any failure.
    """
    token_hash = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    row = (
        db.query(AuthToken)
        .filter(
            AuthToken.token_hash == token_hash,
            AuthToken.kind == kind,
            AuthToken.revoked == False,  # noqa: E712
        )
        .first()
    )
    if row is None:
        return None
    if row.expires_at.replace(tzinfo=timezone.utc) < now:
        return None
    if row.user_id is None:
        return None
    # Mark single-use: revoke + stamp
    row.used_at = now
    row.revoked = True
    db.flush()
    return row.user_id


def revoke_all_tokens(db: Session, user_id: int, kind: str | None = None) -> None:
    """Bulk-revoke every active token for *user_id* (optionally filtered by kind).

    Called on password change, deactivation, and manual logout.
    """
    q = db.query(AuthToken).filter(
        AuthToken.user_id == user_id,
        AuthToken.revoked == False,  # noqa: E712
    )
    if kind is not None:
        q = q.filter(AuthToken.kind == kind)
    now = datetime.now(timezone.utc)
    for row in q.all():
        row.revoked = True
        row.used_at = now
    db.flush()



