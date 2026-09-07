"""External messaging adapter interface.

Isolates push-delivery providers (FCM / APNs) behind a single interface.
Concrete provider implementations are **planned**; per §25 nothing is
fabricated. The Expo token capture already exists on mobile
(`mobile/src/hooks/useNotifications.jsx`), and the registration endpoint
persists tokens via `notification_service`.
"""

from typing import Any, Protocol


class MessagingProvider(Protocol):
    """Contract every push provider must satisfy."""

    def send(self, token: str, payload: dict) -> None:
        """Deliver a notification payload to a device token."""


class NoopProvider:
    """Placeholder that raises until a real provider is wired."""

    @staticmethod
    def send(token: str, payload: dict) -> Any:
        raise NotImplementedError(
            "FCM/APNs provider is planned; tokens are persisted but delivery is not wired yet"
        )


def send(token: str, payload: dict) -> None:
    """Send via the currently configured provider (Noop until wired)."""
    NoopProvider.send(token, payload)
