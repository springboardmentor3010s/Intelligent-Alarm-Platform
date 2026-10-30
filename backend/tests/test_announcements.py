# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Module 11: platform announcements — public feed + admin CRUD contracts."""

from datetime import datetime, timedelta, timezone


def _iso(dt):
    return dt.isoformat()


def _create(client, headers, **overrides):
    body = {"title": "Maintenance", "body": "Downtime at 02:00 UTC.", **overrides}
    return client.post("/api/v1/announcements", json=body, headers=headers)


# ------------------------------------------------------------------
# Access control
# ------------------------------------------------------------------

def test_admin_crud_requires_admin_role(client, registered_user):
    _, _, _, headers = registered_user
    assert client.get("/api/v1/announcements", headers=headers).status_code == 403
    assert _create(client, headers).status_code == 403


def test_public_feed_needs_no_auth(client):
    res = client.get("/api/v1/announcements/public")
    assert res.status_code == 200
    assert res.json() == []


# ------------------------------------------------------------------
# CRUD lifecycle
# ------------------------------------------------------------------

def test_admin_create_read_update_delete(client, admin_headers):
    created = _create(client, admin_headers, priority=5)
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["id"] and row["is_active"] is True and row["priority"] == 5

    got = client.get(f"/api/v1/announcements/{row['id']}", headers=admin_headers)
    assert got.status_code == 200
    assert got.json()["title"] == "Maintenance"

    updated = client.put(
        f"/api/v1/announcements/{row['id']}",
        json={"title": "Maintenance moved", "is_active": False},
        headers=admin_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Maintenance moved"
    assert updated.json()["is_active"] is False

    deleted = client.delete(f"/api/v1/announcements/{row['id']}", headers=admin_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/announcements/{row['id']}", headers=admin_headers).status_code == 404


def test_update_unknown_returns_404(client, admin_headers):
    assert client.put(
        "/api/v1/announcements/999999", json={"title": "x"}, headers=admin_headers
    ).status_code == 404
    assert client.delete(
        "/api/v1/announcements/999999", headers=admin_headers
    ).status_code == 404


def test_create_rejects_empty_title(client, admin_headers):
    assert _create(client, admin_headers, title="").status_code == 422
    assert _create(client, admin_headers, body="").status_code == 422


# ------------------------------------------------------------------
# Public feed filtering + ordering
# ------------------------------------------------------------------

def test_public_feed_only_returns_active_and_in_window(client, admin_headers):
    now = datetime.now(timezone.utc)

    live = _create(client, admin_headers, title="Live", priority=1).json()
    inactive = _create(client, admin_headers, title="Inactive", is_active=False).json()
    future = _create(
        client, admin_headers, title="Future", starts_at=_iso(now + timedelta(days=1))
    ).json()
    expired = _create(
        client, admin_headers, title="Expired", ends_at=_iso(now - timedelta(days=1))
    ).json()

    feed = client.get("/api/v1/announcements/public").json()
    ids = {a["id"] for a in feed}
    assert live["id"] in ids
    for hidden in (inactive, future, expired):
        assert hidden["id"] not in ids


def test_public_feed_orders_by_priority_then_published(client, admin_headers):
    _create(client, admin_headers, title="Low", priority=1)
    _create(client, admin_headers, title="High", priority=9)

    feed = client.get("/api/v1/announcements/public").json()
    titles = [a["title"] for a in feed]
    assert titles[0] == "High", titles
