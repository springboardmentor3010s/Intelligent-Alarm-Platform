# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Tests for the optional MongoDB event log (integrations/event_store.py)."""

import pytest

from app.core import config
from app.integrations import event_store


class _FakeCollection:
    def __init__(self):
        self.docs = []
        self.calls = 0

    def insert_one(self, doc):
        self.calls += 1
        self.docs.append(doc)


class _FakeDB:
    def __init__(self, coll):
        self._coll = coll

    def __getitem__(self, name):
        assert name == "events"
        return self._coll


class _FakeClient:
    def __init__(self, coll):
        self._coll = coll

    def __getitem__(self, name):
        return _FakeDB(self._coll)


@pytest.fixture(autouse=True)
def _clean_store(monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    event_store.reset_event_store()
    yield
    event_store.reset_event_store()


def test_default_is_noop_and_discards_silently(monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    store = event_store.get_event_store()
    assert isinstance(store, event_store.NoopEventStore)
    assert store.name == "noop"
    # Silent discard: returns None, raises nothing.
    assert store.record("anything", {"k": "v"}, user_id=1) is None


def test_uri_enables_mongo_store(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://mongo:27017")
    store = event_store.get_event_store()
    assert isinstance(store, event_store.MongoEventStore)
    assert store.name == "mongo"


def test_mongo_store_appends_structured_document():
    coll = _FakeCollection()
    store = event_store.MongoEventStore(
        "mongodb://x", db_name="ck_test", client=_FakeClient(coll)
    )
    store.record("alarm.created", {"alarm_id": 7}, user_id=3)

    assert coll.calls == 1
    doc = coll.docs[0]
    assert doc["event_type"] == "alarm.created"
    assert doc["user_id"] == 3
    assert doc["payload"] == {"alarm_id": 7}
    assert doc["created_at"].tzinfo is not None


def test_mongo_store_trips_breaker_after_failure():
    class _Exploding:
        def insert_one(self, doc):
            raise RuntimeError("mongo down")

    coll = _Exploding()
    store = event_store.MongoEventStore("mongodb://x", client=_FakeClient(coll))
    # First failure is swallowed and trips the breaker...
    store.record("a", {}, user_id=1)
    assert store._broken is True
    # ...subsequent records short-circuit without touching the collection.
    store.record("b", {}, user_id=1)


def test_module_record_delegates_to_selected_store(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://mongo:27017")
    event_store.reset_event_store()
    coll = _FakeCollection()
    monkeypatch.setattr(
        event_store, "_cached", event_store.MongoEventStore("mongodb://x", client=_FakeClient(coll))
    )
    event_store.record("alarm.snoozed", {"alarm_id": 1}, user_id=2)
    assert coll.docs[0]["event_type"] == "alarm.snoozed"


def test_config_helpers():
    assert config.get_mongodb_uri() == ""
    assert config.get_mongodb_db_name() == "cerebrokognit_events"
