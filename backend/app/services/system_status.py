# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""System health measurement for Intelligent Cognitive Alarm Platform.

Single source of truth for service availability signals (Phase 5):

- `BOOT_TIME` marks process start; `uptime_seconds()` measures real process age.
- `record_request(status_code)` maintains thread-safe lifetime counters of total
  vs failed (5xx / unhandled-exception) API responses, fed by `GatewayMiddleware`.
- `get_system_health(db)` combines process uptime, a live database round-trip
  (`SELECT 1`), and the lifetime success ratio into one honest payload.
- `system_uptime_percentage(db)` is the value surfaced as
  `AdminAnalyticsRes.system_uptime_percentage`: the measured lifetime success
  ratio (100.0 when no errors have been observed), never a hard-coded constant.

Nothing here is fabricated: with zero traffic the ratio is defined as 100.0
(idle-but-healthy), and any 5xx or DB failure moves the numbers down.
"""

import threading
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

BOOT_TIME = datetime.now(timezone.utc)

_lock = threading.Lock()
_total_requests = 0
_failed_requests = 0


def record_request(status_code: int | None) -> None:
    """Record one completed API response for the lifetime success ratio."""
    global _total_requests, _failed_requests
    try:
        code = int(status_code) if status_code is not None else 0
    except (TypeError, ValueError):
        code = 0
    with _lock:
        _total_requests += 1
        if code >= 500 or code <= 0:
            _failed_requests += 1


def reset_counters() -> None:
    """Reset lifetime counters (used by tests for isolation)."""
    global _total_requests, _failed_requests
    with _lock:
        _total_requests = 0
        _failed_requests = 0


def uptime_seconds(now: datetime | None = None) -> float:
    """Real process age in seconds since import (service boot)."""
    at = now or datetime.now(timezone.utc)
    return max(0.0, (at - BOOT_TIME).total_seconds())


def _success_ratio() -> float:
    with _lock:
        total, failed = _total_requests, _failed_requests
    if total <= 0:
        return 100.0
    return round(max(0.0, (total - failed) / total) * 100.0, 2)


def _database_connected(db: Session | None) -> bool:
    if db is None:
        return False
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_system_health(db: Session | None = None) -> dict:
    """Measured health payload: uptime, DB round-trip, lifetime success ratio."""
    db_ok = _database_connected(db)
    with _lock:
        total, failed = _total_requests, _failed_requests
    ratio = _success_ratio()
    return {
        "status": "healthy" if db_ok else "degraded",
        "uptime_seconds": round(uptime_seconds(), 1),
        "db_connected": db_ok,
        "total_requests": total,
        "failed_requests": failed,
        "success_rate_percent": ratio,
        "measured_at": datetime.now(timezone.utc).isoformat(),
    }


def system_uptime_percentage(db: Session | None = None) -> float:
    """Availability signal for the admin dashboard.

    Lifetime API success ratio when the database is reachable, 0.0 when the
    database round-trip fails. Replaces the former hard-coded 99.9 constant.
    """
    if not _database_connected(db):
        return 0.0
    return _success_ratio()
