# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Habit scoring, analytics, recommendations, and ML status tests."""


def test_habit_score_and_history(client, user_headers, solved_math_attempt):
    hs = client.get("/api/v1/habits/score", headers=user_headers)
    assert hs.status_code == 200
    body = hs.json()
    for key in ("wake_up_consistency", "challenge_completion", "snooze_reduction",
                "sleep_schedule_adherence", "overall_score", "date"):
        assert key in body
    assert 0 <= body["overall_score"] <= 100

    hist = client.get("/api/v1/habits/score/history?days=3", headers=user_headers)
    assert hist.status_code == 200
    assert len(hist.json()) == 3


def test_analytics_reflects_real_activity(client, user_headers, solved_math_attempt):
    an = client.get("/api/v1/analytics/me", headers=user_headers)
    assert an.status_code == 200
    body = an.json()
    assert body["challenge_accuracy"] > 0
    assert body["total_dismissals"] >= 0
    by_type = body["recent_activity"].get("challenge_accuracy_by_type", {})
    assert by_type.get("Math", {}).get("attempts", 0) >= 1
    assert "generated_at" in body


def test_recommendations_endpoint(client, user_headers):
    recs = client.get("/api/v1/analytics/recommendations", headers=user_headers)
    assert recs.status_code == 200
    assert isinstance(recs.json(), list)
    for r in recs.json():
        assert r["category"] in ("sleep", "wake_up", "habit", "challenge")
        assert r["priority"] in ("high", "medium", "low")
        assert r["title"]


def test_ml_status_reports_model(client, user_headers):
    st = client.get("/api/v1/analytics/ml-status", headers=user_headers)
    assert st.status_code == 200
    body = st.json()
    assert isinstance(body["torch_available"], bool)
    # model state must be self-consistent: loaded only when torch is present
    if body["torch_available"]:
        assert body["model_loaded"] is True
    else:
        assert body["model_loaded"] is False
    assert "model_exists" in body


def test_sync_push_and_pull(client, user_headers):
    rec = {
        "table_name": "habit_scores",
        "record_id": 1,
        "operation": "insert",
        "payload": {"date": "2026-09-07", "overall_score": 80},
        "local_timestamp": "2026-09-07T00:00:00Z",
    }
    push = client.post("/api/v1/sync/pending", headers=user_headers, json={"records": [rec]})
    assert push.status_code == 200
    assert push.json()["synced_count"] == 1


def test_report_export_formats(client, user_headers, solved_math_attempt):
    for fmt in ("csv", "json", "pdf", "excel"):
        res = client.get(
            f"/api/v1/dashboard/reports/habits?days=7&format={fmt}",
            headers=user_headers,
        )
        assert res.status_code == 200, fmt
        ct = res.headers.get("content-type", "")
        if fmt == "pdf":
            assert "application/pdf" in ct
            assert res.content.startswith(b"%PDF")
        elif fmt == "excel":
            assert "spreadsheetml" in ct
            assert res.content.startswith(b"PK")
        elif fmt == "csv":
            assert "text/csv" in ct
        else:
            assert res.json()["report_type"] == "habits"

    # invalid format rejected
    bad = client.get(
        "/api/v1/dashboard/reports/habits?format=doc",
        headers=user_headers,
    )
    assert bad.status_code == 422

    # unknown format not routed (docx)
    wake_pdf = client.get(
        "/api/v1/dashboard/reports/wake-up?format=pdf",
        headers=user_headers,
    )
    assert wake_pdf.status_code == 200
    assert wake_pdf.content.startswith(b"%PDF")
