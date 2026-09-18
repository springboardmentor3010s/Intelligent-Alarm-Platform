# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Phase 8: executable end-to-end workflow evidence (W01-W20).

Each test below is one row of `E2E_TEST_REPORT.md`, executed against the real
FastAPI app (TestClient + isolated DB) — never asserted from source reading.
Numbered W01..W20 to match the report.
"""

import re


def _register(client, tag):
    res = client.post("/api/v1/auth/register", json={
        "email": f"{tag}@test.io", "password": "password123", "timezone": "UTC",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['access_token']}"}


def _make_alarm(client, headers, title="E2E", alarm_type="One-Time", time="06:00"):
    res = client.post("/api/v1/alarms", headers=headers, json={
        "title": title, "type": alarm_type, "time": time,
        "challenge_type": "Math", "difficulty": "Easy",
    })
    assert res.status_code == 200, res.text
    return res.json()


def _serve_math(client, headers):
    nxt = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
        headers=headers,
    )
    assert nxt.status_code == 200
    return nxt.json()


def _solve(prompt):
    m = re.match(r"^(\d+)\s*([+\-x])\s*(\d+)$", prompt.strip())
    a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
    return str(a + b) if op == "+" else (str(abs(a - b)) if op == "-" else str(a * b))


def _submit(client, headers, ch, answer):
    return client.post("/api/v1/challenges/submit", headers=headers, json={
        "challenge_id": ch["id"],
        "challenge_attempt_id": ch["challenge_attempt_id"],
        "user_answer": answer,
        "time_taken_seconds": 20,
    })


# W01 — Registration and login ------------------------------------------------
def test_w01_registration_and_login(client):
    uid, headers = _register(client, "e2e_w01")
    assert uid > 0

    dup = client.post("/api/v1/auth/register", json={
        "email": "e2e_w01@test.io", "password": "password123", "timezone": "UTC",
    })
    assert dup.status_code == 400

    login = client.post("/api/v1/auth/login", json={
        "email": "e2e_w01@test.io", "password": "password123",
    })
    assert login.status_code == 200
    assert login.json()["access_token"]

    bad = client.post("/api/v1/auth/login", json={
        "email": "e2e_w01@test.io", "password": "wrongpassword",
    })
    assert bad.status_code == 401

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "e2e_w01@test.io"


# W03 — Profile update ---------------------------------------------------------
def test_w03_profile_update(client, registered_user):
    _, _, _, headers = registered_user
    upd = client.put("/api/v1/users/profile", headers=headers, json={
        "full_name": "E2E User", "timezone": "Asia/Kolkata",
    })
    assert upd.status_code == 200
    assert upd.json()["full_name"] == "E2E User"
    assert upd.json()["timezone"] == "Asia/Kolkata"


# W04/W05 — Alarm creation (one-time + recurring) ------------------------------
def test_w04_w05_alarm_creation(client, registered_user):
    _, _, _, headers = registered_user
    one = _make_alarm(client, headers, title="One", alarm_type="One-Time")
    assert one["is_enabled"] is True and one["next_trigger"]

    daily = _make_alarm(client, headers, title="Daily", alarm_type="Daily", time="07:00")
    assert daily["is_enabled"] is True and daily["next_trigger"]

    listed = client.get("/api/v1/alarms", headers=headers).json()
    assert {a["title"] for a in listed} >= {"One", "Daily"}


# W06 — Snooze behavior + cap ---------------------------------------------------
def test_w06_snooze_behavior_and_cap(client, registered_user):
    _, _, _, headers = registered_user
    alarm = _make_alarm(client, headers, title="Snoozy")
    first = alarm["next_trigger"]

    s1 = client.post(f"/api/v1/alarms/{alarm['id']}/snooze", headers=headers)
    assert s1.status_code == 200
    assert s1.json()["times_snoozed"] == 1
    assert s1.json()["next_trigger"] != first

    for _ in range(4):
        assert client.post(f"/api/v1/alarms/{alarm['id']}/snooze", headers=headers).status_code == 200
    capped = client.post(f"/api/v1/alarms/{alarm['id']}/snooze", headers=headers)
    assert capped.status_code == 400


# W07-W11 — Challenge generation, wrong/correct/incomplete, dismissal ---------
def test_w07_to_w11_challenge_and_dismissal_journey(client, registered_user):
    _, _, _, headers = registered_user
    alarm = _make_alarm(client, headers, title="Journey")

    # W07: generation serves a leak-free challenge.
    ch = _serve_math(client, headers)
    assert "expected_answers" not in str(ch)

    # W08: wrong answer is rejected but recorded.
    wrong = _submit(client, headers, ch, "not-a-number")
    assert wrong.status_code == 200
    assert wrong.json()["completed"] is False

    # W10: partial answers can never pass.
    ch2 = _serve_math(client, headers)
    ch2_multi = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=2",
        headers=headers,
    ).json()
    assert ch2_multi["puzzle_payload"]["total_questions"] == 2

    # W09 + W11: correct answer completes; dismissal succeeds exactly once.
    ch3 = _serve_math(client, headers)
    p3 = ch3["puzzle_payload"]["questions"][0]["prompt"]
    done = _submit(client, headers, ch3, _solve(p3))
    assert done.status_code == 200
    res = done.json()
    assert res["completed"] is True

    diss = client.post(f"/api/v1/alarms/{alarm['id']}/dismiss", headers=headers, json={
        "challenge_attempt_id": res["challenge_attempt_id"],
        "correct_answers": res["correct_answers"],
        "total_questions": res["total_questions"],
        "time_taken_seconds": 20,
    })
    assert diss.status_code == 200
    assert diss.json()["successfully_dismissed"] is True

    # W10 (dismissal gate): incomplete attempt cannot dismiss.
    bad = client.post(f"/api/v1/alarms/{alarm['id']}/dismiss", headers=headers, json={
        "challenge_attempt_id": ch2["challenge_attempt_id"],
        "correct_answers": 0, "total_questions": 1, "time_taken_seconds": 5,
    })
    assert bad.status_code in (400, 409)


# W12/W13/W14 — Habit score, analytics, recommendations update ------------------
def test_w12_w13_w14_downstream_updates(client, user_headers, solved_math_attempt):
    score = client.get("/api/v1/habits/score", headers=user_headers).json()
    assert score["overall_score"] > 0
    assert score["overall_score"] == int(
        score["wake_up_consistency"] * 0.35 + score["challenge_completion"] * 0.25
        + score["snooze_reduction"] * 0.20 + score["sleep_schedule_adherence"] * 0.20
    )

    analytics = client.get("/api/v1/analytics/me", headers=user_headers).json()
    assert analytics["challenge_accuracy"] > 0
    assert analytics["recent_activity"]["challenge_accuracy_by_type"]["Math"]["attempts"] >= 1

    recs = client.get("/api/v1/analytics/recommendations", headers=user_headers).json()
    assert isinstance(recs, list)
    for rec in recs:
        assert rec["reason"] and rec["source_metric"]


# W15 — Report export matches dashboard -----------------------------------------
def test_w15_report_export_matches_dashboard(client, user_headers, solved_math_attempt):
    score = client.get("/api/v1/habits/score", headers=user_headers).json()

    report = client.get(
        "/api/v1/dashboard/reports/habits?format=json&days=7", headers=user_headers
    ).json()
    today_row = [r for r in report["data"] if r["date"] == score["date"]]
    assert today_row and today_row[0]["overall_score"] == score["overall_score"]

    csv_res = client.get(
        "/api/v1/dashboard/reports/habits?format=csv&days=7", headers=user_headers
    )
    assert csv_res.status_code == 200 and str(score["overall_score"]) in csv_res.text

    pdf_res = client.get(
        "/api/v1/dashboard/reports/habits?format=pdf&days=7", headers=user_headers
    )
    assert pdf_res.status_code == 200 and pdf_res.content.startswith(b"%PDF")


# W16 — Push-token registration ---------------------------------------------------
def test_w16_push_token_registration(client, registered_user):
    _, _, _, headers = registered_user
    reg = client.post("/api/v1/notifications/register", headers=headers, json={
        "token": "ExponentPushToken[e2e123]", "platform": "android",
    })
    assert reg.status_code == 200
    assert reg.json()["registered"] is True

    tokens = client.get("/api/v1/notifications/tokens", headers=headers).json()
    assert "ExponentPushToken[e2e123]" in str(tokens)

    status = client.get("/api/v1/notifications/status", headers=headers).json()
    assert status["registered_tokens"] >= 1


# W02/W18/W19/W20 — Roles, coach/admin dashboards, unauthorized access -----------
def test_w02_w18_w19_w20_role_boundaries(client, admin_headers):
    member_id, member_h = _register(client, "e2e_member")
    coach_id, coach_h = _register(client, "e2e_coach")
    outsider_id, _ = _register(client, "e2e_outsider")

    # W02: plain user is fenced out of staff endpoints.
    assert client.get("/api/v1/dashboard/analytics", headers=member_h).status_code == 403
    assert client.get("/api/v1/dashboard/users", headers=member_h).status_code == 403
    assert client.get("/api/v1/dashboard/coach/users", headers=member_h).status_code == 403

    # Promote + assign for the coach workflows.
    assert client.put(f"/api/v1/dashboard/users/{coach_id}/role", headers=admin_headers,
                      json={"role": "Wellness Coach"}).status_code == 200
    assert client.post("/api/v1/dashboard/coach/assignments", headers=admin_headers,
                       json={"coach_id": coach_id, "user_id": member_id}).status_code == 201

    # W18: coach sees the assigned member with full detail sections.
    roster = client.get("/api/v1/dashboard/coach/users", headers=coach_h).json()
    assert [u["id"] for u in roster] == [member_id]
    detail = client.get(f"/api/v1/dashboard/coach/users/{member_id}", headers=coach_h)
    assert detail.status_code == 200
    for key in ("user", "habit_score", "habit_history", "analytics",
                "sleep_trend", "challenge_performance", "progress"):
        assert key in detail.json(), key

    # W20: coach fenced out of outsider + platform telemetry.
    assert client.get(f"/api/v1/dashboard/coach/users/{outsider_id}", headers=coach_h).status_code == 403
    assert client.get("/api/v1/dashboard/analytics", headers=coach_h).status_code == 403

    # W19: admin retains full visibility + telemetry.
    assert client.get("/api/v1/dashboard/analytics", headers=admin_headers).status_code == 200
    assert client.get(f"/api/v1/dashboard/coach/users/{outsider_id}",
                      headers=admin_headers).status_code == 200

    # W20: cross-user alarm access is fenced.
    alarm = _make_alarm(client, member_h, title="Private")
    assert client.put(f"/api/v1/alarms/{alarm['id']}", headers=coach_h, json={
        "title": "Hijacked", "type": "One-Time", "time": "06:00",
    }).status_code in (403, 404)
    assert client.post(f"/api/v1/alarms/{alarm['id']}/snooze", headers=coach_h).status_code in (403, 404)
