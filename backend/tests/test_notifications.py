"""Notification registration (P5) and delivery-boundary (Phase 3) tests."""

import pytest

from app.integrations import messaging
from app.services.notification_service import NotificationService, reset_delivery_cache
from app.core import config

TOKEN_A = "ExponentPushToken[aaaaaaaa-1111-2222-3333-444444444444]"
TOKEN_B = "ExponentPushToken[bbbbbbbb-1111-2222-3333-444444444444]"


@pytest.fixture(autouse=True)
def _reset_delivery_state():
    """Isolate the delivery cache + provider across tests."""
    reset_delivery_cache()
    messaging.reset_provider()
    yield
    reset_delivery_cache()
    messaging.reset_provider()


# ---------------------------------------------------------------------------
# Token lifecycle (P5)
# ---------------------------------------------------------------------------


def test_register_push_token(client, user_headers):
    res = client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["registered"] is True
    assert body["token"] == TOKEN_A
    assert body["platform"] == "android"
    assert body["id"] > 0


def test_register_token_is_idempotent(client, user_headers):
    for _ in range(2):
        res = client.post(
            "/api/v1/notifications/register",
            headers=user_headers,
            json={"token": TOKEN_A, "platform": "android"},
        )
        assert res.status_code == 200

    tokens = client.get("/api/v1/notifications/tokens", headers=user_headers)
    assert tokens.status_code == 200
    assert len(tokens.json()) == 1


def test_list_tokens_returns_all(client, user_headers):
    client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )
    client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_B, "platform": "ios"},
    )

    tokens = client.get("/api/v1/notifications/tokens", headers=user_headers)
    assert tokens.status_code == 200
    body = tokens.json()
    assert len(body) == 2
    assert {t["token"] for t in body} == {TOKEN_A, TOKEN_B}
    assert {t["platform"] for t in body} == {"android", "ios"}


def test_deregister_token(client, user_headers):
    client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )

    res = client.request(
        "DELETE",
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["deregistered"] is True

    tokens = client.get("/api/v1/notifications/tokens", headers=user_headers)
    assert tokens.json() == []


def test_deregister_unknown_token_is_noop(client, user_headers):
    res = client.request(
        "DELETE",
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )
    assert res.status_code == 200
    assert res.json()["deregistered"] is False


def test_register_rejects_empty_token(client, user_headers):
    res = client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": "  ", "platform": "android"},
    )
    assert res.status_code == 400, res.text


def test_register_rejects_bad_platform(client, user_headers):
    res = client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "windows"},
    )
    assert res.status_code == 422, res.text


def test_tokens_are_scoped_per_user(client, user_headers):
    """A second user never sees the first user's tokens."""
    client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )

    other = client.post("/api/v1/auth/register", json={
        "email": "other-notif@test.io",
        "password": "password123",
        "timezone": "UTC",
    })
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    tokens = client.get("/api/v1/notifications/tokens", headers=other_headers)
    assert tokens.status_code == 200
    assert tokens.json() == []


def test_send_awaiting_provider(db):
    """With the default no-op provider, delivery raises a clear error."""
    with pytest.raises(NotImplementedError):
        NotificationService.send(TOKEN_A, {"title": "Wake up", "body": "Challenge ready"})


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------


def test_provider_selection_defaults_to_noop():
    """Without PUSH_PROVIDER the provider is the strict no-op."""
    messaging.reset_provider()
    assert config.get_push_provider() == "noop"
    assert messaging.get_provider().name == "noop"


def test_provider_selection_expo(monkeypatch):
    """PUSH_PROVIDER=expo selects the Expo relay provider."""
    monkeypatch.setenv("PUSH_PROVIDER", "expo")
    messaging.reset_provider()
    assert config.get_push_provider() == "expo"
    assert messaging.get_provider().name == "expo"
    monkeypatch.delenv("PUSH_PROVIDER", raising=False)
    messaging.reset_provider()


def test_provider_fails_fast_in_production(monkeypatch):
    """Unknown providers are rejected in production (fail fast)."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PUSH_PROVIDER", "unknown")
    with pytest.raises(RuntimeError):
        config.get_push_provider()


# ---------------------------------------------------------------------------
# Expo ticket interpretation + dead-token pruning
# ---------------------------------------------------------------------------


def test_expo_ticket_ok_is_success():
    result = messaging.ExpoPushProvider._interpret(
        TOKEN_A, {"status": "ok", "id": "ticket-1"}
    )
    assert result["status"] == "ok"
    assert result["invalid_token"] is False
    assert result["ticket_id"] == "ticket-1"


def test_expo_ticket_invalid_token_flagged():
    result = messaging.ExpoPushProvider._interpret(
        TOKEN_A,
        {"status": "error", "details": {"error": "DeviceNotRegistered"}},
    )
    assert result["status"] == "error"
    assert result["invalid_token"] is True


def test_deliver_removes_invalid_token(monkeypatch, client, registered_user, db):
    """Delivering prunes tokens the provider reports as dead."""
    _, _, user_id, headers = registered_user
    from app.Models import User

    class _FakeExpo:
        name = "expo"

        def send(self, token, payload):
            return {
                "status": "error",
                "token": token,
                "invalid_token": True,
                "error": "DeviceNotRegistered",
            }

    monkeypatch.setattr(messaging, "get_provider", lambda: _FakeExpo())

    client.post(
        "/api/v1/notifications/register",
        headers=headers,
        json={"token": TOKEN_A, "platform": "android"},
    )
    user = db.query(User).filter(User.id == user_id).first()

    summary = NotificationService.deliver_to_user(
        db, user, "Wake up", "Challenge ready", {"type": "alarm"}
    )
    assert summary["attempted"] == 1
    assert summary["sent"] == 0
    assert summary["failed"] == 1
    assert summary["invalid_removed"] == 1
    assert summary["provider"] == "expo"
    assert summary["configured"] is True
    # the token was pruned → the user now has none registered
    assert NotificationService.list_tokens(db, user) == []


def test_deliver_duplicate_suppressed(monkeypatch, client, registered_user, db):
    """A repeated dedupe_key is delivered at most once per process."""
    _, _, user_id, headers = registered_user
    from app.Models import User

    class _FakeExpo:
        name = "expo"

        def send(self, token, payload):
            return {"status": "ok", "token": token, "invalid_token": False}

    monkeypatch.setattr(messaging, "get_provider", lambda: _FakeExpo())

    client.post(
        "/api/v1/notifications/register",
        headers=headers,
        json={"token": TOKEN_A, "platform": "android"},
    )
    user = db.query(User).filter(User.id == user_id).first()

    first = NotificationService.deliver_to_user(
        db, user, "Wake up", "Challenge ready", {"type": "alarm"},
        dedupe_key="alarm:1:trigger-1",
    )
    second = NotificationService.deliver_to_user(
        db, user, "Wake up", "Challenge ready", {"type": "alarm"},
        dedupe_key="alarm:1:trigger-1",
    )
    assert first["sent"] == 1
    assert second["duplicate"] is True
    assert second["sent"] == 0


# ---------------------------------------------------------------------------
# HTTP delivery endpoints
# ---------------------------------------------------------------------------


def test_notifications_status_reports_noop(client, user_headers):
    res = client.get("/api/v1/notifications/status", headers=user_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["provider"] == "noop"
    assert body["configured"] is False


def test_notifications_status_reports_expo(monkeypatch, client, user_headers):
    monkeypatch.setenv("PUSH_PROVIDER", "expo")
    messaging.reset_provider()
    res = client.get("/api/v1/notifications/status", headers=user_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["provider"] == "expo"
    assert body["configured"] is True


def test_notifications_test_returns_summary(monkeypatch, client, user_headers, db):
    monkeypatch.setenv("PUSH_PROVIDER", "expo")
    messaging.reset_provider()
    client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )

    class _FakeExpo:
        name = "expo"

        def send(self, token, payload):
            return {"status": "ok", "token": token, "invalid_token": False}

    monkeypatch.setattr(messaging, "get_provider", lambda: _FakeExpo())

    res = client.post("/api/v1/notifications/test", headers=user_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["attempted"] == 1
    assert body["sent"] == 1
    assert body["configured"] is True


def test_alarm_notify_endpoint_returns_summary(monkeypatch, client, user_headers, db):
    monkeypatch.setenv("PUSH_PROVIDER", "expo")
    messaging.reset_provider()
    client.post(
        "/api/v1/notifications/register",
        headers=user_headers,
        json={"token": TOKEN_A, "platform": "android"},
    )

    class _FakeExpo:
        name = "expo"

        def send(self, token, payload):
            return {"status": "ok", "token": token, "invalid_token": False}

    monkeypatch.setattr(messaging, "get_provider", lambda: _FakeExpo())

    alarm = client.post(
        "/api/v1/alarms",
        headers=user_headers,
        json={
            "title": "Notify me",
            "type": "Daily",
            "time": "06:30",
            "challenge_type": "Math",
            "difficulty": "Easy",
        },
    ).json()

    res = client.post(f"/api/v1/alarms/{alarm['id']}/notify", headers=user_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["alarm_id"] == alarm["id"]
    assert body["attempted"] == 1
    assert body["sent"] == 1
    assert body["provider"] == "expo"


def test_alarm_notify_requires_ownership(client, user_headers):
    other = client.post("/api/v1/auth/register", json={
        "email": "other-owner@test.io",
        "password": "password123",
        "timezone": "UTC",
    }).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    alarm = client.post(
        "/api/v1/alarms",
        headers=user_headers,
        json={"title": "Mine", "type": "One-Time", "time": "07:00"},
    ).json()

    res = client.post(
        f"/api/v1/alarms/{alarm['id']}/notify", headers=other_headers
    )
    assert res.status_code == 404
