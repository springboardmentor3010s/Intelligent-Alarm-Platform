# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Phase 4: cognitive challenge & verification hardening.

Covers every challenge type/difficulty, answer secrecy (client responses never
contain expected answers), server-authoritative submit for correct/incorrect/
malformed/incomplete/repeated/expired/unauthorized/cross-user attempts, answer
normalization, and the one-attempt-per-dismiss replay gate. Also asserts the
offline sync route can never complete a server-authoritative attempt.
"""

import random
import re
from datetime import datetime, timedelta, timezone

import pytest

from app.Models import ChallengeAttempt
from app.services.challenge_service import ChallengeService
from conftest import TestingSession, has_key

TYPES = ChallengeService.CHALLENGE_TYPES
DIFFICULTIES = ChallengeService.DIFFICULTIES


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------

def _serve(client, headers, ctype="Math", difficulty="Easy", count=1):
    res = client.get(
        "/api/v1/challenges/next"
        f"?challenge_type={ctype}&difficulty={difficulty}&question_count={count}",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return res.json()


def _expected_answers(attempt_id):
    """Read the server-only expected answers straight from the persisted attempt."""
    session = TestingSession()
    try:
        attempt = session.query(ChallengeAttempt).filter(ChallengeAttempt.id == attempt_id).first()
        assert attempt is not None
        return list(attempt.expected_answers or [])
    finally:
        session.close()


def _attempt_row(attempt_id):
    session = TestingSession()
    try:
        return session.query(ChallengeAttempt).filter(ChallengeAttempt.id == attempt_id).first()
    finally:
        session.close()


def _submit(client, headers, challenge, answers, time_taken=12):
    return client.post("/api/v1/challenges/submit", headers=headers, json={
        "challenge_id": challenge["id"],
        "challenge_attempt_id": challenge["challenge_attempt_id"],
        "user_answers": answers,
        "time_taken_seconds": time_taken,
    })


# ------------------------------------------------------------------
# Coverage of the full type x difficulty matrix
# ------------------------------------------------------------------

def test_every_type_and_difficulty_is_served_and_verifiable(client, user_headers):
    """All 7 types x 5 difficulties produce a solvable, server-verifiable attempt."""
    for ctype in TYPES:
        for difficulty in DIFFICULTIES:
            challenge = _serve(client, user_headers, ctype=ctype, difficulty=difficulty, count=1)
            assert challenge["challenge_type"] == ctype
            assert challenge["difficulty"] == difficulty
            assert challenge["puzzle_payload"]["total_questions"] == 1

            answers = _expected_answers(challenge["challenge_attempt_id"])
            assert len(answers) == 1

            sub = _submit(client, user_headers, challenge, answers)
            assert sub.status_code == 200, sub.text
            assert sub.json()["completed"] is True
            assert sub.json()["correct_answers"] == 1


def test_next_payload_exposes_instructions_and_metadata(client, user_headers):
    """Each served challenge carries client-facing instructions/instructions meta."""
    for ctype in TYPES:
        challenge = _serve(client, user_headers, ctype=ctype, difficulty="Medium", count=1)
        payload = challenge["puzzle_payload"]
        assert payload["instructions"]
        assert payload["meta"]["challenge_type"] == ctype
        assert payload["meta"]["difficulty"] == "Medium"
        assert payload["timeout_seconds"] > 0
        assert payload["expires_at"]
        assert payload["expired"] is False


# ------------------------------------------------------------------
# Answer secrecy
# ------------------------------------------------------------------

def test_no_answer_key_leak_across_all_types_and_response_bodies(client, user_headers):
    """No client response may expose answer material as fields or nested keys."""
    for ctype in TYPES:
        challenge = _serve(client, user_headers, ctype=ctype, difficulty="Hard", count=2)
        payload = challenge["puzzle_payload"]

        for forbidden in ("expected_answers", "expected", "answer", "answer_meta", "correct"):
            assert not has_key(payload, forbidden), f"{ctype} leaked {forbidden}"

        # Each question is only ever id/prompt/type/options.
        for question in payload["questions"]:
            assert set(question.keys()) <= {"id", "prompt", "type", "options"}

        # The hidden correct answers must not appear verbatim in the served payload.
        expected = _expected_answers(challenge["challenge_attempt_id"])
        served = str(payload)
        if ctype in ("Word", "Riddle"):
            for answer in expected:
                if len(answer) >= 3:
                    assert not re.search(rf"\b{re.escape(answer.lower())}\b", served.lower())


def test_incorrect_submission_never_reveals_expected_answer(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Riddle", difficulty="Medium", count=1)
    expected = _expected_answers(challenge["challenge_attempt_id"])

    sub = _submit(client, user_headers, challenge, ["definitely-not-the-answer"])
    assert sub.status_code == 200
    body = sub.json()
    assert body["completed"] is False

    assert len(body["results"]) == 1
    result = body["results"][0]
    assert result["correct"] is False
    assert result["feedback"]
    expected_value = expected[0].lower()
    if len(expected_value) >= 3:
        assert not re.search(rf"\b{re.escape(expected_value)}\b", str(body).lower())


def test_correct_submission_returns_only_that_questions_explanation(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    expected = _expected_answers(challenge["challenge_attempt_id"])

    body = _submit(client, user_headers, challenge, expected).json()
    assert body["results"][0]["correct"] is True
    assert body["results"][0]["feedback"]


# ------------------------------------------------------------------
# Malformed / incomplete attempts
# ------------------------------------------------------------------

def test_multiple_questions_can_be_answered_at_once(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Hard", count=3)
    expected = _expected_answers(challenge["challenge_attempt_id"])
    assert len(expected) == 3

    body = _submit(client, user_headers, challenge, expected).json()
    assert body["completed"] is True
    assert body["correct_answers"] == 3
    assert len(body["results"]) == 3


def test_fewer_answers_than_questions_can_never_pass(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Hard", count=2)
    expected = _expected_answers(challenge["challenge_attempt_id"])

    body = _submit(client, user_headers, challenge, expected[:1]).json()
    assert body["completed"] is False
    assert body["correct_answers"] == 1
    assert len(body["results"]) == 2


def test_submit_without_any_answers_is_rejected(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    res = client.post("/api/v1/challenges/submit", headers=user_headers, json={
        "challenge_id": challenge["id"],
        "challenge_attempt_id": challenge["challenge_attempt_id"],
        "time_taken_seconds": 5,
    })
    assert res.status_code == 400


def test_submit_with_empty_answer_list_is_rejected(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    assert _submit(client, user_headers, challenge, []).status_code == 400


def test_submit_with_too_many_answers_is_rejected(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    assert _submit(client, user_headers, challenge, ["1", "2", "3"]).status_code == 400


def test_answer_count_mismatch_is_independent_of_expected_values(client, user_headers):
    """Malformed detection uses the stored attempt size, not user input length."""
    short = _serve(client, user_headers, ctype="Logic", difficulty="Easy", count=2)
    assert _submit(client, user_headers, short, ["0"]).status_code == 200

    exact = _serve(client, user_headers, ctype="Logic", difficulty="Easy", count=2)
    assert _submit(client, user_headers, exact, ["0", "1"]).status_code == 200


# ------------------------------------------------------------------
# Single-use + expiry
# ------------------------------------------------------------------

def test_attempt_cannot_be_submitted_twice(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    expected = _expected_answers(challenge["challenge_attempt_id"])

    assert _submit(client, user_headers, challenge, expected).status_code == 200
    replay = _submit(client, user_headers, challenge, expected)
    assert replay.status_code == 409


def test_expired_attempt_is_rejected(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    expected = _expected_answers(challenge["challenge_attempt_id"])

    session = TestingSession()
    try:
        attempt = session.query(ChallengeAttempt).filter(
            ChallengeAttempt.id == challenge["challenge_attempt_id"]
        ).first()
        attempt.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        session.add(attempt)
        session.commit()
    finally:
        session.close()

    res = _submit(client, user_headers, challenge, expected)
    assert res.status_code == 410


def test_unknown_attempt_returns_404(client, user_headers):
    res = client.post("/api/v1/challenges/submit", headers=user_headers, json={
        "challenge_id": 1,
        "challenge_attempt_id": 99999999,
        "user_answer": "1",
        "time_taken_seconds": 3,
    })
    assert res.status_code == 404


def test_submit_requires_authentication(client):
    res = client.post("/api/v1/challenges/submit", json={
        "challenge_id": 1,
        "challenge_attempt_id": 1,
        "user_answer": "1",
        "time_taken_seconds": 3,
    })
    assert res.status_code in (401, 403)


def test_cross_user_attempt_is_rejected(client, user_headers):
    """Another authenticated user can never submit or dismiss my attempt."""
    victim = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)

    attacker = client.post("/api/v1/auth/register", json={
        "email": "attacker-phase4@test.io",
        "password": "password123",
        "timezone": "UTC",
    })
    assert attacker.status_code == 200
    attacker_headers = {"Authorization": f"Bearer {attacker.json()['access_token']}"}

    res = _submit(client, attacker_headers, victim, ["0"])
    assert res.status_code == 404


# ------------------------------------------------------------------
# One solved attempt per dismissal
# ------------------------------------------------------------------

def test_completed_attempt_can_dismiss_only_one_alarm(client, user_headers, solved_math_attempt):
    res = solved_math_attempt

    def make_alarm(title):
        return client.post("/api/v1/alarms", headers=user_headers, json={
            "title": title, "type": "One-Time", "time": "06:00",
            "challenge_type": "Math", "difficulty": "Easy",
        }).json()

    first, second = make_alarm("Replay A"), make_alarm("Replay B")
    dismiss_body = {
        "challenge_attempt_id": res["challenge_attempt_id"],
        "correct_answers": res["correct_answers"],
        "total_questions": res["total_questions"],
        "time_taken_seconds": 25,
    }

    ok = client.post(f"/api/v1/alarms/{first['id']}/dismiss", headers=user_headers, json=dismiss_body)
    assert ok.status_code == 200
    assert ok.json()["successfully_dismissed"] is True

    replay = client.post(f"/api/v1/alarms/{second['id']}/dismiss", headers=user_headers, json=dismiss_body)
    assert replay.status_code == 409


# ------------------------------------------------------------------
# Answer normalization (unit level)
# ------------------------------------------------------------------

@pytest.mark.parametrize("expected,user,answer_type", [
    ("42", " 42 ", "numeric"),
    ("42", "42.0", "numeric"),
    ("1000", "1,000", "numeric"),
    ("-7", "\u2212 7", "numeric"),
    ("1 2 3 4", "1234", "sequence"),
    ("towel", "  Towel! ", "text"),
    ("even", "EVEN", "choice"),
])
def test_answers_match_accepts_equivalent_forms(expected, user, answer_type):
    assert ChallengeService.answers_match(expected, user, answer_type) is True


@pytest.mark.parametrize("expected,user,answer_type", [
    ("42", "43", "numeric"),
    ("42", "forty-two", "numeric"),
    ("1 2 3", "3 2 1", "sequence"),
    ("towel", "towers", "text"),
    ("yes", "no", "choice"),
])
def test_answers_match_rejects_different_answers(expected, user, answer_type):
    assert ChallengeService.answers_match(expected, user, answer_type) is False


def test_generators_are_deterministic_for_a_pinned_rng():
    """A pinned RNG makes the whole generation reproducible for tests."""
    for ctype in TYPES:
        first = ChallengeService.generate_question_set(ctype, 3, "Hard", random.Random(7))
        second = ChallengeService.generate_question_set(ctype, 3, "Hard", random.Random(7))
        assert first == second
        assert len(first[0]) == len(first[1]) == len(first[2]) == 3


def test_generated_answers_verify_against_their_own_prompts():
    """Server-generated expected answers always satisfy the comparison mode."""
    for ctype in TYPES:
        questions, answers, metas = ChallengeService.generate_question_set(
            ctype, 3, "Expert", random.Random(11)
        )
        for answer, meta in zip(answers, metas):
            assert answer != ""
            assert ChallengeService.answers_match(answer, answer, meta["answer_type"]) is True
        assert len(questions) == 3


# ------------------------------------------------------------------
# Offline sync cannot forge verification
# ------------------------------------------------------------------

def test_sync_cannot_flip_pending_attempt_to_completed(client, user_headers):
    challenge = _serve(client, user_headers, ctype="Math", difficulty="Easy", count=1)
    attempt_id = challenge["challenge_attempt_id"]

    res = client.post("/api/v1/sync/pending", headers=user_headers, json={
        "records": [{
            "table_name": "challenge_attempts",
            "record_id": attempt_id,
            "operation": "insert",
            "payload": {
                "server_id": attempt_id,
                "completed": True,
                "correct_answers": 1,
                "total_questions": 1,
                "time_taken_seconds": 1,
            },
            "local_timestamp": datetime.now(timezone.utc).isoformat(),
        }],
    })
    assert res.status_code == 200

    row = _attempt_row(attempt_id)
    assert row.completed is False
    assert row.end_time is None


def test_sync_cannot_create_a_fake_completed_attempt(client, user_headers):
    before = _attempt_row_count()

    res = client.post("/api/v1/sync/pending", headers=user_headers, json={
        "records": [{
            "table_name": "challenge_attempts",
            "record_id": 424242,
            "operation": "insert",
            "payload": {
                "challenge_id": 1,
                "completed": True,
                "correct_answers": 1,
                "total_questions": 1,
                "start_time": datetime.now(timezone.utc).isoformat(),
            },
            "local_timestamp": datetime.now(timezone.utc).isoformat(),
        }],
    })
    assert res.status_code == 200
    assert res.json()["failed_count"] >= 1
    assert res.json()["synced_count"] == 0
    assert _attempt_row_count() == before


def _attempt_row_count():
    session = TestingSession()
    try:
        return session.query(ChallengeAttempt).count()
    finally:
        session.close()
