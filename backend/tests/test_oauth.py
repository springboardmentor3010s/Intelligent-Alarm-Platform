"""
OAuth2 social login tests (Module 1). External provider calls are mocked —
these tests validate our state/CSRF handling, account linking, and JWT
issuance logic without needing real Google/GitHub credentials.
"""
from unittest.mock import AsyncMock, patch

from app.core.security import create_oauth_state_token


class TestOAuthProviderDiscovery:
    def test_providers_endpoint_lists_google_and_github(self, client):
        r = client.get("/auth/oauth/providers")
        assert r.status_code == 200
        assert set(r.json().keys()) == {"google", "github"}

    def test_providers_report_unconfigured_without_credentials(self, client):
        r = client.get("/auth/oauth/providers")
        # No real client id/secret set in the test environment
        assert r.json()["google"] is False
        assert r.json()["github"] is False


class TestOAuthLoginRedirect:
    def test_unconfigured_provider_returns_400(self, client):
        r = client.get("/auth/oauth/google/login", follow_redirects=False)
        assert r.status_code == 400

    def test_unknown_provider_returns_404(self, client):
        r = client.get("/auth/oauth/facebook/login", follow_redirects=False)
        assert r.status_code == 404

    def test_configured_provider_redirects_to_authorize_url(self, client):
        with patch("app.api.oauth.is_configured", return_value=True):
            r = client.get("/auth/oauth/google/login", follow_redirects=False)
        assert r.status_code in (302, 307)
        assert "accounts.google.com" in r.headers["location"]


class TestOAuthCallback:
    def test_invalid_state_redirects_with_error(self, client):
        with patch("app.api.oauth.is_configured", return_value=True):
            r = client.get(
                "/auth/oauth/google/callback?code=fakecode&state=not-a-real-state",
                follow_redirects=False,
            )
        assert r.status_code in (302, 307)
        assert "error=invalid_state" in r.headers["location"]

    def test_unconfigured_provider_redirects_with_error(self, client):
        state = create_oauth_state_token()
        r = client.get(
            f"/auth/oauth/google/callback?code=fakecode&state={state}",
            follow_redirects=False,
        )
        assert r.status_code in (302, 307)
        assert "error=provider_not_configured" in r.headers["location"]

    def test_new_user_requires_role_selection_before_account_is_created(self, client, db_engine):
        state = create_oauth_state_token()
        fake_profile = {"provider_id": "google-123", "email": "newoauth@example.com", "name": "New OAuth User"}
        with patch("app.api.oauth.is_configured", return_value=True), \
             patch("app.api.oauth.fetch_profile", new=AsyncMock(return_value=fake_profile)):
            r = client.get(
                f"/auth/oauth/google/callback?code=fakecode&state={state}",
                follow_redirects=False,
            )
        assert r.status_code in (302, 307)
        assert "signup_token=" in r.headers["location"]
        signup_token = r.headers["location"].split("signup_token=")[1]

        from sqlalchemy.orm import sessionmaker
        from app.models.models import User
        Session = sessionmaker(bind=db_engine)
        db = Session()
        # No account exists yet — creation is deferred until a role is submitted
        assert db.query(User).filter(User.email == "newoauth@example.com").first() is None
        db.close()

        complete = client.post("/auth/oauth/complete-registration", json={
            "signup_token": signup_token, "role": "WELLNESS_COACH",
        })
        assert complete.status_code == 200
        assert "access_token" in complete.json()

        db = Session()
        user = db.query(User).filter(User.email == "newoauth@example.com").first()
        assert user is not None
        assert user.oauth_provider == "google"
        assert user.oauth_id == "google-123"
        assert user.password_hash is None
        assert user.role == "WELLNESS_COACH"
        db.close()

    def test_complete_registration_rejects_invalid_role(self, client):
        state = create_oauth_state_token()
        fake_profile = {"provider_id": "google-456", "email": "badrole@example.com", "name": "Bad Role"}
        with patch("app.api.oauth.is_configured", return_value=True), \
             patch("app.api.oauth.fetch_profile", new=AsyncMock(return_value=fake_profile)):
            r = client.get(f"/auth/oauth/google/callback?code=fakecode&state={state}", follow_redirects=False)
        signup_token = r.headers["location"].split("signup_token=")[1]

        resp = client.post("/auth/oauth/complete-registration", json={
            "signup_token": signup_token, "role": "ADMINISTRATOR",
        })
        assert resp.status_code == 422

    def test_complete_registration_rejects_expired_or_invalid_token(self, client):
        resp = client.post("/auth/oauth/complete-registration", json={
            "signup_token": "not-a-real-token", "role": "USER",
        })
        assert resp.status_code == 400

    def test_existing_password_account_gets_linked_not_duplicated(self, client, db_engine, register_user):
        register_user(email="linkme@example.com")
        state = create_oauth_state_token()
        fake_profile = {"provider_id": "gh-999", "email": "linkme@example.com", "name": "Link Me"}
        with patch("app.api.oauth.is_configured", return_value=True), \
             patch("app.api.oauth.fetch_profile", new=AsyncMock(return_value=fake_profile)):
            client.get(f"/auth/oauth/github/callback?code=fakecode&state={state}", follow_redirects=False)

        from sqlalchemy.orm import sessionmaker
        from app.models.models import User
        Session = sessionmaker(bind=db_engine)
        db = Session()
        users = db.query(User).filter(User.email == "linkme@example.com").all()
        assert len(users) == 1
        assert users[0].oauth_provider == "github"
        assert users[0].oauth_id == "gh-999"
        db.close()

    def test_missing_email_from_provider_redirects_with_error(self, client):
        state = create_oauth_state_token()
        fake_profile = {"provider_id": "gh-1", "email": None, "name": "No Email"}
        with patch("app.api.oauth.is_configured", return_value=True), \
             patch("app.api.oauth.fetch_profile", new=AsyncMock(return_value=fake_profile)):
            r = client.get(
                f"/auth/oauth/github/callback?code=fakecode&state={state}",
                follow_redirects=False,
            )
        assert "error=no_email_from_provider" in r.headers["location"]


class TestPasswordLoginGuardForOAuthAccounts:
    def test_oauth_only_account_cannot_password_login(self, client, db_engine):
        from sqlalchemy.orm import sessionmaker
        from app.models.models import User
        Session = sessionmaker(bind=db_engine)
        db = Session()
        db.add(User(name="OAuth Only", email="oauthonly@example.com", password_hash=None,
                     role="USER", oauth_provider="google", oauth_id="g-1"))
        db.commit()
        db.close()

        r = client.post("/auth/login", json={"email": "oauthonly@example.com", "password": "anything"})
        assert r.status_code == 401
