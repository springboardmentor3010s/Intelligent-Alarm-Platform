"""Audit logging service for security-relevant events.

Every event is written to the ``audit_logs`` table so post-incident forensics
are possible.  The helper also emits a structured log line at WARNING level.
"""

import logging
from typing import Any

from sqlalchemy.orm import Session

from ..Models import AuditLog

logger = logging.getLogger("security.audit")


def log_event(
    db: Session,
    event: str,
    *,
    user_id: int | None = None,
    actor_email: str | None = None,
    ip_address: str | None = None,
    detail: dict[str, Any] | None = None,
) -> AuditLog:
    """Persist a security-relevant event and emit a structured log line.

    The DB write is *not* committed automatically; the caller is responsible for
    committing the transaction so the audit row lives or dies atomically with
    the operation it records.
    """
    row = AuditLog(
        user_id=user_id,
        event=event,
        actor_email=actor_email,
        ip_address=ip_address,
        detail=detail,
    )
    db.add(row)
    db.flush()

    logger.warning(
        "audit event=%s user_id=%s actor=%s ip=%s",
        event,
        user_id,
        actor_email,
        ip_address,
    )
    return row
