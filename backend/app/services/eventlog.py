"""Optional MongoDB event log (the spec's secondary document database).

Every challenge interaction is written here as an unstructured event. If MongoDB is not configured or
is unreachable the platform keeps working - logging must never break an alarm.
"""
import logging
from datetime import datetime, timezone

from app.core.config import settings

log = logging.getLogger("wakeful.eventlog")
_client = None
_failed = False


def _collection():
    global _client, _failed
    if not settings.MONGO_URL or _failed:
        return None
    try:
        if _client is None:
            from pymongo import MongoClient
            _client = MongoClient(settings.MONGO_URL, serverSelectionTimeoutMS=1500)
        return _client[settings.MONGO_DB]["events"]
    except Exception as exc:  # pragma: no cover - depends on infra
        log.warning("MongoDB unavailable, event logging disabled: %s", exc)
        _failed = True
        return None


def log_event(kind: str, **payload) -> None:
    col = _collection()
    if col is None:
        return
    try:
        col.insert_one({"kind": kind, "at": datetime.now(timezone.utc), **{k: str(v) for k, v in payload.items()}})
    except Exception as exc:  # pragma: no cover
        log.warning("event log write failed: %s", exc)


def status() -> str:
    if not settings.MONGO_URL:
        return "not_configured"
    col = _collection()
    if col is None:
        return "unavailable"
    try:
        col.database.client.admin.command("ping")
        return "ok"
    except Exception:  # pragma: no cover
        return "unavailable"
