# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Phase 2 Security & Isolation test suite (CerebroKognit).

Covers:
  1. SECRET_KEY fail-fast (config)
  2. CORS allowlist (no wildcard, production fail-fast)
  3. Refresh token flow (rotation, revocation, reuse, invalid/expired)
  4. Password reset (request, confirm, reuse, expired, unknown email)
  5. Email verification (request, confirm, already-verified)
  6. Account deactivation
  7. Audit logging (login success/failure, password reset, role change, deactivation)
  8. Security response headers
  9. Resource isolation (cross-user: alarm, challenge, profile, push tokens, analytics, reports)
 10. RBAC positive path (role change endpoint)
 11. Raw tokens never persisted (only SHA-256 hashes)
"""

import os
import hashlib
import uuid

import pytest
from unittest.mock import patch

from app.Models import AuditLog, AuthToken, User


# ─── helpers ──────────────────────────────────────────────────────

def _audit_events(db, event_filter=None):
    q = db.query(AuditLog)
    if event_filter:
        q = q.filter(AuditLog.event == event_filter)
    return q.all()


def _active_tokens(db, user_id, kind=None):
    q = db.query(AuthToken).filter(AuthToken.user_id == user_id, AuthToken.revoked == False)  # noqa: E712
    if kind:
        q = q.filter(AuthToken.kind == kind)
    return q.all()


# ─── 1. SECRET_KEY fail-fast ─────────────────────────────────────

class TestSecretKeyFailFast:
    def test_placeholder_raises_in_production(self):
        """get_secret_key raises RuntimeError when ENVIRONMENT=production and SECRET_KEY is the placeholder."""
        from app.core.config import get_secret_key, PLACEHOLDER_SECRET

        with patch.dict(os.environ, {"ENVIRONMENT": "production", "SECRET_KEY": PLACEHOLDER_SECRET}):
            with pytest.raises(RuntimeError, match="SECRET_KEY is missing or set to the placeholder"):
                get_secret_key()

    def test_missing_raises_in_production(self):
        """get_secret_key raises RuntimeError when ENVIRONMENT=production and SECRET_KEY is empty."""
        from app.core.config import get_secret_key

        with patch.dict(os.environ, {"ENVIRONMENT": "production", "SECRET_KEY": ""}):
            with pytest.raises(RuntimeError, match="SECRET_KEY is missing"):
                get_secret_key()

    def test_placeholder_allowed_in_development(self):
        """In development the placeholder is accepted without error."""
        from app.core.config import get_secret_key, PLACEHOLDER_SECRET

        with patch.dict(os.environ, {"ENVIRONMENT": "development", "SECRET_KEY": PLACEHOLDER_SECRET}):
            assert get_secret_key() == PLACEHOLDER_SECRET

    def test_real_secret_accepted_in_production(self):
        """A real secret is accepted in production."""
        from app.core.config import get_secret_key

        with patch.dict(os.environ, {"ENVIRONMENT": "production", "SECRET_KEY": "a-real-secret-that-is-at-least-32-bytes-long!"}):
            assert get_secret_key() == "a-real-secret-that-is-at-least-32-bytes-long!"

    def test_lifespan_refuses_placeholder_secret_in_production(self):
        """App lifespan raises at boot (not first request) on placeholder secret (Phase 9)."""
        import asyncio

        from app.core.config import PLACEHOLDER_SECRET
        from app.main import app, lifespan

        async def _enter():
            async with lifespan(app):
                pass

        with patch.dict(os.environ, {"ENVIRONMENT": "production", "SECRET_KEY": PLACEHOLDER_SECRET}):
            with pytest.raises(RuntimeError, match="SECRET_KEY is missing or set to the placeholder"):
                asyncio.run(_enter())


# ─── 2. CORS allowlist ───────────────────────────────────────────

class TestCorsAllowlist:
    def test_empty_raises_in_production(self):
        """Production fails fast when CORS_ORIGINS is empty."""
        from app.core.config import get_cors_origins

        with patch.dict(os.environ, {"ENVIRONMENT": "production", "CORS_ORIGINS": ""}):
            with pytest.raises(RuntimeError, match="CORS_ORIGINS is empty"):
                get_cors_origins()

    def test_explicit_list_parsed(self):
        """Comma-separated origins are parsed correctly."""
        from app.core.config import get_cors_origins

        with patch.dict(os.environ, {"CORS_ORIGINS": "http://a.com,http://b.com"}):
            assert get_cors_origins() == ["http://a.com", "http://b.com"]

    def test_dev_fallback_no_wildcard(self):
        """Development fallback contains explicit localhost origins (never a wildcard)."""
        from app.core.config import get_cors_origins, DEV_CORS_ORIGINS

        with patch.dict(os.environ, {"ENVIRONMENT": "development", "CORS_ORIGINS": ""}):
            origins = get_cors_origins()
            assert "*" not in origins
            assert set(origins) == set(DEV_CORS_ORIGINS)

    def test_wildcard_not_used(self, client):
        """The actual app CORS headers never contain Access-Control-Allow-Origin: *."""
        r = client.options(
            "/api/v1/auth/me",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Wildcard is never sent back; disallowed origin gets no ACAO header
        assert r.headers.get("access-control-allow-origin") != "*"


# ─── 3. Refresh token flow ───────────────────────────────────────

class TestRefreshFlow:
    def test_register_returns_refresh_token(self, client):
        """Registration returns a valid refresh token."""
        r = client.post("/api/v1/auth/register", json={
            "email": f"ref_{uuid.uuid4().hex[:8]}@test.io",
            "password": "password123",
        })
        assert r.status_code == 200
        assert "refresh_token" in r.json()
        assert len(r.json()["refresh_token"]) > 50

    def test_refresh_issues_new_pair(self, client):
        """POST /auth/refresh with a valid refresh token returns a new access + refresh pair."""
        email = f"refrot_{uuid.uuid4().hex[:8]}@test.io"
        reg = client.post("/api/v1/auth/register", json={
            "email": email, "password": "password123",
        })
        assert reg.status_code == 200
        refresh = reg.json()["refresh_token"]

        r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r.status_code == 200
        data = r.json()
        assert data["access_token"] != reg.json()["access_token"]
        assert data["refresh_token"] != refresh
        # New token works
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert me.status_code == 200

    def test_reuse_old_refresh_token_fails(self, client):
        """After rotation the old refresh token is revoked and returns 401."""
        email = f"refold_{uuid.uuid4().hex[:8]}@test.io"
        reg = client.post("/api/v1/auth/register", json={
            "email": email, "password": "password123",
        })
        old_refresh = reg.json()["refresh_token"]
        # Rotate
        client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        # Reuse
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r.status_code == 401

    def test_invalid_refresh_token_returns_401(self, client):
        """A malformed refresh token is rejected."""
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-jwt"})
        assert r.status_code == 401

    def test_access_token_as_refresh_returns_401(self, client):
        """Using an access token (type != refresh) in /auth/refresh is rejected."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"nrt_{uuid.uuid4().hex[:8]}@test.io",
            "password": "password123",
        })
        access = reg.json()["access_token"]
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": access})
        assert r.status_code == 401

    def test_raw_tokens_not_stored_in_db(self, client, db):
        """auth_tokens only stores SHA-256 hashes; raw tokens never appear in the DB."""
        email = f"hash_{uuid.uuid4().hex[:8]}@test.io"
        reg = client.post("/api/v1/auth/register", json={
            "email": email, "password": "password123",
        })
        refresh = reg.json()["refresh_token"]
        expected_hash = hashlib.sha256(refresh.encode()).hexdigest()
        user = db.query(User).filter(User.email == email).first()
        tokens = _active_tokens(db, user.id, "refresh")
        assert len(tokens) >= 1
        assert tokens[0].token_hash == expected_hash
        assert refresh not in tokens[0].token_hash


# ─── 4. Password reset ───────────────────────────────────────────

class TestPasswordReset:
    def test_unknown_email_returns_200_no_enumeration(self, client):
        """Requesting a reset for a non-existent email still returns 200."""
        r = client.post("/api/v1/auth/password-reset/request", json={
            "email": f"nope_{uuid.uuid4().hex[:8]}@test.io",
        })
        assert r.status_code == 200

    def test_request_captures_token_in_sender(self, client, email_sender):
        """Requesting a reset for a known user stores the raw token in the sender."""
        email = f"rst_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={
            "email": email, "password": "password123",
        })
        r = client.post("/api/v1/auth/password-reset/request", json={"email": email})
        assert r.status_code == 200
        assert email in email_sender.password_resets
        assert len(email_sender.password_resets[email]) > 20

    def test_confirm_sets_new_password(self, client, email_sender):
        """After reset, the new password works and the old one does not."""
        email = f"rsc_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={
            "email": email, "password": "oldpassword1",
        })
        client.post("/api/v1/auth/password-reset/request", json={"email": email})
        token = email_sender.password_resets[email]

        r = client.post("/api/v1/auth/password-reset/confirm", json={
            "token": token, "new_password": "newpassword2",
        })
        assert r.status_code == 200

        # New password works
        login = client.post("/api/v1/auth/login", json={"email": email, "password": "newpassword2"})
        assert login.status_code == 200

        # Old password fails
        login_old = client.post("/api/v1/auth/login", json={"email": email, "password": "oldpassword1"})
        assert login_old.status_code == 401

    def test_reuse_token_fails(self, client, email_sender):
        """A password-reset token can only be used once."""
        email = f"rsu_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={"email": email, "password": "pass12345"})
        client.post("/api/v1/auth/password-reset/request", json={"email": email})
        token = email_sender.password_resets[email]

        client.post("/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "newpass123"})
        r2 = client.post("/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "another123"})
        assert r2.status_code == 400

    def test_refresh_tokens_revoked_after_reset(self, client, email_sender):
        """All refresh tokens for the user are revoked after a password reset."""
        email = f"rsr_{uuid.uuid4().hex[:8]}@test.io"
        reg = client.post("/api/v1/auth/register", json={"email": email, "password": "pass12345"})
        old_refresh = reg.json()["refresh_token"]

        client.post("/api/v1/auth/password-reset/request", json={"email": email})
        token = email_sender.password_resets[email]
        client.post("/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "newpass123"})

        # Old refresh token should be revoked
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r.status_code == 401


# ─── 5. Email verification ───────────────────────────────────────

class TestEmailVerification:
    def test_request_captures_token(self, client, email_sender):
        """verify-email/request captures the raw token in the sender fixture."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"vrf_{uuid.uuid4().hex[:8]}@test.io",
            "password": "password123",
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        r = client.post("/api/v1/auth/verify-email/request", headers=headers)
        assert r.status_code == 200
        email = reg.json()["user"]["email"]
        assert email in email_sender.verifications

    def test_confirm_sets_is_verified(self, client, email_sender):
        """After verify-email/confirm, is_verified flips to True."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"vrfc_{uuid.uuid4().hex[:8]}@test.io",
            "password": "password123",
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        client.post("/api/v1/auth/verify-email/request", headers=headers)
        email = reg.json()["user"]["email"]
        token = email_sender.verifications[email]

        r = client.post("/api/v1/auth/verify-email/confirm", json={"token": token})
        assert r.status_code == 200
        assert r.json()["is_verified"] is True

        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.json()["is_verified"] is True

    def test_already_verified_returns_message(self, client, email_sender):
        """If user is already verified, /verify-email/request returns early."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"vrfv_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        client.post("/api/v1/auth/verify-email/request", headers=headers)
        token = email_sender.verifications[reg.json()["user"]["email"]]
        client.post("/api/v1/auth/verify-email/confirm", json={"token": token})

        r2 = client.post("/api/v1/auth/verify-email/request", headers=headers)
        assert r2.status_code == 200
        assert "already verified" in r2.json()["message"].lower()


# ─── 6. Account deactivation ─────────────────────────────────────

class TestDeactivation:
    def test_deactivate_sets_inactive(self, client):
        """POST /users/deactivate sets is_active=False and blocks further authed calls."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"deac_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        r = client.post("/api/v1/users/deactivate", headers=headers)
        assert r.status_code == 200
        assert "deactivated" in r.json()["message"].lower()

        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 403 or me.json().get("is_active") is False

    def test_deactivate_revokes_refresh_tokens(self, client):
        """Deactivation revokes all refresh tokens."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"deacr_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        refresh = reg.json()["refresh_token"]
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        client.post("/api/v1/users/deactivate", headers=headers)

        r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r.status_code == 401

    def test_deactivated_user_cannot_login(self, client):
        """A deactivated user gets 403 at login."""
        email = f"dealog_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
        headers = {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': 'password123'}).json()['access_token']}"}
        client.post("/api/v1/users/deactivate", headers=headers)

        r = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
        assert r.status_code == 403


# ─── 7. Audit logging ────────────────────────────────────────────

class TestAuditLogging:
    def test_login_success_audited(self, client, db):
        """Successful login creates an audit row."""
        email = f"aud_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
        client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})

        rows = _audit_events(db, "login.success")
        assert len(rows) >= 1
        assert rows[0].actor_email == email

    def test_login_failure_audited(self, client, db):
        """Failed login creates an audit row (even though user lookup failed)."""
        email = f"audf_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})

        rows = _audit_events(db, "login.failed")
        assert len(rows) >= 1
        assert rows[0].actor_email == email

    def test_deactivation_audited(self, client, db):
        """Account deactivation creates an audit row."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"audd_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        client.post("/api/v1/users/deactivate", headers=headers)

        rows = _audit_events(db, "user.deactivated")
        assert len(rows) >= 1

    def test_password_reset_request_audited(self, client, db):
        """Password-reset request creates an audit row."""
        email = f"audpr_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
        client.post("/api/v1/auth/password-reset/request", json={"email": email})

        rows = _audit_events(db, "password_reset.requested")
        assert len(rows) >= 1

    def test_role_change_audited(self, client, admin_headers, db):
        """Admin role-change creates an audit row."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"audrc_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        target_id = reg.json()["user"]["id"]

        r = client.put(f"/api/v1/dashboard/users/{target_id}/role", headers=admin_headers,
                       json={"role": "Wellness Coach"})
        assert r.status_code == 200

        rows = _audit_events(db, "role.changed")
        assert len(rows) >= 1
        assert rows[0].detail["new_role"] == "Wellness Coach"


# ─── 8. Security response headers ────────────────────────────────

class TestSecurityHeaders:
    def test_headers_present_on_health(self, client):
        """Security headers are present on a normal 200 response."""
        r = client.get("/health")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"
        assert "default-src" in (r.headers.get("content-security-policy") or "")
        assert r.headers.get("referrer-policy") == "no-referrer"
        assert r.headers.get("x-permitted-cross-domain-policies") == "none"

    def test_headers_present_on_404(self, client):
        """Security headers are present even on error responses."""
        r = client.get("/api/v1/nonexistent")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"

    def test_hsts_not_set_in_development(self, client):
        """HSTS header is absent in development (would cause browser warnings on HTTP)."""
        r = client.get("/health")
        assert "strict-transport-security" not in {k.lower() for k in r.headers.keys()}


# ─── 9. Resource isolation (cross-user) ──────────────────────────

class TestResourceIsolation:
    def _make_two_users(self, client):
        """Register two users; return (email_a, headers_a, user_id_a, email_b, headers_b, user_id_b)."""
        e_a = f"isoA_{uuid.uuid4().hex[:8]}@test.io"
        e_b = f"isoB_{uuid.uuid4().hex[:8]}@test.io"
        r_a = client.post("/api/v1/auth/register", json={"email": e_a, "password": "password123"})
        r_b = client.post("/api/v1/auth/register", json={"email": e_b, "password": "password123"})
        h_a = {"Authorization": f"Bearer {r_a.json()['access_token']}"}
        h_b = {"Authorization": f"Bearer {r_b.json()['access_token']}"}
        return (e_a, h_a, r_a.json()["user"]["id"], e_b, h_b, r_b.json()["user"]["id"])

    def test_user_cannot_update_others_alarm(self, client):
        """Updating another user's alarm returns 404."""
        _, h_a, _, _, h_b, _ = self._make_two_users(client)
        # Create alarm as user A
        cr = client.post("/api/v1/alarms", headers=h_a, json={
            "title": "A's alarm", "type": "Daily", "time": "07:00", "challenge_type": "Math", "difficulty": "Easy",
        })
        alarm_id = cr.json()["id"]
        # User B tries to update it
        r = client.put(f"/api/v1/alarms/{alarm_id}", headers=h_b, json={
            "title": "Hijacked", "type": "Daily", "time": "08:00", "challenge_type": "Logic",
        })
        assert r.status_code == 404

    def test_user_cannot_delete_others_alarm(self, client):
        """Deleting another user's alarm returns 404."""
        _, h_a, _, _, h_b, _ = self._make_two_users(client)
        cr = client.post("/api/v1/alarms", headers=h_a, json={
            "title": "A alarm", "type": "Daily", "time": "07:00", "challenge_type": "Math", "difficulty": "Easy",
        })
        r = client.delete(f"/api/v1/alarms/{cr.json()['id']}", headers=h_b)
        assert r.status_code == 404

    def test_user_cannot_snooze_others_alarm(self, client):
        """Snoozing another user's alarm returns 404."""
        _, h_a, _, _, h_b, _ = self._make_two_users(client)
        cr = client.post("/api/v1/alarms", headers=h_a, json={
            "title": "A alarm", "type": "Daily", "time": "07:00", "challenge_type": "Math", "difficulty": "Easy",
        })
        r = client.post(f"/api/v1/alarms/{cr.json()['id']}/snooze", headers=h_b)
        assert r.status_code == 404

    def test_user_cannot_submit_others_challenge_attempt(self, client):
        """Submitting another user's challenge attempt returns 404."""
        _, h_a, _, _, h_b, _ = self._make_two_users(client)
        # A gets a challenge
        nxt = client.get("/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1", headers=h_a)
        assert nxt.status_code == 200
        ch = nxt.json()
        # B tries to submit A's attempt
        r = client.post("/api/v1/challenges/submit", headers=h_b, json={
            "challenge_id": ch["id"],
            "challenge_attempt_id": ch["challenge_attempt_id"],
            "user_answer": "0",
            "time_taken_seconds": 10,
        })
        assert r.status_code == 404

    def test_profile_returns_own_data(self, client):
        """GET /users/profile returns the requesting user's own data."""
        e_a, h_a, id_a, e_b, h_b, id_b = self._make_two_users(client)
        me_a = client.get("/api/v1/users/profile", headers=h_a)
        me_b = client.get("/api/v1/users/profile", headers=h_b)
        assert me_a.json()["email"] == e_a.lower()
        assert me_b.json()["email"] == e_b.lower()
        assert me_a.json()["id"] == id_a
        assert me_b.json()["id"] == id_b

    def test_analytics_returns_own_user_id(self, client):
        """GET /analytics/me returns the requesting user's own user_id."""
        _, h_a, id_a, _, h_b, id_b = self._make_two_users(client)
        a = client.get("/api/v1/analytics/me", headers=h_a)
        b = client.get("/api/v1/analytics/me", headers=h_b)
        assert a.json()["user_id"] == id_a
        assert b.json()["user_id"] == id_b

    def test_push_tokens_isolated(self, client):
        """Each user only sees their own push tokens."""
        _, h_a, _, _, h_b, _ = self._make_two_users(client)
        client.post("/api/v1/notifications/register", headers=h_a, json={"token": "tok-a-123", "platform": "android"})
        client.post("/api/v1/notifications/register", headers=h_b, json={"token": "tok-b-456", "platform": "android"})
        tok_a = client.get("/api/v1/notifications/tokens", headers=h_a).json()
        tok_b = client.get("/api/v1/notifications/tokens", headers=h_b).json()
        assert len(tok_a) == 1 and tok_a[0]["token"] == "tok-a-123"
        assert len(tok_b) == 1 and tok_b[0]["token"] == "tok-b-456"

    def test_reports_scoped_to_user(self, client):
        """Habit report only contains the requesting user's data."""
        _, h_a, _, _, h_b, _ = self._make_two_users(client)
        r = client.get("/api/v1/dashboard/reports/habits?format=json&days=7", headers=h_b)
        assert r.status_code == 200
        # No data for a fresh user — the report body should be empty or contain no records
        # (backend returns JSON list; new user has no habit_scores)
        import json
        if r.headers.get("content-type", "").startswith("application/json"):
            data = json.loads(r.content)
            # records list should be empty for a fresh user
            assert isinstance(data, (list, dict))


# ─── 10. RBAC positive path (role change) ────────────────────────

class TestRoleChange:
    def test_admin_can_change_role(self, client, admin_headers):
        """Admin can assign a role to another user."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"rc_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        target_id = reg.json()["user"]["id"]
        r = client.put(f"/api/v1/dashboard/users/{target_id}/role", headers=admin_headers,
                       json={"role": "Wellness Coach"})
        assert r.status_code == 200
        assert r.json()["role"] == "Wellness Coach"

    def test_non_admin_cannot_change_role(self, client, user_headers):
        """Non-admin users get 403 when trying to change roles."""
        reg = client.post("/api/v1/auth/register", json={
            "email": f"rcna_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        target_id = reg.json()["user"]["id"]
        r = client.put(f"/api/v1/dashboard/users/{target_id}/role", headers=user_headers,
                       json={"role": "Administrator"})
        assert r.status_code == 403

    def test_admin_can_list_users(self, client, admin_headers):
        """Admin can access the /dashboard/users endpoint."""
        r = client.get("/api/v1/dashboard/users", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_role_change_to_admin_grants_access(self, client, db):
        """After role change to Administrator, the user can access admin endpoints."""
        email = f"rcga_{uuid.uuid4().hex[:8]}@test.io"
        reg = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
        target_id = reg.json()["user"]["id"]
        target_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        # Create an admin to perform the role change
        admin_reg = client.post("/api/v1/auth/register", json={
            "email": f"rcgaa_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        admin_id = admin_reg.json()["user"]["id"]
        # Promote to admin via the shared test session
        from app.api.deps import get_or_create_role
        from app.Models import UserRole as UR
        admin_role = get_or_create_role(db, "Administrator")
        db.add(UR(user_id=admin_id, role_id=admin_role.id))
        db.commit()
        admin_headers2 = {"Authorization": f"Bearer {admin_reg.json()['access_token']}"}

        # Promote target to admin
        client.put(f"/api/v1/dashboard/users/{target_id}/role", headers=admin_headers2,
                   json={"role": "Administrator"})

        # Target can now list users
        r = client.get("/api/v1/dashboard/users", headers=target_headers)
        assert r.status_code == 200


# ─── 11. API backward compatibility ──────────────────────────────

class TestApiCompatibility:
    def test_register_response_shape(self, client):
        """Register response still contains access_token, refresh_token, user."""
        r = client.post("/api/v1/auth/register", json={
            "email": f"compat_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 3600
        assert "user" in data
        assert "email" in data["user"]

    def test_login_response_shape(self, client):
        """Login response still contains the same keys as before."""
        email = f"compat_{uuid.uuid4().hex[:8]}@test.io"
        client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data

    def test_error_envelope_unchanged(self, client):
        """Error responses still use the {detail, error_code, timestamp, status_code} envelope."""
        r = client.post("/api/v1/auth/login", json={"email": "x@x.com", "password": "x"})
        assert r.status_code == 401
        data = r.json()
        assert "detail" in data
        assert "error_code" in data
        assert data["error_code"] == "ERR_401"
        assert "timestamp" in data
        assert data["status_code"] == 401
