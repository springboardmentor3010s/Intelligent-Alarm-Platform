# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Google OAuth2 login tests (Module 1).

Google's network boundary is monkeypatched, so these run offline and assert the
local link-or-create + token issuance behavior.
"""

import pytest
from fastapi import HTTPException

from app.services.oauth_service import GoogleOAuthService

REDIRECT = "http://localhost:5173/auth"


def _enable_google(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")


def _fake_google(monkeypatch, *, sub="g-sub-1", email="newgoogle@test.io", verified=True, name="G User"):
    monkeypatch.setattr(
        GoogleOAuthService, "_exchange_code", lambda code, redirect_uri: {"id_token": "fake"}
    )
    monkeypatch.setattr(
        GoogleOAuthService,
        "_verify_id_token",
        lambda token: {"sub": sub, "email": email, "email_verified": verified, "name": name},
    )


def _start(client):
    r = client.get("/api/v1/auth/oauth/google/login", params={"redirect_uri": REDIRECT})
    assert r.status_code == 200, r.text
    return r.json()


def test_oauth_disabled_returns_503(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    r = client.get("/api/v1/auth/oauth/google/login", params={"redirect_uri": REDIRECT})
    assert r.status_code == 503, r.text


def test_login_returns_consent_url_and_state(client, monkeypatch):
    _enable_google(monkeypatch)
    body = _start(client)
    assert body["authorization_url"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "client_id=test-client-id" in body["authorization_url"]
    assert body["state"]


def test_callback_creates_user_and_issues_tokens(client, monkeypatch):
    _enable_google(monkeypatch)
    _fake_google(monkeypatch)
    start = _start(client)

    r = client.post(
        "/api/v1/auth/oauth/google/callback",
        json={"code": "abc", "redirect_uri": REDIRECT, "state": start["state"]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "newgoogle@test.io"
    assert body["user"]["is_verified"] is True

    # The issued token works, and an OAuth account cannot password-login.
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    bad = client.post("/api/v1/auth/login", json={"email": "newgoogle@test.io", "password": "whatever"})
    assert bad.status_code == 401


def test_callback_links_existing_email_account(client, monkeypatch):
    _enable_google(monkeypatch)
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "link@test.io", "password": "password123", "timezone": "UTC"},
    )
    assert reg.status_code == 200, reg.text
    existing_id = reg.json()["user"]["id"]

    _fake_google(monkeypatch, sub="link-sub", email="link@test.io")
    start = _start(client)
    r = client.post(
        "/api/v1/auth/oauth/google/callback",
        json={"code": "abc", "redirect_uri": REDIRECT, "state": start["state"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user"]["id"] == existing_id

    # The original password still works after linking.
    log = client.post("/api/v1/auth/login", json={"email": "link@test.io", "password": "password123"})
    assert log.status_code == 200, log.text


def test_callback_rejects_invalid_state(client, monkeypatch):
    _enable_google(monkeypatch)
    _fake_google(monkeypatch)
    r = client.post(
        "/api/v1/auth/oauth/google/callback",
        json={"code": "abc", "redirect_uri": REDIRECT, "state": "not-a-real-state"},
    )
    assert r.status_code == 400, r.text


def test_state_is_bound_to_redirect_uri(client, monkeypatch):
    _enable_google(monkeypatch)
    _fake_google(monkeypatch)
    start = _start(client)
    r = client.post(
        "/api/v1/auth/oauth/google/callback",
        json={"code": "abc", "redirect_uri": "http://evil.example/auth", "state": start["state"]},
    )
    assert r.status_code == 400, r.text


def test_callback_same_google_identity_is_idempotent(client, monkeypatch):
    _enable_google(monkeypatch)
    _fake_google(monkeypatch, sub="stable-sub", email="idem@test.io")

    first = client.post(
        "/api/v1/auth/oauth/google/callback",
        json={"code": "a", "redirect_uri": REDIRECT, "state": _start(client)["state"]},
    ).json()
    second = client.post(
        "/api/v1/auth/oauth/google/callback",
        json={"code": "b", "redirect_uri": REDIRECT, "state": _start(client)["state"]},
    ).json()
    assert first["user"]["id"] == second["user"]["id"]


# ----------------------------------------------------------------------
# Native (mobile) PKCE flow — POST /auth/oauth/google/mobile
# ----------------------------------------------------------------------

def test_mobile_disabled_returns_503(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    r = client.post("/api/v1/auth/oauth/google/mobile", json={"id_token": "x"})
    assert r.status_code == 503, r.text


def test_mobile_creates_user_from_id_token(client, monkeypatch):
    _enable_google(monkeypatch)
    monkeypatch.setattr(
        GoogleOAuthService,
        "_verify_id_token",
        lambda token: {
            "sub": "mobile-sub",
            "email": "mobile@test.io",
            "email_verified": True,
            "name": "Mobile User",
        },
    )
    r = client.post("/api/v1/auth/oauth/google/mobile", json={"id_token": "fake-id-token"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "mobile@test.io"


def test_mobile_rejects_invalid_token(client, monkeypatch):
    _enable_google(monkeypatch)

    def _reject(token):
        raise HTTPException(status_code=401, detail="Invalid Google identity token")

    monkeypatch.setattr(GoogleOAuthService, "_verify_id_token", _reject)
    r = client.post("/api/v1/auth/oauth/google/mobile", json={"id_token": "bad"})
    assert r.status_code == 401, r.text


# ----------------------------------------------------------------------
# Dependency guards — the real verifier must fail closed, never ImportError
#
# `_verify_id_token` imports ``google.auth.transport.requests``, which needs the
# ``requests`` package (declared in requirements.txt / requirements-runtime.txt).
# These tests do NOT monkeypatch the verifier: if that dependency is ever dropped
# the import raises ImportError -> HTTP 500 instead of a graceful 401.
# ----------------------------------------------------------------------

def test_id_token_verifier_fails_closed_without_raising_importerror():
    with pytest.raises(HTTPException) as exc:
        GoogleOAuthService._verify_id_token("dummy")
    assert exc.value.status_code == 401


def test_mobile_malformed_token_is_401_not_500(client, monkeypatch):
    _enable_google(monkeypatch)
    r = client.post("/api/v1/auth/oauth/google/mobile", json={"id_token": "not-a-jwt"})
    assert r.status_code == 401, r.text
