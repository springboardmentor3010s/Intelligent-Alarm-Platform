"""
Auth & RBAC tests.
Run: cd backend && venv\\Scripts\\python.exe -m pytest tests/test_auth.py -v
"""


class TestRegistration:
    def test_register_user_success(self, client):
        r = client.post("/auth/register", json={
            "name": "Alice", "email": "alice@example.com", "password": "secret123", "role": "USER",
        })
        assert r.status_code == 201
        body = r.json()
        assert body["email"] == "alice@example.com"
        assert body["role"] == "USER"

    def test_register_coach_success(self, client):
        r = client.post("/auth/register", json={
            "name": "Coach Bob", "email": "coach@example.com", "password": "secret123", "role": "WELLNESS_COACH",
        })
        assert r.status_code == 201
        assert r.json()["role"] == "WELLNESS_COACH"

    def test_cannot_self_register_as_admin(self, client):
        r = client.post("/auth/register", json={
            "name": "Eve", "email": "eve@example.com", "password": "secret123", "role": "ADMINISTRATOR",
        })
        assert r.status_code == 422

    def test_duplicate_email_rejected(self, client):
        payload = {"name": "Alice", "email": "dup@example.com", "password": "secret123", "role": "USER"}
        r1 = client.post("/auth/register", json=payload)
        r2 = client.post("/auth/register", json=payload)
        assert r1.status_code == 201
        assert r2.status_code == 400

    def test_invalid_email_rejected(self, client):
        r = client.post("/auth/register", json={
            "name": "Bad", "email": "not-an-email", "password": "secret123", "role": "USER",
        })
        assert r.status_code == 422

    def test_register_creates_default_profile(self, client, register_user):
        headers = register_user(email="profileuser@example.com")
        r = client.get("/profile", headers=headers)
        assert r.status_code == 200
        assert r.json()["preferred_wake_up_time"] == "07:00"


class TestLogin:
    def test_login_success(self, client):
        client.post("/auth/register", json={
            "name": "Alice", "email": "alice2@example.com", "password": "secret123", "role": "USER",
        })
        r = client.post("/auth/login", json={"email": "alice2@example.com", "password": "secret123"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client):
        client.post("/auth/register", json={
            "name": "Alice", "email": "alice3@example.com", "password": "secret123", "role": "USER",
        })
        r = client.post("/auth/login", json={"email": "alice3@example.com", "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client):
        r = client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever"})
        assert r.status_code == 401

    def test_email_case_insensitive_login(self, client):
        client.post("/auth/register", json={
            "name": "Alice", "email": "Alice4@Example.com", "password": "secret123", "role": "USER",
        })
        r = client.post("/auth/login", json={"email": "alice4@example.com", "password": "secret123"})
        assert r.status_code == 200


class TestAuthDependency:
    def test_me_requires_token(self, client):
        r = client.get("/auth/me")
        assert r.status_code == 401

    def test_me_with_valid_token(self, client, register_user):
        headers = register_user(email="me@example.com")
        r = client.get("/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["email"] == "me@example.com"

    def test_invalid_token_rejected(self, client):
        r = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401


class TestRoleBasedAccess:
    def test_user_cannot_access_admin_endpoint(self, client, register_user):
        headers = register_user(email="plainuser@example.com")
        r = client.get("/admin/stats", headers=headers)
        assert r.status_code == 403

    def test_admin_can_access_admin_endpoint(self, client, make_admin):
        email, password = make_admin()
        r = client.post("/auth/login", json={"email": email, "password": password})
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.get("/admin/stats", headers=headers)
        assert r.status_code == 200

    def test_user_cannot_access_coach_endpoint(self, client, register_user):
        headers = register_user(email="plainuser2@example.com")
        r = client.get("/coach/summary", headers=headers)
        assert r.status_code == 403
