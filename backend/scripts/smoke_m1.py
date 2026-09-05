"""End-to-end Milestone 1 smoke test for CerebroKognit.

Run from backend/:  .venv\\Scripts\\python.exe scripts\\smoke_m1.py
Uses a throwaway SQLite DB so it never touches real data.
"""

import os
import sys
import tempfile

# Ensure backend/ is importable regardless of CWD
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Chdir to a fresh temp dir so backend/.env (load_dotenv override=True)
# is NOT discovered and cannot clobber the env vars below.
_tmpdir = tempfile.mkdtemp(prefix="cerebro_m1_")
os.chdir(_tmpdir)

# Fresh temp DB before importing the app
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["SECRET_KEY"] = "smoke_test_secret_key_that_is_long_enough"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.Models import Base  # noqa: E402

Base.metadata.create_all(bind=engine)


def sqlite_role_count(name):
    db = SessionLocal()
    try:
        from app.Models import Role
        return db.query(Role).filter(Role.name == name).count()
    finally:
        db.close()


def main():
    failures = []
    def check(label, cond, extra=""):
        mark = "PASS" if cond else "FAIL"
        print(f"[{mark}] {label} {extra}")
        if not cond:
            failures.append(label)

    c = TestClient(app)

    # --- Health ---
    r = c.get("/health")
    check("GET /health", r.status_code == 200, f"({r.status_code})")

    # --- Register creates role "User" ---
    email = "m1@example.com"
    reg = c.post("/api/v1/auth/register", json={
        "email": email, "password": "password123",
        "full_name": "M1 User", "timezone": "Asia/Kolkata", "difficulty_preference": "Hard",
    })
    check("POST /auth/register", reg.status_code == 200, f"({reg.status_code})")
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    check("register returns access_token", bool(token))

    # --- login ---
    log = c.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    check("POST /auth/login", log.status_code == 200, f"({log.status_code})")

    # --- /auth/me ---
    me = c.get("/api/v1/auth/me", headers=headers)
    check("GET /auth/me", me.status_code == 200 and me.json()["email"] == email, f"({me.status_code})")

    # --- profile update (users router) ---
    prof = c.put("/api/v1/users/profile", headers=headers,
                 json={"full_name": "Updated M1", "timezone": "UTC", "difficulty_preference": "Easy"})
    check("PUT /users/profile", prof.status_code == 200 and prof.json()["full_name"] == "Updated M1",
          f"({prof.status_code})")

    # --- settings update (users router) ---
    st = c.put("/api/v1/users/vibrate", headers=headers, json={"vibrate": True})
    check("PUT /users/{key}", st.status_code == 200 and st.json()["vibrate"] is True, f"({st.status_code})")
    bad = c.put("/api/v1/users/nonsense", headers=headers, json={"nonsense": True})
    check("PUT /users/{unknown} -> 400", bad.status_code == 400, f"({bad.status_code})")

    # --- role was assigned ---
    # verify via DB (seed not run here; role created by get_or_create_role on register)
    from app.Models import Role, UserRole, User
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    role = db.query(Role).filter(Role.name == "User").first()
    has_role = db.query(UserRole).filter(UserRole.user_id == user.id, UserRole.role_id == role.id).count() == 1
    db.close()
    check("register assigns 'User' role", has_role)

    # --- create alarm with time + challenge + recurrence ---
    al = c.post("/api/v1/alarms", headers=headers, json={
        "title": "Gym", "type": "Weekday", "time": "06:30",
        "challenge_type": "Math", "difficulty": "Easy", "recurrence": "weekdays",
    })
    check("POST /alarms (create)", al.status_code == 200, f"({al.status_code})")
    al_json = al.json()
    check("alarm links challenge", al_json.get("challenge_id") is not None and al_json.get("challenge_type") == "Math")
    check("alarm returns recurrence", al_json.get("recurrence") == "weekdays")
    from datetime import datetime as _dt
    nxt = _dt.fromisoformat(al_json["next_trigger"].replace("Z", "+00:00"))
    check("alarm time honors 06:30", nxt.hour == 6 and nxt.minute == 30, f"(got {nxt.hour}:{nxt.minute})")
    check("alarm is weekday", nxt.weekday() < 5, f"(weekday={nxt.weekday()})")
    alarm_id = al_json["id"]

    # --- list alarms ---
    lst = c.get("/api/v1/alarms", headers=headers)
    check("GET /alarms", lst.status_code == 200 and len(lst.json()) == 1, f"({lst.status_code})")

    # --- snooze ---
    sn = c.post(f"/api/v1/alarms/{alarm_id}/snooze", headers=headers)
    check("POST /alarms/{id}/snooze", sn.status_code == 200 and sn.json()["times_snoozed"] == 1, f"({sn.status_code})")

    # --- update alarm ---
    up = c.put(f"/api/v1/alarms/{alarm_id}", headers=headers, json={
        "title": "Gym v2", "type": "Daily", "time": "07:00",
        "challenge_type": "Logic", "difficulty": "Medium", "recurrence": "daily",
    })
    check("PUT /alarms/{id}", up.status_code == 200 and up.json()["challenge_type"] == "Logic", f"({up.status_code})")

    # --- delete alarm ---
    de = c.delete(f"/api/v1/alarms/{alarm_id}", headers=headers)
    check("DELETE /alarms/{id}", de.status_code == 200, f"({de.status_code})")

    # --- RBAC: normal user blocked from admin endpoints ---
    dash = c.get("/api/v1/dashboard/users", headers=headers)
    check("RBAC blocks user from /dashboard/users", dash.status_code == 403, f"({dash.status_code})")
    dash_an = c.get("/api/v1/dashboard/analytics", headers=headers)
    check("RBAC blocks user from /dashboard/analytics", dash_an.status_code == 403, f"({dash_an.status_code})")

    # --- habit score + history (no hardcoded placeholder; computes from data) ---
    hs = c.get("/api/v1/habits/score", headers=headers)
    check("GET /habits/score", hs.status_code == 200 and "overall_score" in hs.json(), f"({hs.status_code})")
    hh = c.get("/api/v1/habits/score/history?days=7", headers=headers)
    check("GET /habits/score/history", hh.status_code == 200 and len(hh.json()) == 7, f"({hh.status_code})")

    print()
    print("=" * 60)
    if failures:
        print(f"SMOKE TEST RESULT: {len(failures)} FAILURE(S)")
        for f in failures:
            print("  -", f)
        raise SystemExit(1)
    print("SMOKE TEST RESULT: ALL PASS")

    try:
        os.unlink(_tmp.name)
    except OSError:
        pass


if __name__ == "__main__":
    main()