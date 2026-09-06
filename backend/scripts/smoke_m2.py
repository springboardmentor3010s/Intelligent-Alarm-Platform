"""End-to-end Milestone 2 smoke test for CerebroKognit.

Verifies (on a throwaway SQLite DB that is built via Alembic migrations):
  1. Health + registration + login
  2. Challenge retrieval (GET /api/v1/challenges/next)
  3. NO answer leakage in the payload (recursive check)
  4. Wrong answer rejection (POST /api/v1/challenges/submit)
  5. Correct answer acceptance + attempt completion
  6. Multi-step challenge (question_count=2)
  7. Alarm dismissal only after a completed, user-owned attempt
  8. Dismissal with an incomplete attempt is rejected
  9. Challenge analytics reflect real attempt data
  10. Habit score still computes (M1 regression)

Run from backend/:  .venv\\Scripts\\python.exe scripts\\smoke_m2.py
"""

import os
import re
import sys
import tempfile

# Ensure backend/ is importable regardless of CWD
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)
_PROJECT_ROOT = os.path.dirname(_BACKEND)

# Chdir to a fresh temp dir so app.database's `load_dotenv(override=True)` points
# everything (app engine + Alembic) at an isolated <tmpdir>/cerebrokognit.db.
_tmpdir = tempfile.mkdtemp(prefix="cerebro_m2_")
os.chdir(_tmpdir)

os.environ["SECRET_KEY"] = "smoke_test_secret_key_that_is_long_enough"

# Step A: import the app FIRST so database.py resolves DATABASE_URL via dotenv.
from app.main import app  # noqa: E402
from app.database import DATABASE_URL as _resolved_url  # noqa: E402

# Step B: re-point Alembic at the SAME URL the app engine uses, then build the
# schema by running the full migration chain on the fresh database
# (Milestone 2 verification requirement #6).
os.environ["DATABASE_URL"] = _resolved_url

from alembic.config import Config as AlembicConfig  # noqa: E402
from alembic import command as alembic_command  # noqa: E402

_alembic_cfg = AlembicConfig(os.path.join(_PROJECT_ROOT, "alembic.ini"))
alembic_command.upgrade(_alembic_cfg, "head")
print("Alembic migrations applied on fresh DB.")

from fastapi.testclient import TestClient  # noqa: E402


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def has_key(node, key):
    """Recursively look for `key` in nested dicts/lists."""
    if isinstance(node, dict):
        if key in node:
            return True
        return any(has_key(v, key) for v in node.values())
    if isinstance(node, list):
        return any(has_key(v, key) for v in node)
    return False


def solve_math_prompt(prompt):
    """Parse a server-generated Math prompt "a + b" / "a - b" / "a x b"."""
    m = re.match(r"^(\d+)\s*([+\-x])\s*(\d+)$", prompt.strip())
    a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
    if op == "+":
        return str(a + b)
    if op == "-":
        return str(abs(a - b))
    return str(a * b)


def main():
    failures = []

    def check(label, cond, extra=""):
        mark = "PASS" if cond else "FAIL"
        print(f"[{mark}] {label} {extra}")
        if not cond:
            failures.append(label)

    c = TestClient(app)

    # --- 1. Health + auth ---
    r = c.get("/health")
    check("GET /health", r.status_code == 200, f"({r.status_code})")

    email = "m2@example.com"
    reg = c.post("/api/v1/auth/register", json={
        "email": email, "password": "password123",
        "full_name": "M2 User", "timezone": "Asia/Kolkata", "difficulty_preference": "Easy",
    })
    check("POST /auth/register", reg.status_code == 200, f"({reg.status_code})")
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    check("register returns access_token", bool(token))

    log = c.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    check("POST /auth/login", log.status_code == 200, f"({log.status_code})")

    # --- 2. Challenge retrieval (empty table => on-demand creation) ---
    nxt = c.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
        headers=headers,
    )
    check("GET /challenges/next", nxt.status_code == 200, f"({nxt.status_code})")
    ch = nxt.json()
    check("next returns challenge_attempt_id", bool(ch.get("challenge_attempt_id")))
    check("next returns title", bool(ch.get("title")))
    payload = ch["puzzle_payload"]
    check("payload has questions", isinstance(payload.get("questions"), list) and len(payload["questions"]) == 1)

    # --- 3. No answer leakage ---
    leaked = has_key(payload, "answer") or has_key(payload, "expected_answers") or has_key(payload, "expected")
    check("NO answer leakage in payload", not leaked)
    q0 = payload["questions"][0]
    check("question exposes prompt only", "prompt" in q0 and "answer" not in q0)

    # --- 4. Wrong answer rejection ---
    wrong = str(int(solve_math_prompt(q0["prompt"])) + 100)
    sub_bad = c.post("/api/v1/challenges/submit", headers=headers, json={
        "challenge_id": ch["id"],
        "challenge_attempt_id": ch["challenge_attempt_id"],
        "user_answer": wrong,
        "time_taken_seconds": 30,
    })
    check("POST /challenges/submit (wrong answer)", sub_bad.status_code == 200, f"({sub_bad.status_code})")
    check("wrong answer rejected", sub_bad.json()["correct"] is False and sub_bad.json()["completed"] is False,
          f"(correct={sub_bad.json()['correct']})")

    # --- 5. Correct answer acceptance (fresh attempt) ---
    nxt2 = c.get("/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1", headers=headers)
    ch2 = nxt2.json()
    q2 = ch2["puzzle_payload"]["questions"][0]
    right = solve_math_prompt(q2["prompt"])
    sub_ok = c.post("/api/v1/challenges/submit", headers=headers, json={
        "challenge_id": ch2["id"],
        "challenge_attempt_id": ch2["challenge_attempt_id"],
        "user_answer": right,
        "time_taken_seconds": 25,
    })
    check("POST /challenges/submit (correct answer)", sub_ok.status_code == 200, f"({sub_ok.status_code})")
    res_ok = sub_ok.json()
    check("correct answer accepted", res_ok["correct"] is True and res_ok["completed"] is True,
          f"(correct={res_ok['correct']}, completed={res_ok['completed']})")

    # --- 6. Multi-step challenge (question_count=2) ---
    nxt3 = c.get("/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=2", headers=headers)
    ch3 = nxt3.json()
    qs3 = ch3["puzzle_payload"]["questions"]
    check("multi-step count honored", ch3["puzzle_payload"]["total_questions"] == 2 and len(qs3) == 2,
          f"(total={ch3['puzzle_payload']['total_questions']})")
    answers3 = [solve_math_prompt(qo["prompt"]) for qo in qs3]
    sub_multi = c.post("/api/v1/challenges/submit", headers=headers, json={
        "challenge_id": ch3["id"],
        "challenge_attempt_id": ch3["challenge_attempt_id"],
        "user_answers": answers3,
        "time_taken_seconds": 40,
    })
    check("multi-step all-correct accepted", sub_multi.status_code == 200 and sub_multi.json()["completed"] is True,
          f"({sub_multi.status_code}, correct={sub_multi.json()['correct']})")

    # --- 7. Alarm creation + dismissal after completed attempt ---
    al = c.post("/api/v1/alarms", headers=headers, json={
        "title": "Wake up", "type": "One-Time", "time": "06:00",
        "challenge_type": "Math", "difficulty": "Easy", "question_count": 1,
    })
    check("POST /alarms (create)", al.status_code == 200, f"({al.status_code})")
    alarm_id = al.json()["id"]

    diss = c.post(f"/api/v1/alarms/{alarm_id}/dismiss", headers=headers, json={
        "challenge_attempt_id": res_ok["challenge_attempt_id"],
        "correct_answers": res_ok["correct_answers"],
        "total_questions": res_ok["total_questions"],
        "time_taken_seconds": 25,
    })
    check("dismiss with valid completed attempt", diss.status_code == 200 and diss.json()["successfully_dismissed"] is True,
          f"({diss.status_code})")

    # --- 8. Dismissal with incomplete attempt is rejected ---
    al2 = c.post("/api/v1/alarms", headers=headers, json={
        "title": "Wake up 2", "type": "One-Time", "time": "06:30",
        "challenge_type": "Math", "difficulty": "Easy",
    })
    alarm2_id = al2.json()["id"]
    # incomplete attempt: wrong answer on a fresh challenge
    nxt4 = c.get("/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1", headers=headers)
    ch4 = nxt4.json()
    q4 = ch4["puzzle_payload"]["questions"][0]
    wrong4 = str(int(solve_math_prompt(q4["prompt"])) + 1)
    c.post("/api/v1/challenges/submit", headers=headers, json={
        "challenge_id": ch4["id"],
        "challenge_attempt_id": ch4["challenge_attempt_id"],
        "user_answer": wrong4,
        "time_taken_seconds": 10,
    })
    diss_bad = c.post(f"/api/v1/alarms/{alarm2_id}/dismiss", headers=headers, json={
        "challenge_attempt_id": ch4["challenge_attempt_id"],
        "correct_answers": 0,
        "total_questions": 1,
        "time_taken_seconds": 10,
    })
    check("dismiss with incomplete attempt -> 400", diss_bad.status_code == 400, f"({diss_bad.status_code})")
    diss_other = c.post(f"/api/v1/alarms/{alarm2_id}/dismiss", headers=headers, json={
        "challenge_attempt_id": 999999,
        "correct_answers": 1,
        "total_questions": 1,
        "time_taken_seconds": 10,
    })
    check("dismiss with unknown attempt -> 404", diss_other.status_code == 404, f"({diss_other.status_code})")

    # --- 9. Challenge analytics reflect real data ---
    an = c.get("/api/v1/analytics/me", headers=headers)
    check("GET /analytics/me", an.status_code == 200, f"({an.status_code})")
    an_json = an.json()
    check("analytics challenge_accuracy > 0", an_json["challenge_accuracy"] > 0,
          f"({an_json['challenge_accuracy']})")
    by_type = an_json["recent_activity"].get("challenge_accuracy_by_type", {})
    math_stats = by_type.get("Math", {})
    check("analytics per-type Math breakdown", math_stats.get("attempts", 0) >= 1,
          f"(attempts={math_stats.get('attempts')})")
    check("analytics real dismissals", an_json["total_dismissals"] >= 1,
          f"({an_json['total_dismissals']})")

    # --- 10. Habit score still computes (M1 regression within M2 smoke) ---
    hs = c.get("/api/v1/habits/score", headers=headers)
    check("GET /habits/score", hs.status_code == 200 and "overall_score" in hs.json(), f"({hs.status_code})")

    print()
    print("=" * 60)
    if failures:
        print(f"SMOKE M2 RESULT: {len(failures)} FAILURE(S)")
        for f in failures:
            print("  -", f)
        raise SystemExit(1)
    print("SMOKE M2 RESULT: ALL PASS")

    try:
        os.unlink(os.path.join(_tmpdir, "cerebrokognit.db"))
    except OSError:
        pass


if __name__ == "__main__":
    main()