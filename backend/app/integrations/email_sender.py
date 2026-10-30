# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Email sender abstraction (Phase 2).

Follows the same pattern as ``integrations/messaging.py`` (NoopProvider until a
real provider is wired).  The dependency is **injectable** so that tests can
capture outbound tokens without needing an SMTP relay or third-party service.

Production note:
  Until a real delivery backend is wired the NoopSender will raise on every
  send.  API routes are written to degrade gracefully (token is created and
  stored; delivery failure is logged and a generic success message is returned
  so the endpoint never reveals whether the user exists or not).
"""

from typing import Protocol


class EmailSender(Protocol):
    """Minimal contract for outbound email delivery."""

    def send_password_reset(self, email: str, token: str) -> None:
        """Deliver a password-reset token to *email*."""
        ...

    def send_verification(self, email: str, token: str) -> None:
        """Deliver an email-verification token to *email*."""
        ...


class NoopSender:
    """Placeholder that raises until a real provider is wired (mirrors NoopProvider)."""

    def send_password_reset(self, email: str, token: str) -> None:
        raise NotImplementedError(
            "Email provider not configured; password-reset token created "
            "but could not be delivered."
        )

    def send_verification(self, email: str, token: str) -> None:
        raise NotImplementedError(
            "Email provider not configured; verification token created "
            "but could not be delivered."
        )


def get_email_sender() -> NoopSender:
    """FastAPI dependency returning the configured email sender.

    Override in tests via ``app.dependency_overrides[get_email_sender]`` to
    capture tokens without a real SMTP relay.
    """
    return NoopSender()
