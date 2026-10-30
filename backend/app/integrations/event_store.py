# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""MongoDB-backed secondary event log (optional).

Implements the PRD's "MongoDB for flexible event logging" requirement as a
best-effort sink gated by ``MONGODB_URI``. Unlike the messaging NoopProvider
(which raises, so nothing is ever fabricated), the default here is a **silent
discard**: event logging is non-critical telemetry and the app must keep working
with no MongoDB configured — PostgreSQL stays the only required datastore.

``pymongo`` is imported lazily and every write is best-effort, so a missing
driver or an unreachable server never breaks a request. Point ``MONGODB_URI`` at
the bundled compose service or a MongoDB Atlas SRV string to enable logging.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Protocol

from ..core import config

logger = logging.getLogger("events.store")


class EventStore(Protocol):
    """Contract for the secondary event sink."""

    name: str

    def record(self, event_type: str, payload: dict, *, user_id: int | None = None) -> None:
        """Persist one event (best-effort; must never raise)."""


class NoopEventStore:
    """Silent no-op used when no MongoDB is configured (the default)."""

    name = "noop"

    def record(self, event_type: str, payload: dict, *, user_id: int | None = None) -> None:
        return None


class MongoEventStore:
    """Appends events to a MongoDB collection (lazy connection, best-effort)."""

    name = "mongo"

    def __init__(self, uri: str, db_name: str | None = None, client=None):
        self.uri = uri
        self.db_name = db_name or config.get_mongodb_db_name()
        self._client = client  # injectable for tests
        self._collection = None
        self._broken = False

    def _coll(self):
        if self._collection is None:
            client = self._client
            if client is None:
                from pymongo import MongoClient

                client = MongoClient(self.uri, serverSelectionTimeoutMS=2000)
            self._collection = client[self.db_name]["events"]
        return self._collection

    def record(self, event_type: str, payload: dict, *, user_id: int | None = None) -> None:
        if self._broken:
            return
        doc = {
            "event_type": event_type,
            "user_id": user_id,
            "payload": payload,
            "created_at": datetime.now(timezone.utc),
        }
        try:
            self._coll().insert_one(doc)
        except Exception as exc:  # telemetry must never break the request
            # shortcut: trips permanently on first failure; add a timed retry if
            # event logging ever becomes critical-path.
            self._broken = True
            logger.warning(
                "events.record_failed type=%s error=%s (event store disabled)",
                event_type,
                exc,
            )


_cached: EventStore | None = None


def get_event_store() -> EventStore:
    """Return the process-wide event store (Mongo when ``MONGODB_URI`` is set)."""
    global _cached
    if _cached is None:
        uri = config.get_mongodb_uri()
        _cached = MongoEventStore(uri) if uri else NoopEventStore()
        logger.info("events.store_selected store=%s", _cached.name)
    return _cached


def reset_event_store() -> None:
    """Clear the cached store (used by tests after changing env)."""
    global _cached
    _cached = None


def record(event_type: str, payload: dict, *, user_id: int | None = None) -> None:
    """Record an event through the configured store."""
    get_event_store().record(event_type, payload, user_id=user_id)
