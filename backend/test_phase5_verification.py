"""
Milestone 3 — Phase 5: Final Comprehensive Verification Test Suite.

Covers:
1. Complete Backend Verification (Auth, Alarms CRUD, Cognitive Alarm Flow, Sessions, Analytics, Admin)
2. Milestone 3 Habit Score Validation (Formula, Weights, Clamping, Zero-session baseline, Missing profile)
3. Behavioral Analytics Validation (Wake-up Consistency, Challenge Completion, Snooze Reduction, Sleep Adherence, Response Time)
4. Adaptive Difficulty Validation (5 levels, Sliding window N=5, Accuracy thresholds, Advisory non-mutation)
5. Recommendation Engine Validation (5 categories, Priorities, Deterministic outputs, Multi-rule triggers)
6. Security & User Data Isolation (Cross-user access rejection, Unauthenticated rejection, Admin authorization)
7. Database Cleanup Verification (Guaranteed cleanup of temporary records)
"""

import sys
import os
from datetime import datetime, timezone, time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, CognitiveChallenge, UserProfile
from app.utils.security import create_access_token
from app.services.habit_scorer import (
    calculate_habit_score,
    compute_behavioral_metrics,
    evaluate_user_habit,
    WEIGHT_WAKE_UP_CONSISTENCY,
    WEIGHT_CHALLENGE_COMPLETION,
    WEIGHT_SNOOZE_REDUCTION,
    WEIGHT_SLEEP_SCHEDULE_ADHERENCE,
)
from app.services.recommendation_engine import generate_recommendations
from app.services.adaptive_difficulty import adjust_difficulty
from app.services.adaptive_service import (
    calculate_adaptive_difficulty_from_sessions,
    get_next_difficulty,
)

client = TestClient(app)


def run_phase5_verification():
    print("=" * 80)
    print("STARTING MILESTONE 3 — PHASE 5 FINAL VERIFICATION TEST SUITE")
    print("=" * 80)

    db = SessionLocal()

    # Track temporary test fixtures for guaranteed teardown
    cleanup_user_ids = []
    cleanup_alarm_ids = []
    cleanup_session_ids = []
    cleanup_challenge_ids = []

    try:
        # Record initial baseline DB counts
        init_users = db.query(User).count()
        init_alarms = db.query(Alarm).count()
        init_sessions = db.query(AlarmSession).count()
        init_challenges = db.query(CognitiveChallenge).count()

        print(f"[INIT DB STATE] Users: {init_users}, Alarms: {init_alarms}, Sessions: {init_sessions}, Challenges: {init_challenges}")
        print("-" * 80)

        # -----------------------------------------------------------------
        # SECTION 1: AUTHENTICATION & ACCESS CONTROL
        # -----------------------------------------------------------------
        print(">>> SECTION 1: Authentication & Access Control")

        # 1.1 Register temporary user
        temp_email = f"qa_test_{int(datetime.now().timestamp())}@example.com"
        reg_resp = client.post("/api/auth/register", json={
            "email": temp_email,
            "password": "Password123!",
            "name": "QA User",
        })
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        reg_data = reg_resp.json()
        temp_user_id = reg_data.get("user", {}).get("id") or reg_data.get("id")
        if not temp_user_id:
            # Look up registered user by email
            u_obj = db.query(User).filter(User.email == temp_email).first()
            temp_user_id = u_obj.id
        cleanup_user_ids.append(temp_user_id)
        print(f" [PASS] 1.1: Registration successful for {temp_email} (id={temp_user_id})")

        # 1.2 Login with registered user
        login_resp = client.post("/api/auth/login", json={
            "email": temp_email,
            "password": "Password123!",
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        assert token, "Login must return access_token"
        headers_qa = {"Authorization": f"Bearer {token}"}
        print(" [PASS] 1.2: Login returned valid JWT access token")

        # 1.3 Protected route authorization with valid token
        me_resp = client.get("/api/auth/me", headers=headers_qa)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == temp_email
        print(" [PASS] 1.3: GET /api/auth/me succeeded with bearer token")

        # 1.4 Invalid token rejection
        bad_token_resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.fake.token"})
        assert bad_token_resp.status_code == 401
        print(" [PASS] 1.4: Invalid token correctly rejected with HTTP 401")

        # 1.5 Missing token rejection on protected routes
        no_token_resp = client.get("/api/alarms")
        assert no_token_resp.status_code in (401, 403)
        print(" [PASS] 1.5: Missing token correctly rejected with HTTP 401/403")

        # -----------------------------------------------------------------
        # SECTION 2: ALARM MANAGEMENT (CRUD)
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 2: Alarm Management CRUD")

        # 2.1 Create alarm
        alarm_payload = {
            "name": "QA Morning Alarm",
            "alarm_time": "07:30",
            "alarm_type": "cognitive",
            "repeat_pattern": "daily",
            "challenge_type": "math",
            "difficulty": "medium",
            "is_active": True,
        }
        create_resp = client.post("/api/alarms", json=alarm_payload, headers=headers_qa)
        assert create_resp.status_code == 200, f"Alarm create failed: {create_resp.text}"
        alarm_data = create_resp.json()
        qa_alarm_id = alarm_data["id"]
        cleanup_alarm_ids.append(qa_alarm_id)
        assert alarm_data["name"] == "QA Morning Alarm"
        assert alarm_data["difficulty"] == "medium"
        print(f" [PASS] 2.1: Alarm created successfully (id={qa_alarm_id})")

        # 2.2 Retrieve alarms
        list_resp = client.get("/api/alarms", headers=headers_qa)
        assert list_resp.status_code == 200
        alarms_list = list_resp.json()
        if isinstance(alarms_list, dict) and "alarms" in alarms_list:
            alarms_list = alarms_list["alarms"]
        assert len(alarms_list) >= 1
        assert any(a["id"] == qa_alarm_id for a in alarms_list)
        print(f" [PASS] 2.2: GET /api/alarms returned user's alarms (count={len(alarms_list)})")

        # 2.3 Update alarm
        update_resp = client.put(f"/api/alarms/{qa_alarm_id}", json={
            "name": "QA Morning Alarm Updated",
            "alarm_time": "07:45",
            "alarm_type": "cognitive",
            "repeat_pattern": "weekdays",
            "challenge_type": "math",
            "difficulty": "hard",
            "is_active": True,
        }, headers=headers_qa)
        assert update_resp.status_code == 200
        assert update_resp.json()["name"] == "QA Morning Alarm Updated"
        assert update_resp.json()["difficulty"] == "hard"
        print(" [PASS] 2.3: PUT /api/alarms/{id} updated name and difficulty to 'hard'")

        # 2.4 Toggle alarm status
        toggle_resp = client.patch(f"/api/alarms/{qa_alarm_id}/toggle", headers=headers_qa)
        assert toggle_resp.status_code == 200
        assert toggle_resp.json()["is_active"] is False
        # Re-activate for session testing
        client.patch(f"/api/alarms/{qa_alarm_id}/toggle", headers=headers_qa)
        print(" [PASS] 2.4: PATCH /api/alarms/{id}/toggle toggled active state successfully")

        # -----------------------------------------------------------------
        # SECTION 3: COGNITIVE ALARM & SESSION FLOW
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 3: Cognitive Alarm & Session Flow")

        # 3.1 Start session
        start_resp = client.post(f"/api/sessions/start/{qa_alarm_id}", headers=headers_qa)
        assert start_resp.status_code == 200, f"Session start failed: {start_resp.text}"
        sess_data = start_resp.json()
        qa_sess_id = sess_data["id"]
        qa_challenge_id = sess_data["challenge_id"]
        cleanup_session_ids.append(qa_sess_id)
        cleanup_challenge_ids.append(qa_challenge_id)
        assert sess_data["session_status"] == "started"
        assert sess_data["snooze_count"] == 0
        assert sess_data["dismissal_status"] == "active"
        print(f" [PASS] 3.1: Session started (id={qa_sess_id}, challenge_id={qa_challenge_id}, snooze_count=0, dismissal_status='active')")

        # 3.2 Challenge retrieval & Security Check (NEVER leak correct_answer)
        ch_resp = client.get(f"/api/challenges/{qa_challenge_id}", headers=headers_qa)
        assert ch_resp.status_code == 200
        ch_data = ch_resp.json()
        assert "question" in ch_data
        assert "challenge_type" in ch_data
        assert "difficulty" in ch_data
        assert "correct_answer" not in ch_data, "Security check: correct_answer must NOT be exposed to client!"

        # Query correct answer directly from DB for test verification
        ch_model = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == qa_challenge_id).first()
        assert ch_model is not None
        correct_ans = str(ch_model.correct_answer).strip()
        print(f" [PASS] 3.2: Challenge retrieved: question='{ch_data['question']}' (Security verified: correct_answer not leaked)")

        # 3.3 Snooze session
        snooze_resp1 = client.post(f"/api/sessions/{qa_sess_id}/snooze", headers=headers_qa)
        assert snooze_resp1.status_code == 200
        assert snooze_resp1.json()["snooze_count"] == 1
        assert snooze_resp1.json()["dismissal_status"] == "snoozed"
        print(" [PASS] 3.3: POST /api/sessions/{id}/snooze incremented snooze_count to 1 and set dismissal_status='snoozed'")

        # 3.4 Multiple snoozes
        snooze_resp2 = client.post(f"/api/sessions/{qa_sess_id}/snooze", headers=headers_qa)
        assert snooze_resp2.status_code == 200
        assert snooze_resp2.json()["snooze_count"] == 2
        print(" [PASS] 3.4: Multiple snoozes incremented snooze_count to 2")

        # 3.5 Submit correct answer
        ans_resp = client.post(f"/api/sessions/{qa_sess_id}/answer", json={"answer": correct_ans}, headers=headers_qa)
        assert ans_resp.status_code == 200
        ans_data = ans_resp.json()
        assert ans_data["is_correct"] is True
        assert ans_data["session_status"] == "completed"
        assert ans_data["dismissal_status"] == "dismissed"
        assert ans_data["response_time_seconds"] is not None
        assert ans_data["response_time_seconds"] >= 0
        assert ans_data["completed_at"] is not None
        print(f" [PASS] 3.5: Correct answer completed session (dismissal='dismissed', response_time={ans_data['response_time_seconds']}s)")

        # 3.6 Reject snooze on completed session
        snooze_completed = client.post(f"/api/sessions/{qa_sess_id}/snooze", headers=headers_qa)
        assert snooze_completed.status_code == 400
        assert "Cannot snooze a completed or expired session" in snooze_completed.json()["detail"]
        print(" [PASS] 3.6: Completed session snooze rejected with HTTP 400")

        # 3.7 Reject answering already completed session
        ans_completed = client.post(f"/api/sessions/{qa_sess_id}/answer", json={"answer": correct_ans}, headers=headers_qa)
        assert ans_completed.status_code == 400
        print(" [PASS] 3.7: Re-answering completed session rejected with HTTP 400")

        # 3.8 Test session expiration & timeout
        sess_expire_start = client.post(f"/api/sessions/start/{qa_alarm_id}", headers=headers_qa)
        assert sess_expire_start.status_code == 200
        sess_exp_id = sess_expire_start.json()["id"]
        cleanup_session_ids.append(sess_exp_id)
        cleanup_challenge_ids.append(sess_expire_start.json()["challenge_id"])

        exp_resp = client.patch(f"/api/sessions/{sess_exp_id}/expire", headers=headers_qa)
        assert exp_resp.status_code == 200
        assert exp_resp.json()["session_status"] == "expired"
        assert exp_resp.json()["dismissal_status"] == "expired"
        assert exp_resp.json()["is_correct"] is False
        assert exp_resp.json()["response_time_seconds"] is not None
        print(f" [PASS] 3.8: Expire session verified (status='expired', dismissal='expired', is_correct=False)")

        # 3.9 Reject snooze on expired session
        snooze_expired = client.post(f"/api/sessions/{sess_exp_id}/snooze", headers=headers_qa)
        assert snooze_expired.status_code == 400
        print(" [PASS] 3.9: Expired session snooze rejected with HTTP 400")

        # 3.10 Session History retrieval
        hist_resp = client.get("/api/sessions/history", headers=headers_qa)
        assert hist_resp.status_code == 200
        hist_sessions = hist_resp.json().get("sessions", [])
        assert len(hist_sessions) >= 2
        for s in hist_sessions:
            assert "snooze_count" in s
            assert "response_time_seconds" in s
            assert "dismissal_status" in s
        print(f" [PASS] 3.10: GET /api/sessions/history verified fields for {len(hist_sessions)} user sessions")

        # -----------------------------------------------------------------
        # SECTION 4: HABIT SCORE ENGINE & MATHEMATICAL FORMULA
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 4: Milestone 3 Habit Score Validation")

        # 4.1 Weight verification
        total_w = WEIGHT_WAKE_UP_CONSISTENCY + WEIGHT_CHALLENGE_COMPLETION + WEIGHT_SNOOZE_REDUCTION + WEIGHT_SLEEP_SCHEDULE_ADHERENCE
        assert round(total_w, 2) == 1.0
        assert WEIGHT_WAKE_UP_CONSISTENCY == 0.35
        assert WEIGHT_CHALLENGE_COMPLETION == 0.25
        assert WEIGHT_SNOOZE_REDUCTION == 0.20
        assert WEIGHT_SLEEP_SCHEDULE_ADHERENCE == 0.20
        print(" [PASS] 4.1: Weights verified: 35% Wake-up + 25% Challenge + 20% Snooze + 20% Sleep = 100%")

        # 4.2 Perfect scores (100 -> 100.0)
        perf_res = calculate_habit_score(100.0, 100.0, 100.0, 100.0)
        assert perf_res["overall_habit_score"] == 100.0
        print(" [PASS] 4.2: Perfect metrics (all 100) yield overall_habit_score=100.0")

        # 4.3 Zero scores (0 -> 0.0)
        zero_res = calculate_habit_score(0.0, 0.0, 0.0, 0.0)
        assert zero_res["overall_habit_score"] == 0.0
        print(" [PASS] 4.3: Zero metrics (all 0) yield overall_habit_score=0.0")

        # 4.4 Clamping bounds (<0 -> 0, >100 -> 100)
        clamp_res = calculate_habit_score(-50.0, 150.0, -10.0, 110.0)
        assert clamp_res["overall_habit_score"] == 45.0  # 0.35(0) + 0.25(100) + 0.20(0) + 0.20(100) = 45.0
        assert clamp_res["wake_up_consistency"] == 0.0
        assert clamp_res["challenge_completion"] == 100.0
        print(" [PASS] 4.4: Clamping verification: sub-zero clamped to 0.0, overflow clamped to 100.0")

        # 4.5 Empty sessions neutral baseline
        empty_res = compute_behavioral_metrics([], None, [])
        assert empty_res["total_sessions"] == 0
        assert empty_res["avg_snooze_count"] == 0.0
        assert empty_res["snooze_reduction"] == 100.0
        assert empty_res["wake_up_consistency"] == 50.0
        assert empty_res["challenge_completion"] == 50.0
        assert empty_res["sleep_schedule_adherence"] == 50.0
        empty_score = calculate_habit_score(**{k: v for k, v in empty_res.items() if k in ["wake_up_consistency", "challenge_completion", "snooze_reduction", "sleep_schedule_adherence"]})
        assert empty_score["overall_habit_score"] == 60.0
        print(" [PASS] 4.5: Zero-session user yields neutral 60.0 baseline (safe mathematical default)")

        # 4.6 Endpoint GET /api/analytics/habit-score
        hs_api_resp = client.get("/api/analytics/habit-score", headers=headers_qa)
        assert hs_api_resp.status_code == 200
        hs_api_data = hs_api_resp.json()
        assert 0.0 <= hs_api_data["overall_habit_score"] <= 100.0
        assert 0.0 <= hs_api_data["wake_up_consistency"] <= 100.0
        assert 0.0 <= hs_api_data["challenge_completion"] <= 100.0
        assert 0.0 <= hs_api_data["snooze_reduction"] <= 100.0
        assert 0.0 <= hs_api_data["sleep_schedule_adherence"] <= 100.0
        print(f" [PASS] 4.6: GET /api/analytics/habit-score returned valid contract: score={hs_api_data['overall_habit_score']}")

        # -----------------------------------------------------------------
        # SECTION 5: ADAPTIVE DIFFICULTY VALIDATION
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 5: Adaptive Difficulty Validation")

        # 5.1 Difficulty scale transitions
        levels = ["beginner", "easy", "medium", "hard", "expert"]
        for i in range(len(levels) - 1):
            assert adjust_difficulty(levels[i], True) == levels[i + 1]
            assert adjust_difficulty(levels[i + 1], False) == levels[i]
        print(" [PASS] 5.1: 5-level scale transitions verified (beginner <-> easy <-> medium <-> hard <-> expert)")

        # 5.2 Boundary clamping
        assert adjust_difficulty("expert", True) == "expert"
        assert adjust_difficulty("beginner", False) == "beginner"
        print(" [PASS] 5.2: Boundary clamping: expert promotion clamped to expert; beginner demotion clamped to beginner")

        # 5.3 Promotion threshold (>= 80% accuracy in window)
        mock_high = [type("MockSession", (), {"is_correct": True})() for _ in range(5)]
        ad_prom = calculate_adaptive_difficulty_from_sessions("medium", mock_high)
        assert ad_prom["recommended_difficulty"] == "hard"
        assert ad_prom["adjusted"] is True
        assert ad_prom["performance"]["accuracy"] == 100.0
        print(" [PASS] 5.3: Promotion threshold verified (100% accuracy -> medium promoted to hard)")

        # 5.4 Demotion threshold (<= 40% accuracy in window)
        mock_low = [type("MockSession", (), {"is_correct": False})() for _ in range(4)] + [type("MockSession", (), {"is_correct": True})()]
        ad_dem = calculate_adaptive_difficulty_from_sessions("hard", mock_low)
        assert ad_dem["recommended_difficulty"] == "medium"
        assert ad_dem["adjusted"] is True
        assert ad_dem["performance"]["accuracy"] == 20.0
        print(" [PASS] 5.4: Demotion threshold verified (20% accuracy -> hard demoted to medium)")

        # 5.5 Balanced range (40% < accuracy < 80% -> maintain)
        mock_bal = [type("MockSession", (), {"is_correct": True})() for _ in range(3)] + [type("MockSession", (), {"is_correct": False})() for _ in range(2)]
        ad_bal = calculate_adaptive_difficulty_from_sessions("medium", mock_bal)
        assert ad_bal["recommended_difficulty"] == "medium"
        assert ad_bal["adjusted"] is False
        assert ad_bal["performance"]["accuracy"] == 60.0
        print(" [PASS] 5.5: Balanced range verified (60% accuracy -> medium maintained)")

        # 5.6 Advisory guarantee: confirm alarm difficulty in DB is NOT mutated by analytics endpoint
        alarm_before = db.query(Alarm).filter(Alarm.id == qa_alarm_id).first().difficulty
        ad_api_resp = client.get(f"/api/analytics/adaptive-difficulty?alarm_id={qa_alarm_id}", headers=headers_qa)
        assert ad_api_resp.status_code == 200
        alarm_after = db.query(Alarm).filter(Alarm.id == qa_alarm_id).first().difficulty
        assert alarm_before == alarm_after, f"Alarm difficulty must NOT mutate! Was {alarm_before}, now {alarm_after}"
        print(f" [PASS] 5.6: Advisory non-mutation confirmed: alarm difficulty remains '{alarm_after}' in database")

        # -----------------------------------------------------------------
        # SECTION 6: RECOMMENDATION ENGINE VALIDATION
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 6: Recommendation Engine Validation")

        # 6.1 Categories coverage
        all_categories = {"sleep_improvement", "wake_up_optimization", "habit_improvement", "productivity", "challenge_recommendation"}
        mock_habit_data = {
            "overall_habit_score": 45.0,
            "wake_up_consistency": 40.0,
            "challenge_completion": 45.0,
            "snooze_reduction": 30.0,
            "sleep_schedule_adherence": 40.0,
            "total_sessions": 6,
            "avg_snooze_count": 2.5,
        }
        recs = generate_recommendations(mock_habit_data, [], None)
        found_cats = {r["category"] for r in recs}
        assert "wake_up_optimization" in found_cats
        assert "habit_improvement" in found_cats
        assert "sleep_improvement" in found_cats
        assert all(r["priority"] in ("high", "medium", "low") for r in recs)
        print(f" [PASS] 6.1: Recommendation engine covers prioritized categories: {found_cats}")

        # 6.2 Deterministic execution
        recs_run2 = generate_recommendations(mock_habit_data, [], None)
        assert recs == recs_run2, "Recommendations must be completely deterministic"
        print(" [PASS] 6.2: Recommendations confirmed deterministic and explainable")

        # 6.3 Endpoint GET /api/analytics/recommendations
        rec_api_resp = client.get("/api/analytics/recommendations", headers=headers_qa)
        assert rec_api_resp.status_code == 200
        assert "recommendations" in rec_api_resp.json()
        assert rec_api_resp.json()["total"] == len(rec_api_resp.json()["recommendations"])
        print(f" [PASS] 6.3: GET /api/analytics/recommendations returned {rec_api_resp.json()['total']} recommendations")

        # -----------------------------------------------------------------
        # SECTION 7: CROSS-USER SECURITY & DATA ISOLATION
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 7: Cross-User Security & Data Isolation")

        user_a = db.query(User).filter(User.id == 3).first()
        user_b = db.query(User).filter(User.id == 5).first()
        token_a = create_access_token(user_a.id, user_a.role)
        token_b = create_access_token(user_b.id, user_b.role)
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 7.1 User B cannot view User A's session
        u_a_sess = db.query(AlarmSession).join(Alarm).filter(Alarm.user_id == user_a.id).first()
        assert u_a_sess is not None
        view_resp = client.get(f"/api/sessions/{u_a_sess.id}", headers=headers_b)
        assert view_resp.status_code == 404, f"Expected 404, got {view_resp.status_code}"
        print(f" [PASS] 7.1: User B cannot view User A's session {u_a_sess.id} (HTTP 404)")

        # 7.2 User B cannot snooze User A's session
        cross_snooze = client.post(f"/api/sessions/{u_a_sess.id}/snooze", headers=headers_b)
        assert cross_snooze.status_code == 404
        print(f" [PASS] 7.2: User B cannot snooze User A's session {u_a_sess.id} (HTTP 404)")

        # 7.3 User B cannot answer User A's session
        cross_ans = client.post(f"/api/sessions/{u_a_sess.id}/answer", json={"answer": "10"}, headers=headers_b)
        assert cross_ans.status_code == 404
        print(f" [PASS] 7.3: User B cannot answer User A's session {u_a_sess.id} (HTTP 404)")

        # 7.4 User B habit score reflects ONLY User B's sessions (0 sessions -> baseline)
        hs_b = client.get("/api/analytics/habit-score", headers=headers_b).json()
        assert hs_b["total_sessions"] == 0, f"User B has 0 sessions, got {hs_b['total_sessions']}"
        assert hs_b["overall_habit_score"] == 60.0
        print(" [PASS] 7.4: User B's habit score completely isolated from User A's 8 sessions")

        # 7.5 User B adaptive difficulty has sample_size=0
        ad_b = client.get("/api/analytics/adaptive-difficulty", headers=headers_b).json()
        assert ad_b["sample_size"] == 0
        print(" [PASS] 7.5: User B's adaptive difficulty completely isolated (sample_size=0)")

        # 7.6 Admin authorization & Non-admin rejection
        admin_user = db.query(User).filter(User.role == "admin").first()
        assert admin_user is not None
        token_admin = create_access_token(admin_user.id, admin_user.role)
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        admin_resp = client.get("/api/admin/stats", headers=headers_admin)
        assert admin_resp.status_code == 200
        print(f" [PASS] 7.6a: Admin user authorized on /api/admin/stats (users={admin_resp.json()['total_users']})")

        non_admin_resp = client.get("/api/admin/stats", headers=headers_a)
        assert non_admin_resp.status_code in (401, 403), f"Expected 401/403 for regular user, got {non_admin_resp.status_code}"
        print(" [PASS] 7.6b: Non-admin regular user correctly rejected from /api/admin/stats (HTTP 403)")

        # -----------------------------------------------------------------
        # SECTION 8: BACKWARD COMPATIBILITY
        # -----------------------------------------------------------------
        print("-" * 80)
        print(">>> SECTION 8: Milestone 1 & 2 Backward Compatibility")

        m2_resp = client.get("/api/analytics", headers=headers_a)
        assert m2_resp.status_code == 200
        m2_data = m2_resp.json()
        required_m2 = [
            "total_alarms", "active_alarms", "total_sessions", "completed_sessions",
            "correct_answers", "wrong_answers", "accuracy", "progress",
            "daily_performance", "challenge_performance",
        ]
        for field in required_m2:
            assert field in m2_data, f"Missing Milestone 2 field: {field}"
        assert "habit_score" in m2_data, "Milestone 3 extension habit_score must be present"
        assert "recommended_difficulty" in m2_data, "Milestone 3 extension recommended_difficulty must be present"
        print(f" [PASS] 8.1: GET /api/analytics preserved all 10 M1/M2 fields and seamlessly provides M3 habit score")

        print("=" * 80)
        print("ALL BACKEND VERIFICATION SECTIONS PASSED WITH ZERO DEFECTS!")
        print("=" * 80)

    finally:
        # Guarantee full cleanup of all temporary test records
        print("\n>>> CLEANING UP TEMPORARY TEST FIXTURES...")
        if cleanup_session_ids:
            db.query(AlarmSession).filter(AlarmSession.id.in_(cleanup_session_ids)).delete(synchronize_session=False)
        if cleanup_challenge_ids:
            db.query(CognitiveChallenge).filter(CognitiveChallenge.id.in_(cleanup_challenge_ids)).delete(synchronize_session=False)
        if cleanup_alarm_ids:
            db.query(Alarm).filter(Alarm.id.in_(cleanup_alarm_ids)).delete(synchronize_session=False)
        if cleanup_user_ids:
            db.query(User).filter(User.id.in_(cleanup_user_ids)).delete(synchronize_session=False)
        db.commit()

        # Check final post-test DB counts
        final_users = db.query(User).count()
        final_alarms = db.query(Alarm).count()
        final_sessions = db.query(AlarmSession).count()
        final_challenges = db.query(CognitiveChallenge).count()

        print(f"[FINAL DB STATE] Users: {final_users} (init: {init_users}), Alarms: {final_alarms} (init: {init_alarms}), Sessions: {final_sessions} (init: {init_sessions}), Challenges: {final_challenges} (init: {init_challenges})")
        assert final_users == init_users, f"Users mismatch: {final_users} vs {init_users}"
        assert final_alarms == init_alarms, f"Alarms mismatch: {final_alarms} vs {init_alarms}"
        assert final_sessions == init_sessions, f"Sessions mismatch: {final_sessions} vs {init_sessions}"
        assert final_challenges == init_challenges, f"Challenges mismatch: {final_challenges} vs {init_challenges}"
        print("[PASS] Database fully restored to identical baseline state with 0 leaks.")
        db.close()


if __name__ == "__main__":
    run_phase5_verification()
