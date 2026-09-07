"""Notification registration tests (P5)."""

from app.services.notification_service import NotificationService

TOKEN_A = "ExponentPushToken[aaaaaaaa-1111-2222-3333-444444444444]"
TOKEN_B = "ExponentPushToken[bbbbbbbb-1111-2222-3333-444444444444]"


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
    """Delivery is declared planned; the adapter raises a clear error."""
    try:
        NotificationService.send(TOKEN_A, {"title": "Wake up", "body": "Challenge ready"})
        assert False, "send() should raise until a provider is wired"
    except NotImplementedError:
        pass
