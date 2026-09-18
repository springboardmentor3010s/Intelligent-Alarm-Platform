# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Notification service for the Intelligent Cognitive Alarm Platform.

Owns the push-token lifecycle (registration, deregistration, listing — P5)
and the delivery boundary: fan-out to every device a user owns, a structured
delivery summary, duplicate suppression, and auto-removal of tokens the
provider reports as invalid (e.g. Expo ``DeviceNotRegistered``).

Delivery is delegated to the configured messaging provider (default: strict
no-op that raises). Nothing is fabricated when a provider is not enabled —
the summary reports ``configured=False``.
"""

import logging
import threading

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import User, PushToken

logger = logging.getLogger("notifications")

# Delivered (alarm, next_trigger) pairs are remembered for the life of the
# process so a retried/duplicate delivery attempt does not spam the device.
_delivered: set[str] = set()
_delivered_lock = threading.Lock()


def reset_delivery_cache() -> None:
    """Clear the duplicate-suppression cache (used by tests)."""
    with _delivered_lock:
        _delivered.clear()


class NotificationService:
    """Boundary between alarm lifecycle events and device delivery."""

    # ------------------------------------------------------------------
    # Token lifecycle (P5)
    # ------------------------------------------------------------------

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
        """Remove a device push token (no-op if not registered to the user)."""
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
        """Return the user's registered push tokens (youngest first)."""
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

    # ------------------------------------------------------------------
    # Delivery boundary
    # ------------------------------------------------------------------

    @staticmethod
    def send(token: str, payload: dict) -> dict:
        """Send one payload to one token via the configured provider."""
        from ..integrations import messaging

        return messaging.get_provider().send(token, payload)

    @staticmethod
    def deliver_to_user(
        db: Session,
        user: User,
        title: str,
        body: str,
        data: dict | None = None,
        dedupe_key: str | None = None,
    ) -> dict:
        """Fan a notification out to every token the user has registered.

        Returns a structured summary. Tokens the provider marks invalid are
        removed from the registry (a dead token is not retried forever). A
        repeated ``dedupe_key`` is suppressed and reported as ``duplicate``.
        """
        from ..integrations import messaging

        provider = messaging.get_provider()
        provider_name = getattr(provider, "name", "unknown")

        if dedupe_key:
            with _delivered_lock:
                if dedupe_key in _delivered:
                    logger.info(
                        "push.duplicate key=%s user_id=%s", dedupe_key, user.id
                    )
                    return {
                        "attempted": 0,
                        "sent": 0,
                        "failed": 0,
                        "invalid_removed": 0,
                        "duplicate": True,
                        "provider": provider_name,
                        "configured": True,
                    }
                _delivered.add(dedupe_key)

        tokens = (
            db.query(PushToken).filter(PushToken.user_id == user.id).all()
        )
        payload = {"title": title, "body": body, "data": data or {}}
        summary = {
            "attempted": len(tokens),
            "sent": 0,
            "failed": 0,
            "invalid_removed": 0,
            "duplicate": False,
            "provider": provider_name,
            "configured": True,
        }

        for row in tokens:
            try:
                result = provider.send(row.token, payload)
            except NotImplementedError as exc:
                summary["configured"] = False
                logger.info(
                    "push.not_configured provider=%s user_id=%s error=%s",
                    provider_name, user.id, exc,
                )
                continue
            except Exception as exc:  # provider is defensive; never crash a send
                logger.exception(
                    "push.provider_error provider=%s user_id=%s",
                    provider_name, user.id,
                )
                result = {
                    "status": "error",
                    "token": row.token,
                    "error": str(exc),
                    "invalid_token": False,
                }

            if result.get("status") == "ok":
                summary["sent"] += 1
            else:
                summary["failed"] += 1
                if result.get("invalid_token"):
                    db.delete(row)
                    summary["invalid_removed"] += 1
                    logger.info(
                        "push.token_removed user_id=%s token=%s... reason=%s",
                        user.id, row.token[:14], result.get("error"),
                    )

        if summary["invalid_removed"]:
            db.commit()

        logger.info(
            "push.delivered user_id=%s provider=%s attempted=%s sent=%s failed=%s "
            "invalid_removed=%s duplicate=%s configured=%s",
            user.id, provider_name, summary["attempted"], summary["sent"],
            summary["failed"], summary["invalid_removed"],
            summary["duplicate"], summary["configured"],
        )
        return summary

    # ------------------------------------------------------------------
    # Alarm-specific helpers
    # ------------------------------------------------------------------

    @staticmethod
    def send_alarm_due(db: Session, alarm) -> dict:
        """Notify the alarm's owner that it is due.

        The payload carries the alarm id + challenge pointer so the pushed-open
        mobile screen can load the right challenge without leaking answers.
        """
        user = alarm.user
        challenge_type = (
            alarm.challenge.challenge_type if alarm.challenge else "cognitive"
        )
        difficulty = alarm.challenge.difficulty if alarm.challenge else None
        next_iso = alarm.next_trigger.isoformat() if alarm.next_trigger else None

        title = alarm.title or "Wake up"
        body = f"Solve the {challenge_type} challenge to dismiss this alarm."
        data = {
            "type": "alarm",
            "alarm_id": alarm.id,
            "challenge_type": challenge_type,
            "difficulty": difficulty,
            "next_trigger": next_iso,
        }
        dedupe_key = f"alarm:{alarm.id}:{next_iso}" if next_iso else None

        summary = NotificationService.deliver_to_user(
            db, user, title, body, data, dedupe_key=dedupe_key
        )
        summary["alarm_id"] = alarm.id
        return summary

    @staticmethod
    def send_test(db: Session, user: User) -> dict:
        """Deliver a test notification to the user's own devices."""
        return NotificationService.deliver_to_user(
            db,
            user,
            "CerebroKognit test",
            "Notifications are working on this device.",
            {"type": "test"},
        )
