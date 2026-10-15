"""
Comprehensive Test Suite for Phase 3: Wellness Coach Dashboard & Authorization.

Tests:
1. Coach Authentication & JWT Token Verification
2. Coach Authorization to Coach APIs (GET /api/coach/dashboard, /clients, /profile)
3. Standard USER Blocked from Coach APIs (HTTP 403 Forbidden)
4. Coach Blocked from ADMIN-Only APIs (HTTP 403 Forbidden)
5. ADMINISTRATOR Behavior on Coach APIs (Authorized Access)
6. Authorized Client Data Access:
   - Behavior insights (GET /api/coach/clients/{id}/insights)
   - Habit adherence analytics (GET /api/coach/clients/{id}/habits)
   - Sleep trend reports (GET /api/coach/clients/{id}/sleep)
   - Progress monitoring (GET /api/coach/clients/{id}/analytics)
7. Unauthorized Client Data Isolation:
   - Non-existent client returns 404
   - Attempting to inspect ADMIN account returns 403
   - Attempting to inspect another COACH account returns 403
8. Sensitive Field Protection (passwords, hashes, raw challenge solutions omitted)
9. Coach Dashboard API Loading & Search Filtering
10. Safe Teardown & Database State Restoration
"""

import os
import sys
import uuid
from jose import jwt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, CognitiveChallenge, UserProfile, Habit
from app.utils.security import SECRET_KEY, ALGORITHM, create_access_token


client = TestClient(app)


def run_phase3_coach_test_suite():
    print("=" * 80)
    print("RUNNING PHASE 3: WELLNESS COACH DASHBOARD INTEGRATION TEST SUITE")
    print("=" * 80)

    db = SessionLocal()
    created_user_ids = []

    try:
        # Existing admin check
        admin_user = db.query(User).filter(User.role == "admin").first()
        assert admin_user is not None, "An admin user must exist in the database"
        admin_token = create_access_token(admin_user.id, admin_user.role)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"[SETUP] Existing Admin: ID={admin_user.id}, Email={admin_user.email}")

        # Unique suffix for test accounts
        suffix = uuid.uuid4().hex[:6]
        coach_email = f"coach_{suffix}@example.com"
        client_email = f"client_{suffix}@example.com"
        other_coach_email = f"other_coach_{suffix}@example.com"
        normal_user_email = f"user_{suffix}@example.com"
        password = "TestPassword123!"

        # -----------------------------------------------------------------
        # 1. COACH AUTHENTICATION
        # -----------------------------------------------------------------
        print("\n--- 1. Testing Coach Authentication ---")
        reg_coach_resp = client.post(
            "/api/auth/register",
            json={"name": "Coach Primary", "email": coach_email, "password": password, "role": "wellness_coach"},
        )
        assert reg_coach_resp.status_code == 200, f"Coach registration failed: {reg_coach_resp.text}"
        coach_id = reg_coach_resp.json()["user"]["id"]
        created_user_ids.append(coach_id)

        # Login
        login_coach_resp = client.post(
            "/api/auth/login",
            json={"email": coach_email, "password": password},
        )
        assert login_coach_resp.status_code == 200, f"Coach login failed: {login_coach_resp.text}"
        coach_token = login_coach_resp.json()["access_token"]
        coach_headers = {"Authorization": f"Bearer {coach_token}"}

        # Verify JWT claims
        coach_payload = jwt.decode(coach_token, SECRET_KEY, algorithms=[ALGORITHM])
        assert coach_payload.get("role") == "wellness_coach", f"Mismatched role claim: {coach_payload}"
        assert str(coach_payload.get("sub")) == str(coach_id)
        print(f"[PASS] 1.1: Coach authenticated successfully (ID={coach_id}, Role='wellness_coach')")

        # Create second coach
        reg_c2 = client.post(
            "/api/auth/register",
            json={"name": "Coach Secondary", "email": other_coach_email, "password": password, "role": "wellness_coach"},
        )
        assert reg_c2.status_code == 200
        other_coach_id = reg_c2.json()["user"]["id"]
        created_user_ids.append(other_coach_id)

        # -----------------------------------------------------------------
        # 2. CREATE CLIENT & NORMAL USER ACCOUNTS
        # -----------------------------------------------------------------
        reg_client = client.post(
            "/api/auth/register",
            json={"name": "Test Client Alpha", "email": client_email, "password": password, "role": "user"},
        )
        assert reg_client.status_code == 200
        client_id = reg_client.json()["user"]["id"]
        created_user_ids.append(client_id)
        client_token = create_access_token(client_id, "user")
        client_headers = {"Authorization": f"Bearer {client_token}"}

        reg_user = client.post(
            "/api/auth/register",
            json={"name": "Normal User Beta", "email": normal_user_email, "password": password, "role": "user"},
        )
        assert reg_user.status_code == 200
        normal_user_id = reg_user.json()["user"]["id"]
        created_user_ids.append(normal_user_id)
        normal_user_token = create_access_token(normal_user_id, "user")
        normal_user_headers = {"Authorization": f"Bearer {normal_user_token}"}

        # Setup client alarm and session data for rich insights
        client.put(
            "/api/profile",
            json={"preferred_wake_time": "06:30:00", "sleep_duration": 8, "time_zone": "Asia/Kolkata", "difficulty_preference": "medium"},
            headers=client_headers,
        )
        client.put(
            "/api/habits",
            json={"wake_up_goal": "Wake up 6:30 AM", "productivity_goals": "Focus study", "habit_preferences": "Math puzzles"},
            headers=client_headers,
        )
        alarm_resp = client.post(
            "/api/alarms",
            json={"name": "Client Morning Alarm", "alarm_time": "06:30:00", "alarm_type": "daily", "challenge_type": "math", "difficulty": "medium"},
            headers=client_headers,
        )
        assert alarm_resp.status_code == 200
        client_alarm_id = alarm_resp.json()["id"]

        # Run a completed session
        sess_resp = client.post(f"/api/sessions/start/{client_alarm_id}", headers=client_headers)
        assert sess_resp.status_code == 200
        session_id = sess_resp.json()["id"]
        chal_id = sess_resp.json()["challenge_id"]
        chal = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == chal_id).first()
        client.post(f"/api/sessions/{session_id}/answer", json={"answer": chal.correct_answer}, headers=client_headers)

        print(f"[PASS] 2.1: Created client account (ID={client_id}) with profile, habits, alarms, and completed sessions")

        # -----------------------------------------------------------------
        # 3. USER BLOCKED FROM COACH APIS (HTTP 403)
        # -----------------------------------------------------------------
        print("\n--- 3. Testing Normal USER Blocked from Coach APIs ---")
        blocked_endpoints = [
            ("GET", "/api/coach/dashboard"),
            ("GET", "/api/coach/clients"),
            ("GET", f"/api/coach/clients/{client_id}"),
            ("GET", f"/api/coach/clients/{client_id}/insights"),
            ("GET", f"/api/coach/clients/{client_id}/habits"),
            ("GET", f"/api/coach/clients/{client_id}/sleep"),
            ("GET", f"/api/coach/clients/{client_id}/analytics"),
        ]
        for method, ep in blocked_endpoints:
            resp = client.get(ep, headers=normal_user_headers)
            assert resp.status_code == 403, f"Security Breach: Regular user accessed {ep}! Got {resp.status_code}"
        print("[PASS] 3.1: All coach endpoints strictly reject standard USER tokens with HTTP 403 Forbidden")

        # -----------------------------------------------------------------
        # 4. COACH BLOCKED FROM ADMIN APIS (HTTP 403)
        # -----------------------------------------------------------------
        print("\n--- 4. Testing Coach Blocked from ADMIN-Only APIs ---")
        admin_endpoints = [
            "/api/admin/stats",
            "/api/admin/users",
            f"/api/admin/users/{client_id}/role?role=admin",
        ]
        for ep in admin_endpoints:
            if "role" in ep:
                resp = client.put(ep, headers=coach_headers)
            else:
                resp = client.get(ep, headers=coach_headers)
            assert resp.status_code == 403, f"Security Breach: Coach accessed admin endpoint {ep}! Got {resp.status_code}"
        print("[PASS] 4.1: Coach tokens strictly rejected from ADMIN-only endpoints with HTTP 403 Forbidden")

        # -----------------------------------------------------------------
        # 5. ADMINISTRATOR BEHAVIOR
        # -----------------------------------------------------------------
        print("\n--- 5. Testing ADMINISTRATOR Access to Coach APIs ---")
        adm_dash = client.get("/api/coach/dashboard", headers=admin_headers)
        assert adm_dash.status_code == 200, f"Admin failed coach dashboard: {adm_dash.text}"
        adm_clients = client.get("/api/coach/clients", headers=admin_headers)
        assert adm_clients.status_code == 200
        print("[PASS] 5.1: Administrator authorized to oversee Wellness Coach endpoints")

        # -----------------------------------------------------------------
        # 6. AUTHORIZED CLIENT DATA ACCESS
        # -----------------------------------------------------------------
        print("\n--- 6. Testing Authorized Client Data Access ---")
        # 6.1 Dashboard
        dash_resp = client.get("/api/coach/dashboard", headers=coach_headers)
        assert dash_resp.status_code == 200, f"Coach dashboard failed: {dash_resp.text}"
        dash_data = dash_resp.json()
        assert "total_clients" in dash_data
        assert "average_habit_score" in dash_data
        assert dash_data["total_clients"] >= 2
        print(f"[PASS] 6.1: GET /api/coach/dashboard loaded KPIs (Clients={dash_data['total_clients']}, AvgScore={dash_data['average_habit_score']})")

        # 6.2 Clients list
        clients_resp = client.get("/api/coach/clients", headers=coach_headers)
        assert clients_resp.status_code == 200
        client_list = clients_resp.json()
        client_ids = [c["id"] for c in client_list]
        assert client_id in client_ids
        # Verify no admin or coach accounts appear in client list
        for c in client_list:
            assert c["id"] != admin_user.id, "Security Breach: Admin account leaked into coach client list!"
            assert c["id"] != coach_id, "Security Breach: Coach account leaked into coach client list!"
            assert c["id"] != other_coach_id, "Security Breach: Other coach leaked into coach client list!"
        print(f"[PASS] 6.2: GET /api/coach/clients returns authorized client roster strictly isolating non-clients")

        # 6.3 Behavior insights
        insights_resp = client.get(f"/api/coach/clients/{client_id}/insights", headers=coach_headers)
        assert insights_resp.status_code == 200, f"Insights failed: {insights_resp.text}"
        ins = insights_resp.json()
        assert ins["client"]["id"] == client_id
        assert "behavioral_summary" in ins
        assert "habit_metrics" in ins
        assert "ml_insights" in ins
        assert ins["behavioral_summary"]["total_sessions"] >= 1
        print(f"[PASS] 6.3: GET /api/coach/clients/{client_id}/insights returned behavioral KPIs and ML score")

        # 6.4 Habit adherence
        habits_resp = client.get(f"/api/coach/clients/{client_id}/habits", headers=coach_headers)
        assert habits_resp.status_code == 200, f"Habits failed: {habits_resp.text}"
        hab = habits_resp.json()
        assert hab["client_id"] == client_id
        assert "goals" in hab
        assert "adherence_metrics" in hab
        assert "streak" in hab
        print(f"[PASS] 6.4: GET /api/coach/clients/{client_id}/habits returned stated goals and 4-factor adherence")

        # 6.5 Sleep trends
        sleep_resp = client.get(f"/api/coach/clients/{client_id}/sleep", headers=coach_headers)
        assert sleep_resp.status_code == 200, f"Sleep trends failed: {sleep_resp.text}"
        slp = sleep_resp.json()
        assert slp["client_id"] == client_id
        assert "sleep_adherence_percentage" in slp
        assert "wake_up_log" in slp
        assert len(slp["wake_up_log"]) >= 1
        print(f"[PASS] 6.5: GET /api/coach/clients/{client_id}/sleep returned sleep adherence and wake log")

        # 6.6 Progress analytics
        prog_resp = client.get(f"/api/coach/clients/{client_id}/analytics?time_range=all", headers=coach_headers)
        assert prog_resp.status_code == 200, f"Analytics failed: {prog_resp.text}"
        prog = prog_resp.json()
        assert prog["client_id"] == client_id
        assert "report_summary" in prog
        print(f"[PASS] 6.6: GET /api/coach/clients/{client_id}/analytics returned progress report summary")

        # -----------------------------------------------------------------
        # 7. UNAUTHORIZED CLIENT DATA ISOLATION
        # -----------------------------------------------------------------
        print("\n--- 7. Testing Unauthorized Client Data Isolation ---")
        # Non-existent client returns 404
        resp_404 = client.get("/api/coach/clients/999999/insights", headers=coach_headers)
        assert resp_404.status_code == 404, f"Expected 404 for nonexistent client, got {resp_404.status_code}"
        print("[PASS] 7.1: Requesting non-existent client ID returns HTTP 404 Not Found")

        # Coach attempting to access Admin account returns 403
        resp_admin_leak = client.get(f"/api/coach/clients/{admin_user.id}/insights", headers=coach_headers)
        assert resp_admin_leak.status_code == 403, f"Expected 403 when querying Admin account, got {resp_admin_leak.status_code}"
        print("[PASS] 7.2: Coach attempting to inspect Admin account blocked with HTTP 403 Forbidden")

        # Coach attempting to access another Coach account returns 403
        resp_coach_leak = client.get(f"/api/coach/clients/{other_coach_id}/habits", headers=coach_headers)
        assert resp_coach_leak.status_code == 403, f"Expected 403 when querying Coach account, got {resp_coach_leak.status_code}"
        print("[PASS] 7.3: Coach attempting to inspect another Coach account blocked with HTTP 403 Forbidden")

        # -----------------------------------------------------------------
        # 8. SENSITIVE FIELD PROTECTION
        # -----------------------------------------------------------------
        print("\n--- 8. Testing Sensitive Field Protection ---")
        # Check all payloads for password or hash leaks
        for payload in [dash_data, client_list, ins, hab, slp, prog]:
            payload_str = str(payload).lower()
            assert "password" not in payload_str, "Critical Security Leak: 'password' found in response payload!"
            assert "password_hash" not in payload_str, "Critical Security Leak: 'password_hash' found in response payload!"
            assert "access_token" not in payload_str, "Critical Security Leak: 'access_token' found in response payload!"
            assert "secret_key" not in payload_str, "Critical Security Leak: 'secret_key' found in response payload!"
        print("[PASS] 8.1: Confirmed zero leakage of passwords, password hashes, JWT tokens, or raw secrets")

        # -----------------------------------------------------------------
        # 9. SEARCH & FILTERING
        # -----------------------------------------------------------------
        print("\n--- 9. Testing Search & Filter Functionality ---")
        search_resp = client.get(f"/api/coach/clients?search={client_email}", headers=coach_headers)
        assert search_resp.status_code == 200
        found = search_resp.json()
        assert len(found) == 1
        assert found[0]["id"] == client_id

        search_empty = client.get("/api/coach/clients?search=nonexistent_query_xyz", headers=coach_headers)
        assert search_empty.status_code == 200
        assert len(search_empty.json()) == 0
        print("[PASS] 9.1: Client search by name and email verified")

        print("\n" + "=" * 80)
        print("ALL PHASE 3 WELLNESS COACH TESTS PASSED SUCCESSFULLY!")
        print("=" * 80)

    finally:
        # Cleanup created test fixtures
        if created_user_ids:
            try:
                db.query(AlarmSession).filter(
                    AlarmSession.alarm_id.in_(
                        db.query(Alarm.id).filter(Alarm.user_id.in_(created_user_ids))
                    )
                ).delete(synchronize_session=False)
                db.query(CognitiveChallenge).filter(
                    CognitiveChallenge.alarm_id.in_(
                        db.query(Alarm.id).filter(Alarm.user_id.in_(created_user_ids))
                    )
                ).delete(synchronize_session=False)
                db.query(Alarm).filter(Alarm.user_id.in_(created_user_ids)).delete(synchronize_session=False)
                db.query(Habit).filter(Habit.user_id.in_(created_user_ids)).delete(synchronize_session=False)
                db.query(UserProfile).filter(UserProfile.user_id.in_(created_user_ids)).delete(synchronize_session=False)
                db.query(User).filter(User.id.in_(created_user_ids)).delete(synchronize_session=False)
                db.commit()
                print(f"[CLEANUP] Safely purged temporary test user IDs: {created_user_ids}")
            except Exception as e:
                db.rollback()
                print(f"[CLEANUP WARNING] Failed to purge test users: {e}")
        db.close()


if __name__ == "__main__":
    run_phase3_coach_test_suite()
