import io
import zipfile
from datetime import timedelta

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.timeutil import utcnow
from app.models import AuditLog, Notification, User
from tests.conftest import PW, auth, login, register, set_role
from tests.helpers import active, answer, due_alarm, tick, user_utc


def _log_sleep(client, h, n=8, productivity_follows_sleep=True):
    today = utcnow().date()
    for i in range(n):
        bed = "22:00:00" if i % 2 else "01:00:00"
        wake = "06:30:00"
        r = client.put("/sleep", headers=h, json={"log_date": (today - timedelta(days=i)).isoformat(), "bedtime": bed,
                                                   "wake_time": wake, "quality": 3 + i % 3,
                                                   "productivity": (5 if i % 2 else 2) if productivity_follows_sleep else 3})
        assert r.status_code == 200, r.text


def test_sleep_log_duration_and_validation(client):
    h = user_utc(client)
    r = client.put("/sleep", headers=h, json={"log_date": utcnow().date().isoformat(), "bedtime": "23:00:00", "wake_time": "07:00:00"})
    assert r.json()["duration_minutes"] == 480  # crosses midnight
    far = (utcnow().date() + timedelta(days=10)).isoformat()
    assert client.put("/sleep", headers=h, json={"log_date": far, "bedtime": "23:00:00", "wake_time": "07:00:00"}).status_code == 422
    # upsert: same date updates rather than duplicates
    client.put("/sleep", headers=h, json={"log_date": utcnow().date().isoformat(), "bedtime": "22:00:00", "wake_time": "07:00:00"})
    assert len(client.get("/sleep", headers=h).json()) == 1


def test_habit_score_uses_spec_weights_and_renormalises_missing_data(client):
    h = user_utc(client)
    s = client.get("/insights/summary", headers=h).json()["habit"]
    assert s["has_data"] is False and s["total"] == 0 and s["weights"] == {
        "wake_consistency": 0.35, "challenge_completion": 0.25, "snooze_reduction": 0.2, "sleep_adherence": 0.2}
    due_alarm(client, h)
    tick()
    sess = active(client, h)
    answer(client, h, sess)  # one perfect, snooze-free wake-up
    s = client.get("/insights/summary", headers=h).json()["habit"]
    assert s["wake_consistency"] == 100 and s["challenge_completion"] == 100 and s["snooze_reduction"] == 100
    assert s["sleep_adherence"] is None and s["total"] == 100  # unknown components are not faked
    _log_sleep(client, h, 6)
    s = client.get("/insights/summary", headers=h).json()["habit"]
    comps = {k: s[k] for k in s["weights"]}
    assert abs(s["total"] - sum(s["weights"][k] * comps[k] for k in comps)) < 0.2  # exact weighted formula


def test_productivity_correlation_and_recommendations_dedupe(client):
    h = user_utc(client)
    _log_sleep(client, h, 10)
    sl = client.get("/insights/sleep", headers=h).json()
    assert sl["sleep"]["n"] == 10 and sl["sleep"]["bedtime_regularity_minutes"] > 60
    corr = {c["factor"]: c["r"] for c in sl["productivity"]["correlations"]}
    assert corr["Sleep duration"] > 0.4
    first = client.get("/insights/recommendations", headers=h).json()
    assert first and {r["category"] for r in first} & {"sleep", "productivity"}
    assert len(client.get("/insights/recommendations", headers=h).json()) == len(first)  # no duplicates
    rid = first[0]["id"]
    assert client.post(f"/insights/recommendations/{rid}/dismiss", headers=h).status_code == 200
    assert all(r["id"] != rid for r in client.get("/insights/recommendations", headers=h).json())


def test_challenge_analytics_and_adaptive_difficulty_preference(client):
    h = user_utc(client)
    for _ in range(3):
        due_alarm(client, h, label="x") if False else None
    due_alarm(client, h)
    tick()
    sess = active(client, h)
    r = answer(client, h, sess, wrong=True)
    sess["challenge"] = r["challenge"]
    answer(client, h, sess)
    ch = client.get("/insights/challenges", headers=h).json()
    assert ch["total"] == 2 and ch["correct"] == 1 and ch["accuracy"] == 0.5 and ch["by_type"] and ch["by_difficulty"]
    client.put("/users/me/profile", headers=h, json={"timezone": "UTC", "difficulty_preference": "hard"})
    assert client.get("/users/me", headers=h).json()["profile"]["current_difficulty"] == "hard"


def test_coach_requires_member_consent(client):
    register(client, "coach@example.com")
    set_role("coach@example.com", "wellness_coach")
    hc = auth(client, "coach@example.com", portal="coach")
    hm, um = register(client, "member@example.com", name="Mia Member")
    hn, un = register(client, "nosy@example.com")
    # no link yet -> the coach cannot see the member at all
    assert client.get(f"/coach/members/{um['id']}", headers=hc).status_code == 404
    gen = client.post("/coach/invite", headers=hc, json={"email": "member@example.com"}).json()
    ghost = client.post("/coach/invite", headers=hc, json={"email": "ghost@example.com"}).json()
    assert gen == ghost  # same answer whether or not the account exists
    assert client.get(f"/coach/members/{um['id']}", headers=hc).status_code == 404  # still pending
    link = client.get("/users/me/coach-links", headers=hm).json()[0]
    assert client.post(f"/users/me/coach-links/{link['id']}/respond", headers=hn, json={"accept": True}).status_code == 404
    assert client.post(f"/users/me/coach-links/{link['id']}/respond", headers=hm, json={"accept": True}).status_code == 200
    d = client.get(f"/coach/members/{um['id']}", headers=hc)
    assert d.status_code == 200 and d.json()["member"]["full_name"] == "Mia Member"
    assert client.get(f"/coach/members/{un['id']}", headers=hc).status_code == 404  # un-linked member stays private
    assert client.get("/coach/overview", headers=hc).json()["stats"]["members"] == 1
    assert client.post(f"/coach/members/{um['id']}/message", headers=hc, json={"message": "Great streak!"}).status_code == 200
    assert any("Great streak" in n["body"] for n in client.get("/notifications", headers=hm).json()["items"])
    client.delete(f"/users/me/coach-links/{link['id']}", headers=hm)  # member revokes
    assert client.get(f"/coach/members/{um['id']}", headers=hc).status_code == 404


def test_admin_management_audit_and_announcements(client):
    register(client, "admin@example.com")
    set_role("admin@example.com", "admin")
    ha = auth(client, "admin@example.com", portal="admin")
    _, u = register(client, "bob@example.com", name="Bob Builder")
    register(client, "carol@example.com")
    assert client.get("/admin/users?q=bob", headers=ha).json()["total"] == 1
    assert client.patch(f"/admin/users/{u['id']}/role", headers=ha, json={"role": "wellness_coach"}).status_code == 200
    assert client.patch(f"/admin/users/{u['id']}/active", headers=ha).json()["is_active"] is False
    assert login(client, "bob@example.com").status_code == 403  # deactivated accounts cannot sign in
    audit = client.get("/admin/audit", headers=ha).json()
    assert {"role_changed", "account_deactivated"} <= {a["action"] for a in audit["items"]}
    assert client.post("/admin/announcements", headers=ha, json={"title": "Maintenance", "body": "Tonight 2am"}).json()["sent_to"] >= 2
    hc = auth(client, "carol@example.com")
    assert any(n["title"] == "Maintenance" for n in client.get("/notifications", headers=hc).json()["items"])
    ov = client.get("/admin/overview", headers=ha).json()
    assert ov["users"]["total"] == 3 and "by_role" in ov["users"]
    sysi = client.get("/admin/system", headers=ha).json()
    assert sysi["database"] == "ok" and sysi["version"]
    assert client.get("/admin/recommendations", headers=ha).status_code == 200
    # unlock a locked account
    for _ in range(5):
        login(client, "carol@example.com", "WrongPassw0rd!")
    carol = client.get("/admin/users?q=carol", headers=ha).json()["items"][0]
    assert carol["locked"] is True
    client.post(f"/admin/users/{carol['id']}/unlock", headers=ha)
    assert login(client, "carol@example.com").status_code == 200


def test_notifications_are_private_and_manageable(client):
    ha, _ = register(client, "n1@example.com")
    hb, _ = register(client, "n2@example.com")
    s = SessionLocal()
    uid = s.query(User).filter(User.email == "n1@example.com").first().id
    s.add(Notification(user_id=uid, kind="wake", title="Hi", body="there"))
    s.commit()
    s.close()
    items = client.get("/notifications", headers=ha).json()
    assert items["unread"] == 1 and client.get("/notifications", headers=hb).json()["items"] == []
    nid = items["items"][0]["id"]
    assert client.patch(f"/notifications/{nid}/read", headers=hb).status_code == 404
    assert client.patch(f"/notifications/{nid}/read", headers=ha).json()["is_read"] is True
    assert client.delete(f"/notifications/{nid}", headers=ha).status_code == 200


def test_reports_pdf_and_excel_for_every_kind(client):
    h = user_utc(client)
    _log_sleep(client, h, 6)
    due_alarm(client, h)
    tick()
    answer(client, h, active(client, h))
    for kind in ("habit", "wake", "challenge", "productivity", "sleep"):
        pdf = client.get(f"/reports/{kind}?format=pdf&days=30", headers=h)
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF"), kind
        xl = client.get(f"/reports/{kind}?format=excel", headers=h)
        assert xl.status_code == 200 and zipfile.ZipFile(io.BytesIO(xl.content)).namelist(), kind
    assert client.get("/reports/nonsense", headers=h).status_code == 404
    assert client.get("/reports/system", headers=h).status_code == 403
    register(client, "boss@example.com")
    set_role("boss@example.com", "admin")
    assert client.get("/reports/system?format=pdf", headers=auth(client, "boss@example.com")).content.startswith(b"%PDF")


def test_demo_seed_populates_every_dashboard(client, monkeypatch):
    from app.services import bootstrap
    monkeypatch.setattr(settings, "SEED_DEMO_DATA", True)
    monkeypatch.setattr(settings, "DEMO_PASSWORD", PW)
    s = SessionLocal()
    bootstrap.seed_demo(s)
    s.close()
    hc = auth(client, "coach@demo.example.com", portal="coach")
    ov = client.get("/coach/overview", headers=hc).json()
    assert ov["stats"]["members"] == 3 and all(m["habit_score"] is not None for m in ov["members"])
    hm = auth(client, "meera@demo.example.com")
    summ = client.get("/insights/summary", headers=hm).json()
    assert summ["wake"]["total"] >= 12 and summ["habit"]["has_data"] and len(client.get("/insights/habit-history", headers=hm).json()) >= 20
    detail = client.get(f"/coach/members/{ov['members'][0]['id']}", headers=hc).json()
    assert detail["challenges"]["total"] > 0 and detail["sleep"]["n"] > 0


def test_bootstrap_creates_first_admin_only_with_strong_password(client, monkeypatch):
    from app.services import bootstrap
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "root@example.com")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "weak")
    s = SessionLocal()
    bootstrap.ensure_admin(s)
    assert s.query(User).filter(User.role == "admin").count() == 0
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", PW)
    bootstrap.ensure_admin(s)
    bootstrap.ensure_admin(s)  # idempotent
    assert s.query(User).filter(User.role == "admin").count() == 1
    s.close()
    assert login(client, "root@example.com", portal="admin").status_code == 200
