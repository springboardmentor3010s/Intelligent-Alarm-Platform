"""Notification service for Intelligent Cognitive Alarm Platform.

Manages device push-token registration (P5) and provides the channel
abstraction for alarm/dismiss notifications. Delivery itself is isolated in
`integrations/messaging` (FCM/APNs planned); this service owns the boundary:
token persistence + the `send` surface callers depend on.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import User, PushToken


class NotificationService:
    """Boundary for alarm notification delivery and token management."""

    @staticmethod
    def register_token(
        db: Session, user: User, token: str, platform: str
    ) -> PushToken:
        """Register (idempotent) a device push token for the user."""
        token = token.strip()
        if not token:
            raise HTTPException(status_code=400, detail="Push token cannot be empty")

        existing = db.query(PushToken).filter(PushToken.token == token).first()
        if existing:
            # Reassign ownership if the token moved between accounts
            existing.user_id = user.id
            existing.platform = platform
            db.commit()
            db.refresh(existing)
            return existing

        push_token = PushToken(user_id=user.id, token=token, platform=platform)
        db.add(push_token)
        db.commit()
        db.refresh(push_token)
        return push_token

    @staticmethod
    def deregister_token(db: Session, user: User, token: str) -> bool:
        """Remove a device push token (no-op if not registered)."""
        existing = db.query(PushToken).filter(
            PushToken.token == token,
            PushToken.user_id == user.id,
        ).first()
        if existing is None:
            return False
        db.delete(existing)
        db.commit()
        return True

    @staticmethod
    def list_tokens(db: Session, user: User) -> list[dict]:
        """Return the user's registered push tokens."""
        rows = (
            db.query(PushToken)
            .filter(PushToken.user_id == user.id)
            .order_by(PushToken.created_at.asc())
            .all()
        )
        return [
            {
                "id": t.id,
                "token": t.token,
                "platform": t.platform,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in rows
        ]

    @staticmethod
    def send(token: str, payload: dict) -> None:
        """Deliver a notification through the configured channel.

        Delegates to `integrations.messaging`; FCM/APNs delivery is planned,
        so this raises a clear error until a provider is wired.
        """
        from ..integrations import messaging

        messaging.send(token, payload)
