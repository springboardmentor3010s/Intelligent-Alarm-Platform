# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""External messaging adapter interface.

Isolates push-delivery providers behind a single interface. The default
provider is a strict no-op so nothing is fabricated or silently swallowed;
real delivery is opt-in with ``PUSH_PROVIDER=expo``, which routes
notifications to FCM (Android) and APNs (iOS) through Expo's push relay.

Delivery is best-effort and never raises on transport failure. Callers get a
structured result per token so they can log, retry, or drop dead tokens.
``httpx`` is imported lazily because it is intentionally absent from the lean
Docker runtime image.
"""

from __future__ import annotations

import logging
from typing import Protocol

from ..core import config

logger = logging.getLogger("notifications.messaging")

DEFAULT_CHANNEL_ID = "cerebrokognit-alarms"

# Expo ticket errors that mean the token is permanently unusable.
_DEAD_TOKEN_REASONS = {"DeviceNotRegistered", "MismatchSenderId"}


class MessagingProvider(Protocol):
    """Contract every push provider must satisfy."""

    name: str

    def send(self, token: str, payload: dict) -> dict:
        """Deliver a notification payload to a device token and return a result."""


class NoopProvider:
    """Strict placeholder that raises until a real provider is enabled."""

    name = "noop"

    @staticmethod
    def send(token: str, payload: dict) -> dict:
        raise NotImplementedError(
            "Push delivery is not configured. Set PUSH_PROVIDER=expo to enable "
            "FCM/APNs delivery through Expo's push service."
        )


def _http_post(url: str, json: dict, headers: dict, timeout: float):
    """Lazy ``httpx`` POST — httpx is omitted from the lean Docker runtime."""
    import httpx

    return httpx.post(url, json=json, headers=headers, timeout=timeout)


class ExpoPushProvider:
    """Expo Push Service provider (relays to FCM on Android and APNs on iOS)."""

    name = "expo"

    def __init__(self, access_token: str | None = None, timeout: float = 10.0):
        self.access_token = access_token if access_token is not None else config.get_expo_access_token() or None
        self.url = config.get_push_expo_url()
        self.timeout = timeout

    def send(self, token: str, payload: dict) -> dict:
        message = {
            "to": token,
            "title": payload.get("title", "CerebroKognit"),
            "body": payload.get("body", ""),
            "sound": payload.get("sound", "default"),
            "priority": payload.get("priority", "high"),
            "channelId": payload.get("channelId", DEFAULT_CHANNEL_ID),
            "data": payload.get("data", {}),
        }
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        try:
            response = _http_post(self.url, json=message, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            body = response.json()
        except Exception as exc:  # network / HTTP / decode failure
            logger.warning("push.transport_failed token=%s... error=%s", token[:14], exc)
            return {"status": "error", "token": token, "error": str(exc), "invalid_token": False}

        ticket = body.get("data") if isinstance(body, dict) else None
        return self._interpret(token, ticket if isinstance(ticket, dict) else {})

    @staticmethod
    def _interpret(token: str, ticket: dict) -> dict:
        if ticket.get("status") == "ok":
            return {
                "status": "ok",
                "token": token,
                "ticket_id": ticket.get("id"),
                "invalid_token": False,
            }
        details = ticket.get("details") or {}
        reason = details.get("error") or ticket.get("message") or "unknown"
        return {
            "status": "error",
            "token": token,
            "error": reason,
            "invalid_token": reason in _DEAD_TOKEN_REASONS,
        }


_PROVIDERS = {"noop": NoopProvider, "expo": ExpoPushProvider}
_cached: MessagingProvider | None = None


def get_provider() -> MessagingProvider:
    """Return the process-wide provider selected by ``PUSH_PROVIDER`` (default noop)."""
    global _cached
    if _cached is None:
        key = config.get_push_provider()
        _cached = _PROVIDERS.get(key, NoopProvider)()  # type: ignore[assignment]
        logger.info("push.provider_selected provider=%s", getattr(_cached, "name", key))
    return _cached


def reset_provider() -> None:
    """Clear the cached provider (used by tests after changing env)."""
    global _cached
    _cached = None


def send(token: str, payload: dict) -> dict:
    """Send via the currently configured provider."""
    return get_provider().send(token, payload)
