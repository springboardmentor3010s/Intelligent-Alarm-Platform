"""Challenge engine: no answer leak, server-authoritative submit, dismiss gates."""

from conftest import has_key, solve_math_prompt


def test_next_serves_challenge_without_leaking_answers(client, user_headers):
    nxt = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
        headers=user_headers,
    )
    assert nxt.status_code == 200
    ch = nxt.json()
    assert ch["challenge_attempt_id"]
    assert not has_key(ch["puzzle_payload"], "answer")
    assert not has_key(ch["puzzle_payload"], "expected_answers")
    assert not has_key(ch["puzzle_payload"], "expected")
    prompt = ch["puzzle_payload"]["questions"][0]["prompt"]
    assert "answer" not in prompt


def test_wrong_answer_is_rejected(client, user_headers):
    nxt = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
        headers=user_headers,
    ).json()
    prompt = nxt["puzzle_payload"]["questions"][0]["prompt"]
    wrong = str(int(solve_math_prompt(prompt)) + 12345)
    sub = client.post("/api/v1/challenges/submit", headers=user_headers, json={
        "challenge_id": nxt["id"],
        "challenge_attempt_id": nxt["challenge_attempt_id"],
        "user_answer": wrong,
        "time_taken_seconds": 30,
    })
    assert sub.status_code == 200
    assert sub.json()["correct"] is False
    assert sub.json()["completed"] is False


def test_multi_step_challenge_count(client, user_headers):
    nxt = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=2",
        headers=user_headers,
    ).json()
    qs = nxt["puzzle_payload"]["questions"]
    assert nxt["puzzle_payload"]["total_questions"] == 2
    assert len(qs) == 2
    answers = [solve_math_prompt(q["prompt"]) for q in qs]
    sub = client.post("/api/v1/challenges/submit", headers=user_headers, json={
        "challenge_id": nxt["id"],
        "challenge_attempt_id": nxt["challenge_attempt_id"],
        "user_answers": answers,
        "time_taken_seconds": 40,
    })
    assert sub.status_code == 200
    assert sub.json()["completed"] is True


def test_dismiss_full_flow_after_completed_attempt(client, user_headers, solved_math_attempt):
    alarm = client.post("/api/v1/alarms", headers=user_headers, json={
        "title": "Wake", "type": "One-Time", "time": "06:00",
        "challenge_type": "Math", "difficulty": "Easy",
    }).json()
    res = solved_math_attempt
    diss = client.post(f"/api/v1/alarms/{alarm['id']}/dismiss", headers=user_headers, json={
        "challenge_attempt_id": res["challenge_attempt_id"],
        "correct_answers": res["correct_answers"],
        "total_questions": res["total_questions"],
        "time_taken_seconds": 25,
    })
    assert diss.status_code == 200
    assert diss.json()["successfully_dismissed"] is True


def test_dismiss_rejects_incomplete_and_unknown_attempts(client, user_headers):
    alarm = client.post("/api/v1/alarms", headers=user_headers, json={
        "title": "Wake2", "type": "One-Time", "time": "06:30",
        "challenge_type": "Math", "difficulty": "Easy",
    }).json()

    # incomplete attempt (wrong answer)
    nxt = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
        headers=user_headers,
    ).json()
    q = nxt["puzzle_payload"]["questions"][0]
    wrong = str(int(solve_math_prompt(q["prompt"])) + 1)
    client.post("/api/v1/challenges/submit", headers=user_headers, json={
        "challenge_id": nxt["id"],
        "challenge_attempt_id": nxt["challenge_attempt_id"],
        "user_answer": wrong,
        "time_taken_seconds": 10,
    })
    bad = client.post(f"/api/v1/alarms/{alarm['id']}/dismiss", headers=user_headers, json={
        "challenge_attempt_id": nxt["challenge_attempt_id"],
        "correct_answers": 0, "total_questions": 1, "time_taken_seconds": 10,
    })
    assert bad.status_code == 400

    # unknown attempt
    unknown = client.post(f"/api/v1/alarms/{alarm['id']}/dismiss", headers=user_headers, json={
        "challenge_attempt_id": 9999999,
        "correct_answers": 1, "total_questions": 1, "time_taken_seconds": 10,
    })
    assert unknown.status_code == 404
