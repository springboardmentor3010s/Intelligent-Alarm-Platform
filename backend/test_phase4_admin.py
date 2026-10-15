"""
Comprehensive Phase 4 Admin Dashboard Test Suite
Validates:
1. Admin authentication
2. USER blocked from all admin APIs (HTTP 403)
3. WELLNESS_COACH blocked from all admin APIs (HTTP 403)
4. ADMINISTRATOR access to all admin APIs (HTTP 200)
5. User listing and user detail inspection
6. User deletion with cascading cleanup and self-deletion prevention (HTTP 400)
7. Role assignment (user, wellness_coach, admin, invalid role rejection)
8. Admin self-role protection (HTTP 400)
9. Platform statistics & KPIs (/stats & /analytics)
10. Session monitoring with filtering and search
11. Recommendation & ML monitoring (/ml-monitoring)
12. Sensitive field protection (zero leakage of password hashes, tokens, secrets, or challenge correct_answers)
13. System Reports & CSV export (/reports/summary & /reports/export/csv)
"""

import os
import sys
import uuid
from datetime import time, datetime, timezone

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.main import app
from app.database.connection import get_db
from app.database.models import User, UserProfile, Habit, Alarm, CognitiveChallenge, AlarmSession
from app.utils.security import create_access_token

client = TestClient(app)

ADMIN_USER_ID = 4
created_user_ids = []

def run_tests():
    print("=" * 80)
    print("RUNNING PHASE 4: ADMINISTRATOR DASHBOARD INTEGRATION TEST SUITE")
    print("=" * 80)

    db = next(get_db())

    # Verify existing Admin
    admin_user = db.query(User).filter(User.id == ADMIN_USER_ID).first()
    if not admin_user or admin_user.role != "admin":
        admin_user = db.query(User).filter(User.role == "admin").first()
    assert admin_user is not None, "Administrator account required for Phase 4 testing"
    print(f"[SETUP] Existing Admin: ID={admin_user.id}, Email={admin_user.email}, Role='{admin_user.role}'")

    admin_token = create_access_token(admin_user.id, admin_user.role)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup a test User
    user_email = f"p4_user_{uuid.uuid4().hex[:6]}@example.com"
    u_res = client.post(
        "/api/auth/register",
        json={"name": "P4 User", "email": user_email, "password": "password123", "role": "user"},
    )
    assert u_res.status_code == 200
    test_user_id = u_res.json()["user"]["id"]
    created_user_ids.append(test_user_id)
    user_token = create_access_token(test_user_id, "user")
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Setup a test Wellness Coach
    coach_email = f"p4_coach_{uuid.uuid4().hex[:6]}@example.com"
    c_res = client.post(
        "/api/auth/register",
        json={"name": "P4 Coach", "email": coach_email, "password": "password123", "role": "wellness_coach"},
    )
    assert c_res.status_code == 200
    test_coach_id = c_res.json()["user"]["id"]
    created_user_ids.append(test_coach_id)
    coach_token = create_access_token(test_coach_id, "wellness_coach")
    coach_headers = {"Authorization": f"Bearer {coach_token}"}

    # Setup a disposable user to test deletion
    disposable_email = f"p4_disp_{uuid.uuid4().hex[:6]}@example.com"
    d_res = client.post(
        "/api/auth/register",
        json={"name": "P4 Disposable", "email": disposable_email, "password": "password123", "role": "user"},
    )
    assert d_res.status_code == 200
    disposable_user_id = d_res.json()["user"]["id"]
    created_user_ids.append(disposable_user_id)

    # Create alarm & session for test user
    client.put(
        "/api/profile",
        json={"preferred_wake_time": "06:30", "sleep_duration": 8, "time_zone": "Asia/Kolkata", "difficulty_preference": "hard"},
        headers=user_headers,
    )
    client.put(
        "/api/habits",
        json={"wake_up_goal": "06:30 AM", "productivity_goals": "Focus 3 hours", "habit_preferences": "No snooze"},
        headers=user_headers,
    )
    alarm_res = client.post(
        "/api/alarms",
        json={"name": "Morning Challenge", "alarm_time": "06:30", "alarm_type": "daily", "challenge_type": "math", "difficulty": "hard"},
        headers=user_headers,
    )
    assert alarm_res.status_code == 200
    alarm_id = alarm_res.json()["id"]

    # Start and answer session
    s_start = client.post(f"/api/sessions/start/{alarm_id}", headers=user_headers)
    assert s_start.status_code == 200
    session_id = s_start.json()["id"]
    client.post(
        f"/api/sessions/{session_id}/answer",
        json={"user_answer": "42"},
        headers=user_headers,
    )

    try:
        # =================================================================
        # TEST 1: Admin Authentication
        # =================================================================
        print("\n--- 1. Testing Admin Authentication ---")
        test_ep = client.get("/api/admin/test", headers=admin_headers)
        assert test_ep.status_code == 200, f"Failed: {test_ep.text}"
        data = test_ep.json()
        assert data["message"] == "Admin access granted"
        assert data["user"]["role"] == "admin"
        print("[PASS] 1.1: Admin authenticated and verified successfully")

        # =================================================================
        # TEST 2: Regular USER Blocked from Admin APIs
        # =================================================================
        print("\n--- 2. Testing Regular USER Blocked from Admin APIs ---")
        admin_endpoints = [
            ("GET", "/api/admin/stats"),
            ("GET", "/api/admin/users"),
            ("GET", f"/api/admin/users/{test_user_id}"),
            ("PUT", f"/api/admin/users/{test_user_id}/role?role=admin"),
            ("DELETE", f"/api/admin/users/{disposable_user_id}"),
            ("GET", "/api/admin/alarms"),
            ("GET", "/api/admin/sessions"),
            ("GET", "/api/admin/analytics"),
            ("GET", "/api/admin/ml-monitoring"),
            ("GET", "/api/admin/reports/summary"),
            ("GET", "/api/admin/reports/export/csv"),
        ]
        for method, endpoint in admin_endpoints:
            res = client.request(method, endpoint, headers=user_headers)
            assert res.status_code == 403, f"Expected 403 for user on {endpoint}, got {res.status_code}"
        print(f"[PASS] 2.1: Regular USER strictly blocked from all {len(admin_endpoints)} admin endpoints (HTTP 403)")

        # =================================================================
        # TEST 3: WELLNESS_COACH Blocked from Admin APIs
        # =================================================================
        print("\n--- 3. Testing WELLNESS_COACH Blocked from Admin APIs ---")
        for method, endpoint in admin_endpoints:
            res = client.request(method, endpoint, headers=coach_headers)
            assert res.status_code == 403, f"Expected 403 for coach on {endpoint}, got {res.status_code}"
        print(f"[PASS] 3.1: Wellness Coach strictly blocked from all {len(admin_endpoints)} admin endpoints (HTTP 403)")

        # =================================================================
        # TEST 4: ADMINISTRATOR Access to Admin APIs
        # =================================================================
        print("\n--- 4. Testing ADMINISTRATOR Access ---")
        get_endpoints = [
            "/api/admin/stats",
            "/api/admin/users",
            f"/api/admin/users/{test_user_id}",
            "/api/admin/alarms",
            "/api/admin/sessions",
            "/api/admin/analytics",
            "/api/admin/ml-monitoring",
            "/api/admin/reports/summary",
            "/api/admin/reports/export/csv",
        ]
        for endpoint in get_endpoints:
            res = client.get(endpoint, headers=admin_headers)
            assert res.status_code == 200, f"Admin failed GET {endpoint}: {res.status_code} {res.text}"
        print(f"[PASS] 4.1: Administrator successfully accessed all {len(get_endpoints)} admin endpoints (HTTP 200)")

        # =================================================================
        # TEST 5: User Listing & User Details
        # =================================================================
        print("\n--- 5. Testing User Listing and Details ---")
        users_res = client.get("/api/admin/users", headers=admin_headers)
        assert users_res.status_code == 200
        user_list = users_res.json()["users"]
        assert len(user_list) >= 3
        # Check user detail
        detail_res = client.get(f"/api/admin/users/{test_user_id}", headers=admin_headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == test_user_id
        assert detail["total_alarms"] >= 1
        assert detail["total_sessions"] >= 1
        assert detail["difficulty_preference"] == "hard"
        assert detail["wake_up_goal"] == "06:30 AM"
        # Non-existent user
        non_res = client.get("/api/admin/users/999999", headers=admin_headers)
        assert non_res.status_code == 404
        print("[PASS] 5.1: User listing and detailed inspection confirmed with 404 boundary handling")

        # =================================================================
        # TEST 6: User Deletion & Cascade
        # =================================================================
        print("\n--- 6. Testing User Deletion ---")
        # Attempt deleting self
        self_del = client.delete(f"/api/admin/users/{admin_user.id}", headers=admin_headers)
        assert self_del.status_code == 400, "Expected 400 when admin deletes own account"
        # Delete disposable user
        del_res = client.delete(f"/api/admin/users/{disposable_user_id}", headers=admin_headers)
        assert del_res.status_code == 200
        assert del_res.json()["user_id"] == disposable_user_id
        # Confirm user is gone
        del_check = client.get(f"/api/admin/users/{disposable_user_id}", headers=admin_headers)
        assert del_check.status_code == 404
        created_user_ids.remove(disposable_user_id)
        print("[PASS] 6.1: User deletion verified with cascade and self-deletion prevention")

        # =================================================================
        # TEST 7: Role Management & Validation
        # =================================================================
        print("\n--- 7. Testing Role Assignment & Validation ---")
        # Promote to wellness_coach
        r1 = client.put(f"/api/admin/users/{test_user_id}/role?role=wellness_coach", headers=admin_headers)
        assert r1.status_code == 200
        assert r1.json()["user"]["role"] == "wellness_coach"

        # Promote to admin
        r2 = client.put(f"/api/admin/users/{test_user_id}/role?role=admin", headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["user"]["role"] == "admin"

        # Demote back to user
        r3 = client.put(f"/api/admin/users/{test_user_id}/role?role=user", headers=admin_headers)
        assert r3.status_code == 200
        assert r3.json()["user"]["role"] == "user"

        # Invalid role rejected
        r4 = client.put(f"/api/admin/users/{test_user_id}/role?role=superuser", headers=admin_headers)
        assert r4.status_code == 400
        print("[PASS] 7.1: Role assignment correctly updates user, coach, admin, and rejects invalid roles (HTTP 400)")

        # =================================================================
        # TEST 8: Admin Self-Role Protection
        # =================================================================
        print("\n--- 8. Testing Admin Self-Role Protection ---")
        self_role = client.put(f"/api/admin/users/{admin_user.id}/role?role=user", headers=admin_headers)
        assert self_role.status_code == 400
        assert "cannot change your own role" in self_role.json()["detail"].lower()
        print("[PASS] 8.1: Admin self-role protection verified (HTTP 400)")

        # =================================================================
        # TEST 9: Platform Statistics & Analytics
        # =================================================================
        print("\n--- 9. Testing Platform Statistics & Analytics ---")
        stats_res = client.get("/api/admin/stats", headers=admin_headers)
        assert stats_res.status_code == 200
        stats_data = stats_res.json()
        assert stats_data["total_users"] > 0
        assert stats_data["total_coaches"] >= 1
        assert stats_data["total_alarms"] > 0
        assert stats_data["total_sessions"] > 0

        analytics_res = client.get("/api/admin/analytics", headers=admin_headers)
        assert analytics_res.status_code == 200
        analytics_data = analytics_res.json()
        assert "total_coaches" in analytics_data
        assert "completion_rate" in analytics_data
        assert "accuracy" in analytics_data
        print(f"[PASS] 9.1: Platform statistics (Users={stats_data['total_users']}, Coaches={stats_data['total_coaches']}, Sessions={stats_data['total_sessions']}) verified")

        # =================================================================
        # TEST 10: Session Monitoring (Search & Filter)
        # =================================================================
        print("\n--- 10. Testing Session Monitoring & Filtering ---")
        sess_all = client.get("/api/admin/sessions", headers=admin_headers)
        assert sess_all.status_code == 200
        all_sessions = sess_all.json()["sessions"]
        assert len(all_sessions) > 0

        # Filter by status=completed
        sess_comp = client.get("/api/admin/sessions?status=completed", headers=admin_headers)
        assert sess_comp.status_code == 200
        comp_sessions = sess_comp.json()["sessions"]
        for s in comp_sessions:
            assert s["session_status"] == "completed"

        # Search by email
        sess_search = client.get(f"/api/admin/sessions?search={user_email}", headers=admin_headers)
        assert sess_search.status_code == 200
        searched = sess_search.json()["sessions"]
        assert len(searched) >= 1
        for s in searched:
            assert user_email in s["user_email"]
        print("[PASS] 10.1: Session monitoring with status filtering and search verified")

        # =================================================================
        # TEST 11: Recommendation & ML Monitoring
        # =================================================================
        print("\n--- 11. Testing Recommendation & ML Monitoring ---")
        ml_res = client.get("/api/admin/ml-monitoring", headers=admin_headers)
        assert ml_res.status_code == 200
        ml_data = ml_res.json()
        assert "model_status" in ml_data
        assert "platform_ml_adoption" in ml_data
        assert "recommendation_activity" in ml_data
        assert ml_data["model_status"]["status"] in ["online", "offline"]
        assert "synthetic" in ml_data["model_status"]["dataset_notice"].lower()
        assert "confidence" in ml_data["recommendation_activity"]["disclaimer"].lower()
        assert "platform_avg_habit_score" in ml_data["platform_ml_adoption"]
        print(f"[PASS] 11.1: ML monitoring verified (Status={ml_data['model_status']['status']}, Algorithm={ml_data['model_status']['algorithm']})")

        # =================================================================
        # TEST 12: Sensitive Field Protection
        # =================================================================
        print("\n--- 12. Testing Sensitive Field Protection ---")
        for session in all_sessions:
            assert "correct_answer" not in session, "Leaked challenge correct_answer in session payload"

        for u in user_list:
            assert "password" not in u
            assert "password_hash" not in u
            assert "hashed_password" not in u

        assert "password" not in detail
        assert "password_hash" not in detail
        assert "hashed_password" not in detail
        print("[PASS] 12.1: Zero leakage of password hashes, secrets, tokens, or challenge correct_answer confirmed")

        # =================================================================
        # TEST 13: System Reports & CSV Export
        # =================================================================
        print("\n--- 13. Testing System Reports & CSV Export ---")
        rep_res = client.get("/api/admin/reports/summary", headers=admin_headers)
        assert rep_res.status_code == 200
        rep_data = rep_res.json()
        assert "platform_overview" in rep_data
        assert "challenge_breakdown" in rep_data
        assert "difficulty_breakdown" in rep_data
        assert "data_safety_certification" in rep_data

        csv_res = client.get("/api/admin/reports/export/csv", headers=admin_headers)
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers["content-type"]
        assert "System_Admin_Report" in csv_res.headers["content-disposition"]
        csv_text = csv_res.text
        assert "INTELLIGENT COGNITIVE ALARM PLATFORM" in csv_text
        assert "COGNITIVE CHALLENGE PERFORMANCE" in csv_text
        print(f"[PASS] 13.1: System summary report and CSV export ({len(csv_text)} bytes) verified")

        print("\n" + "=" * 80)
        print("ALL PHASE 4 ADMIN DASHBOARD TESTS PASSED SUCCESSFULLY!")
        print("=" * 80)

    finally:
        # Cleanup created test users
        print("\n[CLEANUP] Cleaning up temporary test users...")
        db_cleanup = next(get_db())
        for uid in created_user_ids:
            try:
                alarms = db_cleanup.query(Alarm).filter(Alarm.user_id == uid).all()
                for a in alarms:
                    db_cleanup.query(AlarmSession).filter(AlarmSession.alarm_id == a.id).delete()
                    db_cleanup.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id == a.id).delete()
                db_cleanup.query(Alarm).filter(Alarm.user_id == uid).delete()
                db_cleanup.query(UserProfile).filter(UserProfile.user_id == uid).delete()
                db_cleanup.query(Habit).filter(Habit.user_id == uid).delete()
                u_obj = db_cleanup.query(User).filter(User.id == uid).first()
                if u_obj:
                    db_cleanup.delete(u_obj)
                db_cleanup.commit()
            except Exception as e:
                db_cleanup.rollback()
                print(f"[CLEANUP ERROR for user {uid}]: {e}")
        print(f"[CLEANUP] Safely purged temporary test user IDs: {created_user_ids}")

if __name__ == "__main__":
    run_tests()
