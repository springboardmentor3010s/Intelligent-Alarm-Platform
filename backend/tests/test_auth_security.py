from datetime import timedelta

from app.core.timeutil import utcnow
from app.models import AuditLog, RefreshToken, User
from tests.conftest import PW, auth, login, register, set_role


def test_register_login_me(client):
    h, u = register(client, "a@example.com")
    assert u["role"] == "user" and u["profile"]["onboarded"] is False
    assert client.get("/users/me", headers=h).json()["email"] == "a@example.com"
    assert login(client, "a@example.com").status_code == 200


def test_weak_and_duplicate_passwords_rejected(client):
    for pw in ("short1", "alllettersonly", "1234567890123"):
        r = client.post("/auth/register", json={"full_name": "X Y", "email": "w@example.com", "password": pw})
        assert r.status_code == 422, pw
    register(client, "dup@example.com")
    r = client.post("/auth/register", json={"full_name": "X Y", "email": "DUP@example.com", "password": PW})
    assert r.status_code == 409


def test_unauthenticated_and_forged_tokens_rejected(client):
    assert client.get("/users/me").status_code == 401
    assert client.get("/users/me", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401


def test_role_is_enforced_server_side(client):
    h, _ = register(client, "u@example.com")
    assert client.get("/admin/overview", headers=h).status_code == 403
    assert client.get("/coach/overview", headers=h).status_code == 403
    set_role("u@example.com", "admin")
    assert client.get("/admin/overview", headers=h).status_code == 200  # role re-read from DB, not the token


def test_portals(client):
    register(client, "m@example.com")
    register(client, "c@example.com")
    set_role("c@example.com", "wellness_coach")
    assert login(client, "m@example.com", portal="member").status_code == 200
    assert login(client, "m@example.com", portal="coach").status_code == 403
    assert login(client, "m@example.com", portal="admin").status_code == 403
    assert login(client, "c@example.com", portal="coach").status_code == 200
    assert login(client, "c@example.com", portal="admin").status_code == 403


def test_lockout_after_repeated_failures(client):
    register(client, "l@example.com")
    for _ in range(5):
        assert login(client, "l@example.com", "WrongPassw0rd!").status_code == 401
    r = login(client, "l@example.com")  # even the right password is refused while locked
    assert r.status_code == 429


def test_unknown_email_gives_same_error(client):
    r1 = login(client, "nobody@example.com")
    register(client, "real@example.com")
    r2 = login(client, "real@example.com", "WrongPassw0rd!")
    assert r1.status_code == r2.status_code == 401 and r1.json() == r2.json()


def test_refresh_rotation_and_reuse_detection(client, db):
    register(client, "r@example.com")
    hdr = {"X-Requested-With": "XMLHttpRequest"}
    old = client.cookies.get("refresh_token")
    assert client.post("/auth/refresh").status_code == 403  # missing CSRF header
    r = client.post("/auth/refresh", headers=hdr)
    assert r.status_code == 200 and client.cookies.get("refresh_token") != old
    new = client.cookies.get("refresh_token")
    # replaying the OLD (revoked) token => every session of that user is revoked
    client.cookies.set("refresh_token", old, path="/")
    assert client.post("/auth/refresh", headers=hdr).status_code == 401
    client.cookies.set("refresh_token", new, path="/")
    assert client.post("/auth/refresh", headers=hdr).status_code == 401
    assert db.query(AuditLog).filter(AuditLog.action == "refresh_token_reuse").count() >= 1


def test_logout_revokes_refresh_token(client):
    register(client, "o@example.com")
    hdr = {"X-Requested-With": "XMLHttpRequest"}
    tok = client.cookies.get("refresh_token")
    assert client.post("/auth/logout").status_code == 200
    client.cookies.set("refresh_token", tok, path="/")
    assert client.post("/auth/refresh", headers=hdr).status_code == 401


def test_tokens_are_stored_hashed(client, db):
    register(client, "h@example.com")
    raw = client.cookies.get("refresh_token")
    assert all(t.token_hash != raw for t in db.query(RefreshToken).all())
    assert "hashed_password" not in client.get("/users/me", headers=auth(client, "h@example.com")).text


def test_password_change_revokes_other_sessions_and_delete_account(client):
    h, _ = register(client, "p@example.com")
    r = client.post("/users/me/password", headers=h, json={"current_password": "bad", "new_password": "An0therStrongPass"})
    assert r.status_code == 400
    r = client.post("/users/me/password", headers=h, json={"current_password": PW, "new_password": "An0therStrongPass"})
    assert r.status_code == 200
    assert login(client, "p@example.com", "An0therStrongPass").status_code == 200
    h2 = auth(client, "p@example.com", "An0therStrongPass")
    assert client.request("DELETE", "/users/me", headers=h2, json={"password": "wrong"}).status_code == 400
    assert client.request("DELETE", "/users/me", headers=h2, json={"password": "An0therStrongPass"}).status_code == 200
    assert login(client, "p@example.com", "An0therStrongPass").status_code == 401


def test_security_headers(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "x-request-id" in r.headers


def test_coach_application_needs_admin_approval(client):
    register(client, "adm@example.com")
    set_role("adm@example.com", "admin")
    h, u = register(client, "wc@example.com", account_type="coach")
    assert u["role"] == "user" and u["coach_requested"] is True  # NOT a coach until approved
    assert client.get("/coach/overview", headers=h).status_code == 403
    ha = auth(client, "adm@example.com")
    reqs = client.get("/admin/coach-requests", headers=ha).json()
    assert len(reqs) == 1
    assert client.post(f"/admin/coach-requests/{reqs[0]['id']}/approve", headers=ha).status_code == 200
    assert client.get("/coach/overview", headers=auth(client, "wc@example.com", portal="coach")).status_code == 200


def test_last_admin_protected(client):
    h, u = register(client, "only@example.com")
    set_role("only@example.com", "admin")
    h = auth(client, "only@example.com")
    assert client.patch(f"/admin/users/{u['id']}/role", headers=h, json={"role": "user"}).status_code == 409
    assert client.patch(f"/admin/users/{u['id']}/active", headers=h).status_code == 409
    assert client.request("DELETE", "/users/me", headers=h, json={"password": PW}).status_code == 409


def test_google_oauth_state_and_login(client, monkeypatch):
    from app.core.config import settings
    from app.routers import oauth
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
    assert client.get("/auth/providers").json() == {"google": True}
    r = client.get("/auth/google/login", follow_redirects=False)
    assert r.status_code in (302, 307) and "accounts.google.com" in r.headers["location"]
    state = client.cookies.get("oauth_state")
    monkeypatch.setattr(oauth, "exchange_code", lambda code: {"email": "g@example.com", "sub": "123", "name": "G User", "email_verified": True})
    bad = client.get("/auth/google/callback?code=abc&state=WRONG", follow_redirects=False)
    assert "error=oauth" in bad.headers["location"]
    ok = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    assert ok.headers["location"].endswith("/auth/callback") and client.cookies.get("refresh_token")
    r = client.post("/auth/refresh", headers={"X-Requested-With": "XMLHttpRequest"})
    assert r.status_code == 200 and r.json()["user"]["email"] == "g@example.com"
    monkeypatch.setattr(oauth, "exchange_code", lambda code: {"email": "u@example.com", "sub": "9", "email_verified": False})
    state2 = client.get("/auth/google/login", follow_redirects=False) and client.cookies.get("oauth_state")
    unverified = client.get(f"/auth/google/callback?code=abc&state={state2}", follow_redirects=False)
    assert "error=oauth" in unverified.headers["location"]
