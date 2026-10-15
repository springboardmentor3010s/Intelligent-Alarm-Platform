"""
Coach & Admin dashboard API tests.
Run: cd backend && venv\\Scripts\\python.exe -m pytest tests/test_coach_admin.py -v
"""


class TestCoachEndpoints:
    def test_coach_can_view_users(self, client, register_user):
        register_user(email="managed1@example.com")
        coach_headers = register_user(name="Coach", email="coachx@example.com", role="WELLNESS_COACH")
        r = client.get("/coach/users", headers=coach_headers)
        assert r.status_code == 200
        assert any(u["email"] == "managed1@example.com" for u in r.json())

    def test_coach_summary(self, client, register_user):
        register_user(email="managed2@example.com")
        coach_headers = register_user(name="Coach", email="coachy@example.com", role="WELLNESS_COACH")
        r = client.get("/coach/summary", headers=coach_headers)
        assert r.status_code == 200
        assert "total_users" in r.json()

    def test_admin_can_access_coach_endpoints_too(self, client, make_admin):
        email, password = make_admin(email="admin2@example.com")
        r = client.post("/auth/login", json={"email": email, "password": password})
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.get("/coach/summary", headers=headers)
        assert r.status_code == 200


class TestAdminEndpoints:
    def test_admin_list_users(self, client, register_user, make_admin):
        register_user(email="regularjoe@example.com")
        email, password = make_admin()
        r = client.post("/auth/login", json={"email": email, "password": password})
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        r = client.get("/admin/users", headers=headers)
        assert r.status_code == 200
        assert any(u["email"] == "regularjoe@example.com" for u in r.json())

    def test_admin_stats_counts_roles(self, client, register_user, make_admin):
        register_user(email="statuser1@example.com")
        register_user(name="Coach", email="statcoach1@example.com", role="WELLNESS_COACH")
        email, password = make_admin()
        r = client.post("/auth/login", json={"email": email, "password": password})
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        r = client.get("/admin/stats", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["users_by_role"]["USER"] >= 1
        assert body["users_by_role"]["WELLNESS_COACH"] >= 1
        assert body["users_by_role"]["ADMINISTRATOR"] >= 1

    def test_coach_cannot_access_admin_only_endpoint(self, client, register_user):
        coach_headers = register_user(name="Coach", email="coachnope@example.com", role="WELLNESS_COACH")
        r = client.get("/admin/stats", headers=coach_headers)
        assert r.status_code == 403
