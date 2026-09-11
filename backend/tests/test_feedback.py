"""Feedback submission tests (POST /api/v1/feedback)."""

from app.Models import Feedback
from app.services.feedback_service import FeedbackService


def test_feedback_requires_auth(client):
    res = client.post(
        "/api/v1/feedback",
        json={"category": "suggestion", "message": "Love the app"},
    )
    assert res.status_code == 401, res.text


def test_submit_feedback_creates_record(client, user_headers, db):
    res = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={
            "category": "suggestion",
            "rating": 5,
            "message": "Love the wake-up drills.",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["category"] == "suggestion"
    assert body["rating"] == 5
    assert body["message"] == "Love the wake-up drills."
    assert body["status"] == "new"
    assert body["id"] > 0

    row = db.query(Feedback).filter(Feedback.id == body["id"]).first()
    assert row is not None
    assert row.user_id == body["user_id"]
    assert row.status == "new"


def test_submit_feedback_defaults_contact_email_to_user(client, user_headers):
    res = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={"category": "bug_report", "message": "Alarm sounds late."},
    )
    assert res.status_code == 200, res.text
    assert res.json()["contact_email"] is not None


def test_submit_feedback_allows_explicit_contact_email(client, user_headers):
    res = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={
            "category": "compliment",
            "message": "Great onboarding.",
            "contact_email": "extra@test.io",
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["contact_email"] == "extra@test.io"


def test_submit_feedback_rejects_empty_message(client, user_headers):
    res = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={"category": "other", "message": "   "},
    )
    assert res.status_code == 422, res.text


def test_submit_feedback_rejects_bad_category(client, user_headers):
    res = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={"category": "rant", "message": "Hello"},
    )
    assert res.status_code == 422, res.text


def test_submit_feedback_rejects_rating_out_of_range(client, user_headers):
    res = client.post(
        "/api/v1/feedback",
        headers=user_headers,
        json={"category": "suggestion", "rating": 6, "message": "Hello"},
    )
    assert res.status_code == 422, res.text


def test_admin_list_returns_newest_first(db, client, user_headers):
    for text in ["first", "second"]:
        res = client.post(
            "/api/v1/feedback",
            headers=user_headers,
            json={"category": "suggestion", "message": text},
        )
        assert res.status_code == 200

    rows = FeedbackService.list_admin(db)
    assert len(rows) == 2
    assert rows[0].message == "second"
    assert rows[1].message == "first"
