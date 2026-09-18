# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Phase 7 Part B: manual productivity tracking is user-entered, gated, honest.

Covers log upsert + validation, owner isolation, history/trend/correlation
gates, correlation math, and real-data-only report exports.
"""

from datetime import datetime, timedelta, timezone

from app.Models import HabitScore
from conftest import TestingSession


def _log(client, headers, score, date=None, note=None):
    body = {"score": score}
    if date is not None:
        body["date"] = date
    if note is not None:
        body["note"] = note
    return client.post("/api/v1/productivity/log", headers=headers, json=body)


def _seed_scores(user_id, values):
    session = TestingSession()
    try:
        today = datetime.now(timezone.utc).date()
        for i, (wake, overall) in enumerate(values):
            target = (today - timedelta(days=len(values) - 1 - i)).strftime("%Y-%m-%d")
            session.add(HabitScore(
                user_id=user_id, date=target, wake_up_consistency=wake,
                challenge_completion=overall, snooze_reduction=overall,
                sleep_schedule_adherence=overall, overall_score=overall,
            ))
        session.commit()
    finally:
        session.close()


def _log_dates(user_id, scores):
    session = TestingSession()
    try:
        from app.Models import ProductivityLog

        today = datetime.now(timezone.utc).date()
        for i, score in enumerate(scores):
            target = (today - timedelta(days=len(scores) - 1 - i)).strftime("%Y-%m-%d")
            session.add(ProductivityLog(user_id=user_id, date=target, score=score,
                                        source="user-entered"))
        session.commit()
    finally:
        session.close()


# ------------------------------------------------------------------
# Logging: upsert, validation, single-day read
# ------------------------------------------------------------------

def test_log_creates_and_upserts_same_day(client, registered_user):
    _, _, _, headers = registered_user
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    first = _log(client, headers, 70, note="ok day")
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["date"] == today and body["score"] == 70
    assert body["source"] == "user-entered"

    second = _log(client, headers, 85, note="better evening")
    assert second.status_code == 201
    assert second.json()["score"] == 85
    assert second.json()["id"] == body["id"]

    day = client.get(f"/api/v1/productivity/log?date={today}", headers=headers)
    assert day.status_code == 200
    assert day.json()["score"] == 85


def test_log_rejects_bad_input(client, registered_user):
    _, _, _, headers = registered_user
    assert _log(client, headers, 101).status_code == 422
    assert _log(client, headers, -1).status_code == 422
    assert _log(client, headers, 50, date="not-a-date").status_code == 422
    future = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d")
    assert _log(client, headers, 50, date=future).status_code == 422


def test_single_day_read_404_when_never_logged(client, registered_user):
    _, _, _, headers = registered_user
    assert client.get("/api/v1/productivity/log?date=2020-01-01", headers=headers).status_code == 404


def test_history_validated_ordered_and_owner_scoped(client, registered_user):
    _, _, user_id, headers = registered_user
    today = datetime.now(timezone.utc)
    _log(client, headers, 60, date=(today - timedelta(days=2)).strftime("%Y-%m-%d"))
    _log(client, headers, 80)

    assert client.get("/api/v1/productivity/history?days=0", headers=headers).status_code == 422
    assert client.get("/api/v1/productivity/history?days=400", headers=headers).status_code == 422

    hist = client.get("/api/v1/productivity/history?days=7", headers=headers).json()
    assert [h["score"] for h in hist] == [80, 60]
    assert all(h["source"] == "user-entered" for h in hist)

    # Another user sees none of these rows.
    other = client.post("/api/v1/auth/register", json={
        "email": "prodiso@test.io", "password": "password123", "timezone": "UTC",
    }).json()
    other_h = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get("/api/v1/productivity/history?days=7", headers=other_h).json() == []


# ------------------------------------------------------------------
# Trend + correlation gates and math
# ------------------------------------------------------------------

def test_trend_needs_two_logs(client, registered_user):
    _, _, _, headers = registered_user
    empty = client.get("/api/v1/productivity/trend", headers=headers).json()
    assert empty["available"] is False

    _log(client, headers, 40)
    rising = client.get("/api/v1/productivity/trend", headers=headers)
    # Only one distinct logged day -> still unavailable.
    assert rising.json()["available"] is False


def test_trend_direction(client, registered_user):
    _, _, user_id, headers = registered_user
    _log_dates(user_id, [30, 40, 50, 60, 70])
    trend = client.get("/api/v1/productivity/trend", headers=headers).json()
    assert trend["available"] is True
    assert trend["trend"] == "improving"
    assert trend["source"] == "user-entered"
    assert len(trend["entries"]) == 5


def test_correlation_gates_and_math(client, registered_user):
    _, _, user_id, headers = registered_user

    assert client.get("/api/v1/productivity/correlation", headers=headers).json()["available"] is False

    # Logs without habit scores: paired 0 -> unavailable with count.
    _log_dates(user_id, [50, 60, 70, 80])
    thin = client.get("/api/v1/productivity/correlation", headers=headers).json()
    assert thin["available"] is False
    assert thin["paired_days"] == 0

    # Perfectly aligned wake/productivity -> r == 1.0, strong positive.
    _seed_scores(user_id, [(20, 50), (40, 55), (60, 60), (80, 65)])
    rich = client.get("/api/v1/productivity/correlation", headers=headers).json()
    assert rich["available"] is True
    assert rich["paired_days"] == 4
    assert rich["correlation"] == 1.0
    assert rich["strength"] == "strong"
    assert rich["direction"] == "positive"
    assert rich["source"] == "inferred"
    assert "Association only" in rich["message"]


# ------------------------------------------------------------------
# Reports: real data only
# ------------------------------------------------------------------

def test_productivity_report_matches_history(client, registered_user):
    _, _, user_id, headers = registered_user
    _log_dates(user_id, [55, 75])

    report = client.get(
        "/api/v1/dashboard/reports/productivity?format=json&days=7", headers=headers
    ).json()
    history = client.get("/api/v1/productivity/history?days=7", headers=headers).json()
    assert report["report_type"] == "productivity"
    assert [(r["date"], r["productivity_score"]) for r in report["data"]] == [
        (h["date"], h["score"]) for h in history
    ]

    csv_res = client.get(
        "/api/v1/dashboard/reports/productivity?format=csv&days=7", headers=headers
    )
    assert csv_res.status_code == 200
    assert csv_res.text.splitlines()[0] == "date,productivity_score,note,source"


def test_productivity_report_empty_is_honest(client, registered_user):
    _, _, _, headers = registered_user
    assert client.get(
        "/api/v1/dashboard/reports/productivity?format=json&days=7", headers=headers
    ).json()["data"] == []
    empty_csv = client.get(
        "/api/v1/dashboard/reports/productivity?format=csv&days=7", headers=headers
    )
    assert empty_csv.status_code == 200
    assert empty_csv.content == b""
    for fmt, marker in (("pdf", b"%PDF"), ("excel", b"PK")):
        res = client.get(
            f"/api/v1/dashboard/reports/productivity?format={fmt}&days=7", headers=headers
        )
        assert res.status_code == 200
        assert res.content.startswith(marker)
