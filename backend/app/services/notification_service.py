"""Notification service interface.

Alarm notification scheduling and push-token registration are wired in P5
via the `integrations/messaging` adapter and a `push_tokens` persistence
table. This module declares the service boundary so callers depend only on
the interface.
"""

from sqlalchemy.orm import Session

from ..Models import User


class NotificationService:
    """Boundary for alarm notification delivery."""

    @staticmethod
    def register_token(db: Session, user: User, token: str, platform: str) -> dict:
        """Persist a device push token for the user."""
        raise NotImplementedError("Wire push-token persistence in P5")

    @staticmethod
    def schedule(delay_seconds: int, payload: dict) -> None:
        """Schedule a notification delivery."""
        raise NotImplementedError("Wire platform scheduling in P5")
