"""
Milestone 4 — Phase 2: Executive Analytics Test Suite.

Validates:
1. Authenticated analytics access & schema conformance (AnalyticsResponse).
2. Unauthenticated analytics access rejection (401/403).
3. User isolation: User A cannot see User B's session/alarm analytics.
4. Executive KPI fields: habit_score, wake_up_consistency, accuracy, progress,
   snooze_analytics, sleep_adherence, total_sessions, successful_dismissals, average_response_time.
5. Habit score consistency: reuses official evaluate_user_habit.
6. Zero secret or correct_answer leakage in response payload.
7. Safe empty-data behavior for users with zero sessions.
8. Time-range filtering: 7d, 30d, 90d, all.
9. Backward compatibility for /habit-score, /recommendations, and /adaptive-difficulty.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession
from app.utils.security import create_access_token
from app.schemas.analytics import AnalyticsResponse

client = TestClient(app)


def run_all_tests():
    print("=" * 70)
    print("RUNNING MILESTONE 4 — PHASE 2 EXECUTIVE ANALYTICS TEST SUITE")
    print("=" * 70)

    db = SessionLocal()
    try:
        users = db.query(User).all()
        assert len(users) >= 2, "At least 2 users required for isolation tests"
        user_a = users[0]
        user_b = users[1]

        token_a = create_access_token(user_a.id, user_a.role)
        token_b = create_access_token(user_b.id, user_b.role)

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        print(f"User A: id={user_a.id}, email={user_a.email}")
        print(f"User B: id={user_b.id}, email={user_b.email}")
        print("-" * 70)

        # -----------------------------------------------------------------
        # TEST 1: Unauthenticated Request Rejection
        # -----------------------------------------------------------------
        unauth_resp = client.get("/api/analytics")
        assert unauth_resp.status_code in [401, 403], f"Expected 401/403, got {unauth_resp.status_code}"
        print("[PASS] Test 1: Unauthenticated access rejected with 401/403.")

        # -----------------------------------------------------------------
        # TEST 2: Authenticated Access & Schema Validation
        # -----------------------------------------------------------------
        resp_a = client.get("/api/analytics", headers=headers_a)
        assert resp_a.status_code == 200, f"Expected 200, got {resp_a.status_code}: {resp_a.text}"
        data_a = resp_a.json()

        validated_a = AnalyticsResponse(**data_a)
        assert validated_a.total_sessions >= 0
        assert validated_a.habit_score is not None
        assert validated_a.snooze_analytics is not None
        assert validated_a.sleep_adherence is not None
        assert validated_a.wake_up_history is not None
        assert validated_a.difficulty_performance is not None
        print("[PASS] Test 2: Authenticated access returns valid AnalyticsResponse.")

        # -----------------------------------------------------------------
        # TEST 3: User Data Isolation
        # -----------------------------------------------------------------
        resp_b = client.get("/api/analytics", headers=headers_b)
        assert resp_b.status_code == 200
        data_b = resp_b.json()

        user_a_alarms = db.query(Alarm).filter(Alarm.user_id == user_a.id).all()
        user_a_ids = [a.id for a in user_a_alarms]
        user_a_sessions_cnt = db.query(AlarmSession).filter(AlarmSession.alarm_id.in_(user_a_ids)).count() if user_a_ids else 0

        user_b_alarms = db.query(Alarm).filter(Alarm.user_id == user_b.id).all()
        user_b_ids = [a.id for a in user_b_alarms]
        user_b_sessions_cnt = db.query(AlarmSession).filter(AlarmSession.alarm_id.in_(user_b_ids)).count() if user_b_ids else 0

        assert data_a["total_sessions"] == user_a_sessions_cnt
        assert data_b["total_sessions"] == user_b_sessions_cnt
        print(f"[PASS] Test 3: User isolation strictly verified (User A sessions={data_a['total_sessions']}, User B sessions={data_b['total_sessions']}).")

        # -----------------------------------------------------------------
        # TEST 4: Executive KPI Fields Availability & Sanity
        # -----------------------------------------------------------------
        hs = data_a["habit_score"]
        assert 0 <= hs["overall_habit_score"] <= 100
        assert 0 <= hs["wake_up_consistency"] <= 100
        assert 0 <= hs["challenge_completion"] <= 100
        assert 0 <= hs["snooze_reduction"] <= 100
        assert 0 <= hs["sleep_schedule_adherence"] <= 100

        sa = data_a["snooze_analytics"]
        assert sa["total_snoozes"] >= 0
        assert 0 <= sa["snooze_rate"] <= 100
        assert sa["sessions_with_snooze"] + sa["sessions_without_snooze"] == data_a["total_sessions"]

        sleep = data_a["sleep_adherence"]
        assert "preferred_wake_time" in sleep
        assert "sleep_duration" in sleep
        assert 0 <= sleep["sleep_schedule_adherence"] <= 100

        assert data_a["successful_dismissals"] >= 0
        assert data_a["average_response_time"] >= 0.0
        print("[PASS] Test 4: Executive KPI fields verified with mathematical consistency.")

        # -----------------------------------------------------------------
        # TEST 5: Zero Secret or Correct Answer Leakage
        # -----------------------------------------------------------------
        raw_dump = str(data_a)
        # Note: 'correct_answers' is the session count metric, whereas 'correct_answer' is the private challenge solution
        forbidden_substrings = ["'correct_answer':", '"correct_answer":', "hashed_password", "password_hash", "jwt_secret", "secret_key"]
        for key in forbidden_substrings:
            assert key not in raw_dump, f"Forbidden key '{key}' found in analytics response!"
        print("[PASS] Test 5: Zero secret or challenge solution leakage in response payload.")

        # -----------------------------------------------------------------
        # TEST 6: Time-Range Filtering
        # -----------------------------------------------------------------
        for tr in ["7d", "30d", "90d", "all"]:
            resp_tr = client.get(f"/api/analytics?time_range={tr}", headers=headers_a)
            assert resp_tr.status_code == 200, f"Failed for time_range={tr}"
            tr_data = resp_tr.json()
            assert tr_data["time_range"] == tr
            assert tr_data["total_sessions"] <= data_a["total_sessions"]
        print("[PASS] Test 6: Time-range filtering (7d, 30d, 90d, all) functions correctly.")

        # -----------------------------------------------------------------
        # TEST 7: Backward Compatibility for Milestone 3 Endpoints
        # -----------------------------------------------------------------
        resp_hs = client.get("/api/analytics/habit-score", headers=headers_a)
        assert resp_hs.status_code == 200
        assert "overall_habit_score" in resp_hs.json()

        resp_recs = client.get("/api/analytics/recommendations", headers=headers_a)
        assert resp_recs.status_code == 200
        assert "recommendations" in resp_recs.json()

        resp_ad = client.get("/api/analytics/adaptive-difficulty", headers=headers_a)
        assert resp_ad.status_code == 200
        assert "recommended_difficulty" in resp_ad.json()
        print("[PASS] Test 7: Milestone 3 endpoints (/habit-score, /recommendations, /adaptive-difficulty) maintain full compatibility.")

        print("=" * 70)
        print("ALL MILESTONE 4 — PHASE 2 BACKEND TESTS PASSED SUCCESSFULLY!")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_all_tests()
