"""Auth + RBAC tests."""


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_register_and_login(client):
    reg = client.post("/api/v1/auth/register", json={
        "email": "a@test.io", "password": "password123",
        "full_name": "A", "timezone": "Asia/Kolkata", "difficulty_preference": "Hard",
    })
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    assert token

    log = client.post("/api/v1/auth/login", json={"email": "a@test.io", "password": "password123"})
    assert log.status_code == 200, log.text
    assert log.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {log.json()['access_token']}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "a@test.io"
    assert body["timezone"] == "Asia/Kolkata"
    assert "difficulty_preference" in body or "id" in body


def test_duplicate_email_rejected(client):
    payload = {"email": "dup@test.io", "password": "password123"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 200
    dup = client.post("/api/v1/auth/register", json=payload)
    assert dup.status_code == 400, dup.text


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={"email": "w@test.io", "password": "password123"})
    r = client.post("/api/v1/auth/login", json={"email": "w@test.io", "password": "wrongpass"})
    assert r.status_code in (400, 401)


def test_me_requires_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/alarms").status_code == 401


def test_admin_endpoint_is_rbac_enforced(client, user_headers):
    r = client.get("/api/v1/dashboard/users", headers=user_headers)
    assert r.status_code == 403, r.text


def test_user_profile_and_settings(client, user_headers):
    prof = client.get("/api/v1/users/profile", headers=user_headers)
    assert prof.status_code == 200

    upd = client.put("/api/v1/users/profile", headers=user_headers, json={"full_name": "Renamed", "timezone": "UTC"})
    assert upd.status_code == 200
    assert upd.json()["full_name"] == "Renamed"

    st = client.get("/api/v1/users/settings", headers=user_headers)
    assert st.status_code == 200
    assert "notifications" in st.json()
