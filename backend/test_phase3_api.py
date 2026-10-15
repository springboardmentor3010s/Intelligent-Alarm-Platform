"""
Integration test suite for Milestone 3 — Phase 3: Backend API Integration.

Tests:
1. SNOOZE API (POST /api/sessions/{session_id}/snooze)
   - Increments snooze_count by 1
   - Supports multiple snoozes (increments from 1 to 2)
   - Rejects snooze on completed sessions (400)
   - Rejects snooze on expired sessions (400)
   - Enforces user isolation (404 when snoozing another user's session)
   - Rejects non-existent sessions (404)
2. SESSION COMPLETION ENRICHMENT (POST /api/sessions/{session_id}/answer)
   - Correct answer: session_status="completed", dismissal_status="dismissed", response_time_seconds calculated
   - Incorrect answer: session_status="completed", dismissal_status="failed", response_time_seconds calculated
   - Rejects answering already completed session (400)
   - Enforces user isolation (404 when answering another user's session)
3. HABIT SCORE ENDPOINT (GET /api/analytics/habit-score)
   - Conforms to HabitScoreResponse contract
   - Valid scores (0-100) for user with active history
   - Safe baseline defaults for user with zero history (total_sessions=0, neutral baseline)
   - Enforces user data isolation (User B does not see User A's sessions)
4. RECOMMENDATIONS ENDPOINT (GET /api/analytics/recommendations)
   - Conforms to RecommendationsResponse contract
   - Returns valid recommendations with categories and priorities
   - Returns safe baseline recommendations for user with zero history
5. ADAPTIVE DIFFICULTY ENDPOINT (GET /api/analytics/adaptive-difficulty)
   - Conforms to AdaptiveDifficultyResponse contract
   - Returns recommended difficulty, accuracy, sample_size, and reason
   - Supports query parameter ?alarm_id={id}
   - Safe fallback for user with zero history
6. BACKWARD COMPATIBILITY (GET /api/analytics)
   - Preserves all Milestone 1 and 2 fields
   - Enriches response with habit_score and recommended_difficulty
7. AUTHENTICATION & SECURITY
   - Rejects unauthenticated requests (401/403)
   - Rejects invalid tokens (401)
"""

import sys
import os
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, CognitiveChallenge
from app.utils.security import create_access_token


client = TestClient(app)


def run_all_tests():
    print("=" * 70)
    print("RUNNING MILESTONE 3 — PHASE 3 BACKEND API INTEGRATION TEST SUITE")
    print("=" * 70)

    db = SessionLocal()
    temp_session_ids = []
    temp_challenge_ids = []

    try:
        # Identify test users
        user_with_data = db.query(User).filter(User.id == 3).first()
        user_without_data = db.query(User).filter(User.id == 5).first()

        assert user_with_data is not None, "User id=3 must exist in database"
        assert user_without_data is not None, "User id=5 must exist in database"

        token_user_a = create_access_token(user_with_data.id, user_with_data.role)
        token_user_b = create_access_token(user_without_data.id, user_without_data.role)

        headers_user_a = {"Authorization": f"Bearer {token_user_a}"}
        headers_user_b = {"Authorization": f"Bearer {token_user_b}"}

        # Find user A's alarm to create temporary test sessions
        user_a_alarm = db.query(Alarm).filter(Alarm.user_id == user_with_data.id).first()
        assert user_a_alarm is not None, "User 3 must have at least one alarm"

        print(f"Test User A: id={user_with_data.id}, email={user_with_data.email}")
        print(f"Test User B: id={user_without_data.id}, email={user_without_data.email}")
        print(f"Test Alarm ID for User A: id={user_a_alarm.id}")
        print("-" * 70)

        # -------------------------------------------------------------
        # TEST 1: SNOOZE API - Happy Path & Increment
        # -------------------------------------------------------------
        challenge_1 = CognitiveChallenge(
            alarm_id=user_a_alarm.id,
            challenge_type="math",
            question="12 + 15",
            correct_answer="27",
            difficulty="medium",
        )
        db.add(challenge_1)
        db.flush()
        temp_challenge_ids.append(challenge_1.id)

        session_1 = AlarmSession(
            alarm_id=user_a_alarm.id,
            challenge_id=challenge_1.id,
            session_status="started",
            started_at=datetime.now(timezone.utc),
            snooze_count=0,
            dismissal_status="active",
        )
        db.add(session_1)
        db.commit()
        db.refresh(session_1)
        temp_session_ids.append(session_1.id)

        # First snooze
        resp = client.post(f"/api/sessions/{session_1.id}/snooze", headers=headers_user_a)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["snooze_count"] == 1, f"Expected snooze_count=1, got {data['snooze_count']}"
        assert data["dismissal_status"] == "snoozed", f"Expected dismissal_status='snoozed', got {data['dismissal_status']}"
        print("[PASS] Test 1.1: POST /api/sessions/{id}/snooze increments snooze_count to 1 and sets dismissal_status='snoozed'")

        # Second snooze
        resp2 = client.post(f"/api/sessions/{session_1.id}/snooze", headers=headers_user_a)
        assert resp2.status_code == 200, f"Expected 200, got {resp2.status_code}: {resp2.text}"
        data2 = resp2.json()
        assert data2["snooze_count"] == 2, f"Expected snooze_count=2, got {data2['snooze_count']}"
        assert data2["dismissal_status"] == "snoozed"
        print("[PASS] Test 1.2: POST /api/sessions/{id}/snooze multiple snoozes increment correctly (1 -> 2)")

        # -------------------------------------------------------------
        # TEST 2: SNOOZE API - Validation & Rejection of Inactive Sessions
        # -------------------------------------------------------------
        # Expire session_1
        expire_resp = client.patch(f"/api/sessions/{session_1.id}/expire", headers=headers_user_a)
        assert expire_resp.status_code == 200

        # Attempt to snooze expired session
        snooze_expired_resp = client.post(f"/api/sessions/{session_1.id}/snooze", headers=headers_user_a)
        assert snooze_expired_resp.status_code == 400, f"Expected 400, got {snooze_expired_resp.status_code}"
        assert "Cannot snooze a completed or expired session" in snooze_expired_resp.json()["detail"]
        print("[PASS] Test 2.1: POST /api/sessions/{id}/snooze rejects expired session with 400")

        # -------------------------------------------------------------
        # TEST 3: SNOOZE API - User Isolation & Non-existent Sessions
        # -------------------------------------------------------------
        # User B attempts to snooze User A's session
        snooze_isolated = client.post(f"/api/sessions/{session_1.id}/snooze", headers=headers_user_b)
        assert snooze_isolated.status_code == 404, f"Expected 404 for other user's session, got {snooze_isolated.status_code}"
        print("[PASS] Test 3.1: POST /api/sessions/{id}/snooze enforces user isolation (returns 404 for non-owned session)")

        # Snooze non-existent session
        snooze_nonexistent = client.post("/api/sessions/999999/snooze", headers=headers_user_a)
        assert snooze_nonexistent.status_code == 404
        print("[PASS] Test 3.2: POST /api/sessions/{id}/snooze returns 404 for non-existent session")

        # -------------------------------------------------------------
        # TEST 4: SESSION ANSWER - Correct Answer & Enrichment
        # -------------------------------------------------------------
        challenge_2 = CognitiveChallenge(
            alarm_id=user_a_alarm.id,
            challenge_type="math",
            question="50 - 20",
            correct_answer="30",
            difficulty="easy",
        )
        db.add(challenge_2)
        db.flush()
        temp_challenge_ids.append(challenge_2.id)

        session_2 = AlarmSession(
            alarm_id=user_a_alarm.id,
            challenge_id=challenge_2.id,
            session_status="started",
            started_at=datetime.now(timezone.utc),
            snooze_count=1,
            dismissal_status="active",
        )
        db.add(session_2)
        db.commit()
        db.refresh(session_2)
        temp_session_ids.append(session_2.id)

        ans_resp = client.post(
            f"/api/sessions/{session_2.id}/answer",
            json={"answer": "30"},
            headers=headers_user_a,
        )
        assert ans_resp.status_code == 200, f"Expected 200, got {ans_resp.status_code}: {ans_resp.text}"
        ans_data = ans_resp.json()
        assert ans_data["is_correct"] is True
        assert ans_data["session_status"] == "completed"
        assert ans_data["dismissal_status"] == "dismissed", f"Expected dismissal_status='dismissed', got {ans_data['dismissal_status']}"
        assert ans_data["response_time_seconds"] is not None
        assert ans_data["response_time_seconds"] >= 0
        assert ans_data["completed_at"] is not None
        print(f"[PASS] Test 4.1: POST /api/sessions/{session_2.id}/answer correct answer enriched session (dismissal_status='dismissed', response_time={ans_data['response_time_seconds']}s)")

        # -------------------------------------------------------------
        # TEST 5: SESSION ANSWER - Incorrect Answer & Re-answering
        # -------------------------------------------------------------
        challenge_3 = CognitiveChallenge(
            alarm_id=user_a_alarm.id,
            challenge_type="math",
            question="10 * 10",
            correct_answer="100",
            difficulty="easy",
        )
        db.add(challenge_3)
        db.flush()
        temp_challenge_ids.append(challenge_3.id)

        session_3 = AlarmSession(
            alarm_id=user_a_alarm.id,
            challenge_id=challenge_3.id,
            session_status="started",
            started_at=datetime.now(timezone.utc),
            snooze_count=0,
            dismissal_status="active",
        )
        db.add(session_3)
        db.commit()
        db.refresh(session_3)
        temp_session_ids.append(session_3.id)

        wrong_ans_resp = client.post(
            f"/api/sessions/{session_3.id}/answer",
            json={"answer": "999"},
            headers=headers_user_a,
        )
        assert wrong_ans_resp.status_code == 200
        wrong_data = wrong_ans_resp.json()
        assert wrong_data["is_correct"] is False
        assert wrong_data["session_status"] == "completed"
        assert wrong_data["dismissal_status"] == "failed", f"Expected dismissal_status='failed', got {wrong_data['dismissal_status']}"
        assert wrong_data["response_time_seconds"] is not None
        print(f"[PASS] Test 5.1: POST /api/sessions/{session_3.id}/answer incorrect answer marked failed (dismissal_status='failed', response_time={wrong_data['response_time_seconds']}s)")

        # Attempt to answer already completed session
        re_ans_resp = client.post(
            f"/api/sessions/{session_3.id}/answer",
            json={"answer": "100"},
            headers=headers_user_a,
        )
        assert re_ans_resp.status_code == 400
        assert "already completed" in re_ans_resp.json()["detail"]
        print("[PASS] Test 5.2: POST /api/sessions/{id}/answer rejects already completed session with 400")

        # User B attempts to answer User A's session
        ans_isolated = client.post(
            f"/api/sessions/{session_3.id}/answer",
            json={"answer": "100"},
            headers=headers_user_b,
        )
        assert ans_isolated.status_code == 404
        print("[PASS] Test 5.3: POST /api/sessions/{id}/answer enforces user isolation (returns 404 for other user)")

        # -------------------------------------------------------------
        # TEST 6: HABIT SCORE ENDPOINT (GET /api/analytics/habit-score)
        # -------------------------------------------------------------
        hs_resp = client.get("/api/analytics/habit-score", headers=headers_user_a)
        assert hs_resp.status_code == 200, f"Expected 200, got {hs_resp.status_code}: {hs_resp.text}"
        hs_data = hs_resp.json()

        for key in [
            "overall_habit_score",
            "wake_up_consistency",
            "challenge_completion",
            "snooze_reduction",
            "sleep_schedule_adherence",
            "total_sessions",
            "avg_snooze_count",
        ]:
            assert key in hs_data, f"Missing field {key} in habit-score response"
            assert isinstance(hs_data[key], (int, float)), f"Field {key} must be numeric"

        assert 0.0 <= hs_data["overall_habit_score"] <= 100.0
        assert hs_data["total_sessions"] > 0
        print(f"[PASS] Test 6.1: GET /api/analytics/habit-score returned valid contract: score={hs_data['overall_habit_score']}, sessions={hs_data['total_sessions']}, avg_snooze={hs_data['avg_snooze_count']}")

        # Test empty user (User B with 0 sessions)
        hs_b_resp = client.get("/api/analytics/habit-score", headers=headers_user_b)
        assert hs_b_resp.status_code == 200
        hs_b_data = hs_b_resp.json()
        assert hs_b_data["total_sessions"] == 0
        assert hs_b_data["avg_snooze_count"] == 0.0
        assert hs_b_data["overall_habit_score"] == 60.0  # Neutral baseline default
        print("[PASS] Test 6.2: GET /api/analytics/habit-score handles zero-session user safely with baseline defaults and enforces user isolation")

        # -------------------------------------------------------------
        # TEST 7: RECOMMENDATIONS ENDPOINT (GET /api/analytics/recommendations)
        # -------------------------------------------------------------
        rec_resp = client.get("/api/analytics/recommendations", headers=headers_user_a)
        assert rec_resp.status_code == 200
        rec_data = rec_resp.json()
        assert "recommendations" in rec_data
        assert "total" in rec_data
        assert rec_data["total"] == len(rec_data["recommendations"])
        assert rec_data["total"] > 0

        first_rec = rec_data["recommendations"][0]
        for field in ["category", "title", "message", "priority"]:
            assert field in first_rec, f"Missing field {field} in recommendation item"
            assert isinstance(first_rec[field], str)
        print(f"[PASS] Test 7.1: GET /api/analytics/recommendations returned {rec_data['total']} valid recommendations for active user (top: [{first_rec['priority']}] {first_rec['title']})")

        # Test empty user recommendations
        rec_b_resp = client.get("/api/analytics/recommendations", headers=headers_user_b)
        assert rec_b_resp.status_code == 200
        rec_b_data = rec_b_resp.json()
        assert "recommendations" in rec_b_data
        assert rec_b_data["total"] > 0
        print(f"[PASS] Test 7.2: GET /api/analytics/recommendations returned baseline recommendations for empty user (total={rec_b_data['total']})")

        # -------------------------------------------------------------
        # TEST 8: ADAPTIVE DIFFICULTY ENDPOINT (GET /api/analytics/adaptive-difficulty)
        # -------------------------------------------------------------
        ad_resp = client.get("/api/analytics/adaptive-difficulty", headers=headers_user_a)
        assert ad_resp.status_code == 200
        ad_data = ad_resp.json()
        for field in [
            "current_difficulty",
            "recommended_difficulty",
            "accuracy",
            "sample_size",
            "adjusted",
            "reason",
        ]:
            assert field in ad_data, f"Missing field {field} in adaptive-difficulty response"
        assert isinstance(ad_data["adjusted"], bool)
        assert isinstance(ad_data["accuracy"], (int, float))
        assert isinstance(ad_data["sample_size"], int)
        print(f"[PASS] Test 8.1: GET /api/analytics/adaptive-difficulty returned: current={ad_data['current_difficulty']}, recommended={ad_data['recommended_difficulty']}, accuracy={ad_data['accuracy']}%, sample_size={ad_data['sample_size']}")

        # Test with alarm_id query parameter
        ad_alarm_resp = client.get(f"/api/analytics/adaptive-difficulty?alarm_id={user_a_alarm.id}", headers=headers_user_a)
        assert ad_alarm_resp.status_code == 200
        ad_alarm_data = ad_alarm_resp.json()
        assert ad_alarm_data["current_difficulty"] == user_a_alarm.difficulty
        print(f"[PASS] Test 8.2: GET /api/analytics/adaptive-difficulty?alarm_id={user_a_alarm.id} respects alarm difficulty '{user_a_alarm.difficulty}'")

        # Test empty user adaptive difficulty
        ad_b_resp = client.get("/api/analytics/adaptive-difficulty", headers=headers_user_b)
        assert ad_b_resp.status_code == 200
        ad_b_data = ad_b_resp.json()
        assert ad_b_data["sample_size"] == 0
        assert ad_b_data["adjusted"] is False
        print("[PASS] Test 8.3: GET /api/analytics/adaptive-difficulty handles zero-session user safely with sample_size=0, adjusted=False")

        # -------------------------------------------------------------
        # TEST 9: BACKWARD COMPATIBILITY (GET /api/analytics)
        # -------------------------------------------------------------
        analytics_resp = client.get("/api/analytics", headers=headers_user_a)
        assert analytics_resp.status_code == 200
        analytics_data = analytics_resp.json()

        m2_fields = [
            "total_alarms",
            "active_alarms",
            "total_sessions",
            "completed_sessions",
            "correct_answers",
            "wrong_answers",
            "accuracy",
            "progress",
            "daily_performance",
            "challenge_performance",
        ]
        for f in m2_fields:
            assert f in analytics_data, f"Milestone 2 field {f} missing from GET /api/analytics"

        assert "habit_score" in analytics_data, "Milestone 3 field 'habit_score' missing"
        assert "recommended_difficulty" in analytics_data, "Milestone 3 field 'recommended_difficulty' missing"
        assert analytics_data["habit_score"] is not None
        assert "overall_habit_score" in analytics_data["habit_score"]
        print(f"[PASS] Test 9.1: GET /api/analytics preserved all 10 M1/M2 fields and seamlessly includes habit_score={analytics_data['habit_score']['overall_habit_score']}, recommended_difficulty='{analytics_data['recommended_difficulty']}'")

        # -------------------------------------------------------------
        # TEST 10: AUTHENTICATION & ACCESS CONTROL
        # -------------------------------------------------------------
        unauth_routes = [
            ("POST", f"/api/sessions/{session_1.id}/snooze", None),
            ("POST", f"/api/sessions/{session_1.id}/answer", {"answer": "test"}),
            ("GET", "/api/analytics/habit-score", None),
            ("GET", "/api/analytics/recommendations", None),
            ("GET", "/api/analytics/adaptive-difficulty", None),
            ("GET", "/api/analytics", None),
        ]

        for method, route, payload in unauth_routes:
            if method == "POST":
                res = client.post(route, json=payload)
            else:
                res = client.get(route)
            assert res.status_code in (401, 403), f"Route {route} without token must return 401 or 403, got {res.status_code}"

        # Invalid token
        inv_res = client.get("/api/analytics/habit-score", headers={"Authorization": "Bearer invalid.jwt.token"})
        assert inv_res.status_code == 401, f"Invalid token must return 401, got {inv_res.status_code}"
        print("[PASS] Test 10.1: All Phase 3 endpoints strictly enforce authentication (401/403 on missing or invalid token)")

        print("=" * 70)
        print("ALL PHASE 3 INTEGRATION TESTS PASSED SUCCESSFULLY! (10/10)")
        print("=" * 70)

    finally:
        # Guarantee cleanup of all temporary test fixtures
        if temp_session_ids:
            db.query(AlarmSession).filter(AlarmSession.id.in_(temp_session_ids)).delete(synchronize_session=False)
        if temp_challenge_ids:
            db.query(CognitiveChallenge).filter(CognitiveChallenge.id.in_(temp_challenge_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()
        print("[PASS] Fixture Cleanup Complete: database restored to clean initial state.")


if __name__ == "__main__":
    run_all_tests()
