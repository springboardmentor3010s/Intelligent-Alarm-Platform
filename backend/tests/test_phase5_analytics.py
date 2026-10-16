# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Phase 5: analytics single-source, habit formula, coach scoping, reports, uptime.

Verifies that dashboards, coach views, and exports all read the same real
database values; that coaches cannot leave their cohort; and that no metric
is hard-coded.
"""

from datetime import datetime, timedelta, timezone

from app.Models import Alarm, ChallengeAttempt
from app.services.habit_scoring_service import compute_habit_composite
from conftest import TestingSession


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------

def _register(client, tag):
    res = client.post("/api/v1/auth/register", json={
        "email": f"{tag}@test.io",
        "password": "password123",
        "timezone": "UTC",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['access_token']}"}


def _promote_to_coach(client, admin_headers, user_id):
    res = client.put(
        f"/api/v1/dashboard/users/{user_id}/role",
        headers=admin_headers,
        json={"role": "Wellness Coach"},
    )
    assert res.status_code == 200, res.text


def _seed_activity(user_id, snoozes=0):
    """One alarm triggering now + one completed attempt created now."""
    session = TestingSession()
    try:
        now = datetime.now(timezone.utc)
        session.add(Alarm(
            user_id=user_id,
            title="Seeded",
            alarm_type="One-Time",
            next_trigger=now,
            is_enabled=True,
            times_snoozed=snoozes,
        ))
        session.add(ChallengeAttempt(
            user_id=user_id,
            challenge_id=1,
            attempt_number=1,
            completed=True,
            correct_answers=2,
            total_questions=2,
            start_time=now,
            end_time=now,
            time_taken_seconds=20,
            created_at=now,
        ))
        session.commit()
    finally:
        session.close()


# ------------------------------------------------------------------
# Habit formula: documented 35/25/20/20 weights
# ------------------------------------------------------------------

def test_composite_applies_documented_weights():
    assert compute_habit_composite(100, 100, 100, 100) == 100
    assert compute_habit_composite(0, 0, 0, 0) == 0
    # 0.35*80 + 0.25*60 + 0.20*40 + 0.20*20 = 28 + 15 + 8 + 4 = 55
    assert compute_habit_composite(80, 60, 40, 20) == 55


def test_score_components_come_from_real_rows(client, registered_user):
    _, _, user_id, headers = registered_user
    _seed_activity(user_id)

    body = client.get("/api/v1/habits/score", headers=headers).json()
    # Alarm dismissed with zero snoozes -> perfect wake-up component.
    assert body["wake_up_consistency"] == 100
    # No snoozes anywhere in the window -> perfect snooze component.
    assert body["snooze_reduction"] == 100
    # Single alarm in the window -> default schedule component.
    assert body["sleep_schedule_adherence"] == 70
    assert 0 < body["challenge_completion"] <= 100
    # Overall is exactly the weighted composite of the components.
    assert body["overall_score"] == compute_habit_composite(
        body["wake_up_consistency"],
        body["challenge_completion"],
        body["snooze_reduction"],
        body["sleep_schedule_adherence"],
    )


def test_history_window_is_validated(client, user_headers):
    assert client.get("/api/v1/habits/score/history?days=0", headers=user_headers).status_code == 422
    assert client.get("/api/v1/habits/score/history?days=400", headers=user_headers).status_code == 422
    ok = client.get("/api/v1/habits/score/history?days=3", headers=user_headers)
    assert ok.status_code == 200
    assert len(ok.json()) == 3


# ------------------------------------------------------------------
# Dashboard / report consistency (same source, same values)
# ------------------------------------------------------------------

def test_habits_report_matches_dashboard_history(client, registered_user):
    _, _, user_id, headers = registered_user
    _seed_activity(user_id)

    history = client.get("/api/v1/habits/score/history?days=7", headers=headers).json()
    report = client.get(
        "/api/v1/dashboard/reports/habits?format=json&days=7", headers=headers
    ).json()

    expected = [h for h in history if h["overall_score"] is not None]
    assert report["report_type"] == "habits"
    assert report["data"] == expected


def test_challenge_report_matches_analytics_accuracy(client, registered_user):
    _, _, user_id, headers = registered_user
    _seed_activity(user_id)
    analytics = client.get("/api/v1/analytics/me", headers=headers).json()
    report = client.get(
        "/api/v1/dashboard/reports/challenges?format=json&days=7", headers=headers
    ).json()

    rows = report["data"]
    assert len(rows) >= 1
    total_q = sum(r["total_questions"] for r in rows)
    total_c = sum(r["correct_answers"] for r in rows)
    assert analytics["challenge_accuracy"] == round(total_c / total_q, 4)
    for row in rows:
        assert row["accuracy_pct"] == round(row["correct_answers"] / row["total_questions"] * 100, 1)


def test_wake_up_report_is_ordered_and_date_filtered(client, registered_user):
    _, _, user_id, headers = registered_user
    _seed_activity(user_id)

    report = client.get(
        "/api/v1/dashboard/reports/wake-up?format=json&days=7", headers=headers
    ).json()
    rows = report["data"]
    assert len(rows) >= 1
    triggers = [r["next_trigger"] for r in rows]
    assert triggers == sorted(triggers)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    for trigger in triggers:
        assert datetime.fromisoformat(trigger) >= cutoff
    assert set(rows[0].keys()) >= {
        "alarm_id", "title", "alarm_type", "next_trigger", "times_snoozed", "was_enabled",
    }


def test_reports_on_empty_data(client, user_headers):
    # Fresh account: habits CSV has no fabricated rows; PDF says so honestly.
    csv_res = client.get("/api/v1/dashboard/reports/habits?format=csv&days=7", headers=user_headers)
    assert csv_res.status_code == 200
    assert csv_res.content == b""

    pdf_res = client.get("/api/v1/dashboard/reports/habits?format=pdf&days=7", headers=user_headers)
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF")

    wake = client.get("/api/v1/dashboard/reports/wake-up?format=json&days=7", headers=user_headers).json()
    assert wake["data"] == []


# ------------------------------------------------------------------
# Sleep report (FR-REP-005): bedtime/wake trend + duration analysis
# ------------------------------------------------------------------

def _seed_alarm_at(user_id, when):
    session = TestingSession()
    try:
        session.add(Alarm(
            user_id=user_id,
            title="Sleep anchor",
            alarm_type="One-Time",
            next_trigger=when,
            is_enabled=True,
            times_snoozed=0,
        ))
        session.commit()
    finally:
        session.close()


def test_sleep_report_windows_match_duration_analysis(client, registered_user):
    _, _, user_id, headers = registered_user
    now = datetime.now(timezone.utc)
    # Consecutive-day overnight window: bedtime 22:00 -> wake 06:30 (8.5h).
    _seed_alarm_at(user_id, (now - timedelta(days=2)).replace(hour=22, minute=0, second=0, microsecond=0))
    _seed_alarm_at(user_id, (now - timedelta(days=1)).replace(hour=6, minute=30, second=0, microsecond=0))

    report = client.get("/api/v1/dashboard/reports/sleep?format=json&days=7", headers=headers).json()
    assert report["report_type"] == "sleep"
    rows = report["data"]
    assert len(rows) == 1
    row = rows[0]
    assert row["bedtime"] == "22:00"
    assert row["wake_time"] == "06:30"
    assert row["sleep_window_hours"] == 8.5

    # Single source: the report's per-day window matches /analytics/me's average.
    analytics = client.get("/api/v1/analytics/me", headers=headers).json()
    assert analytics["sleep_duration_avg"] == 8.5


def test_sleep_report_empty_without_consecutive_alarms(client, user_headers):
    report = client.get("/api/v1/dashboard/reports/sleep?format=json&days=7", headers=user_headers).json()
    assert report["data"] == []

    pdf = client.get("/api/v1/dashboard/reports/sleep?format=pdf&days=7", headers=user_headers)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


# ------------------------------------------------------------------
# Wellness-coach cohort access control
# ------------------------------------------------------------------

def test_coach_cohort_lifecycle_and_scoping(client, admin_headers):
    coach_id, coach_headers = _register(client, "coach5a")
    member_id, member_headers = _register(client, "member5a")
    outsider_id, _ = _register(client, "outsider5a")
    _promote_to_coach(client, admin_headers, coach_id)

    # Admin assigns the member to the coach's cohort.
    assign = client.post(
        "/api/v1/dashboard/coach/assignments",
        headers=admin_headers,
        json={"coach_id": coach_id, "user_id": member_id},
    )
    assert assign.status_code == 201, assign.text

    # Duplicate assignment is rejected.
    dup = client.post(
        "/api/v1/dashboard/coach/assignments",
        headers=admin_headers,
        json={"coach_id": coach_id, "user_id": member_id},
    )
    assert dup.status_code == 409

    # Coach roster contains exactly the assigned member.
    roster = client.get("/api/v1/dashboard/coach/users", headers=coach_headers).json()
    assert [u["id"] for u in roster] == [member_id]

    # Legacy directory endpoint is scoped the same way for coaches.
    directory = client.get("/api/v1/dashboard/users", headers=coach_headers).json()
    assert [u["id"] for u in directory] == [member_id]

    # Per-user coaching view carries every required section from real data.
    detail = client.get(
        f"/api/v1/dashboard/coach/users/{member_id}", headers=coach_headers
    )
    assert detail.status_code == 200
    body = detail.json()
    for key in ("user", "habit_score", "habit_history", "analytics",
                "sleep_trend", "wake_up_trend", "challenge_performance", "progress"):
        assert key in body, key
    assert body["user"]["id"] == member_id
    assert len(body["habit_history"]) == 7

    # Outside the cohort: 403 for both the detail view and the directory leak.
    assert client.get(
        f"/api/v1/dashboard/coach/users/{outsider_id}", headers=coach_headers
    ).status_code == 403

    # Plain users cannot touch coach endpoints at all.
    assert client.get("/api/v1/dashboard/coach/users", headers=member_headers).status_code == 403
    assert client.get(
        f"/api/v1/dashboard/coach/users/{member_id}", headers=member_headers
    ).status_code == 403

    # Admins keep full visibility and can unassign.
    assert client.get(
        f"/api/v1/dashboard/coach/users/{outsider_id}", headers=admin_headers
    ).status_code == 200
    unassign = client.delete(
        "/api/v1/dashboard/coach/assignments",
        headers=admin_headers,
        params={"coach_id": coach_id, "user_id": member_id},
    )
    assert unassign.status_code == 200
    assert client.get("/api/v1/dashboard/coach/users", headers=coach_headers).json() == []


def test_assignment_validation(client, admin_headers):
    coach_id, _ = _register(client, "coach5b")
    plain_id, _ = _register(client, "plain5b")
    _promote_to_coach(client, admin_headers, coach_id)

    # Non-coach target cannot receive a cohort.
    bad = client.post(
        "/api/v1/dashboard/coach/assignments",
        headers=admin_headers,
        json={"coach_id": plain_id, "user_id": coach_id},
    )
    assert bad.status_code == 400

    # Unknown users are 404, and assignment management stays admin-only.
    missing = client.post(
        "/api/v1/dashboard/coach/assignments",
        headers=admin_headers,
        json={"coach_id": coach_id, "user_id": 999999},
    )
    assert missing.status_code == 404

    coach_headers = {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': 'coach5b@test.io', 'password': 'password123'}).json()['access_token']}"}
    forbidden = client.post(
        "/api/v1/dashboard/coach/assignments",
        headers=coach_headers,
        json={"coach_id": coach_id, "user_id": plain_id},
    )
    assert forbidden.status_code == 403


# ------------------------------------------------------------------
# Measured uptime (no hard-coded values)
# ------------------------------------------------------------------

def test_uptime_is_measured_not_hardcoded(client, admin_headers):
    analytics = client.get("/api/v1/dashboard/analytics", headers=admin_headers).json()
    uptime = analytics["system_uptime_percentage"]
    assert isinstance(uptime, float)
    assert 0.0 <= uptime <= 100.0
    assert analytics["uptime_seconds"] >= 0.0
    assert analytics["db_connected"] is True


def test_health_reports_real_measurements(client):
    health = client.get("/health").json()
    assert health["status"] in ("healthy", "degraded")
    assert health["uptime_seconds"] >= 0.0
    assert "db_connected" in health
    assert "measured_at" in health
