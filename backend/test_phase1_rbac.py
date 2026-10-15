"""
Comprehensive Test Suite for Phase 1: Role-Based Access Control (RBAC).

Tests:
1. Registration & Role Assignment
   - Register new user as 'wellness_coach' (role='wellness_coach')
   - Register new user with default role (role='user')
   - Prevent privilege escalation: attempted registration with role='admin' coerced to 'user'
2. JWT Claims Verification
   - Verify access tokens contain valid 'role' claims for user, wellness_coach, and admin
3. Role Authorization Matrix & Endpoint Protection
   - USER -> /api/admin/stats (403 Forbidden)
   - USER -> /api/coach/test (403 Forbidden)
   - WELLNESS COACH -> /api/admin/stats (403 Forbidden)
   - WELLNESS COACH -> /api/coach/test (200 OK)
   - WELLNESS COACH -> /api/coach/profile (200 OK)
   - ADMIN -> /api/admin/stats (200 OK, verifies 'total_coaches' is returned)
   - ADMIN -> /api/admin/test (200 OK)
4. Admin Role Management
   - Admin promotes user to 'wellness_coach' (200 OK)
   - Admin attempts invalid role (400 Bad Request)
   - Admin attempts to change own role (400 Bad Request)
   - Admin demotes user back to 'user' (200 OK)
5. User Data Isolation
   - Non-admin user cannot access another user's alarms
6. Safe Cleanup
   - Temporary test accounts are cleanly purged after testing
"""

import os
import sys
import uuid
from jose import jwt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm
from app.utils.security import SECRET_KEY, ALGORITHM, create_access_token


client = TestClient(app)


def run_phase1_rbac_tests():
    print("=" * 75)
    print("RUNNING PHASE 1: ROLE-BASED ACCESS CONTROL (RBAC) TEST SUITE")
    print("=" * 75)

    db = SessionLocal()
    created_user_ids = []

    try:
        # -----------------------------------------------------------------
        # Identify existing admin user (or raise)
        # -----------------------------------------------------------------
        admin_user = db.query(User).filter(User.role == "admin").first()
        assert admin_user is not None, "At least one administrator account must exist in the database"
        admin_token = create_access_token(admin_user.id, admin_user.role)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"[SETUP] Existing Admin: ID={admin_user.id}, Email={admin_user.email}, Role={admin_user.role}")

        # Unique suffix for test accounts
        test_suffix = uuid.uuid4().hex[:6]
        user_email = f"test_user_{test_suffix}@example.com"
        coach_email = f"test_coach_{test_suffix}@example.com"
        hacker_email = f"test_hacker_{test_suffix}@example.com"
        test_password = "TestPassword123!"

        # -----------------------------------------------------------------
        # TEST 1: REGISTRATION & ROLE ASSIGNMENT
        # -----------------------------------------------------------------
        print("\n--- TEST GROUP 1: Registration & Role Assignment ---")

        # 1.1 Register regular user
        reg_user_resp = client.post(
            "/api/auth/register",
            json={"name": "Test User", "email": user_email, "password": test_password},
        )
        assert reg_user_resp.status_code == 200, f"User registration failed: {reg_user_resp.text}"
        user_data = reg_user_resp.json()
        assert user_data["user"]["role"] == "user", f"Expected role 'user', got {user_data['user']['role']}"
        reg_user_id = user_data["user"]["id"]
        created_user_ids.append(reg_user_id)
        print(f"[PASS] 1.1: Default registration assigns role='user' (ID={reg_user_id})")

        # 1.2 Register wellness coach
        reg_coach_resp = client.post(
            "/api/auth/register",
            json={
                "name": "Test Coach",
                "email": coach_email,
                "password": test_password,
                "role": "wellness_coach",
            },
        )
        assert reg_coach_resp.status_code == 200, f"Coach registration failed: {reg_coach_resp.text}"
        coach_data = reg_coach_resp.json()
        assert coach_data["user"]["role"] == "wellness_coach", (
            f"Expected role 'wellness_coach', got {coach_data['user']['role']}"
        )
        reg_coach_id = coach_data["user"]["id"]
        created_user_ids.append(reg_coach_id)
        print(f"[PASS] 1.2: Wellness coach registration assigns role='wellness_coach' (ID={reg_coach_id})")

        # 1.3 Prevent privilege escalation on registration
        reg_hacker_resp = client.post(
            "/api/auth/register",
            json={
                "name": "Test Hacker",
                "email": hacker_email,
                "password": test_password,
                "role": "admin",
            },
        )
        assert reg_hacker_resp.status_code == 200, f"Hacker registration failed: {reg_hacker_resp.text}"
        hacker_data = reg_hacker_resp.json()
        assert hacker_data["user"]["role"] == "user", (
            f"Security flaw: Admin registration was not coerced to 'user'! Got {hacker_data['user']['role']}"
        )
        reg_hacker_id = hacker_data["user"]["id"]
        created_user_ids.append(reg_hacker_id)
        print(f"[PASS] 1.3: Attempted role='admin' during registration safely coerced to role='user'")

        # -----------------------------------------------------------------
        # TEST 2: JWT TOKEN CLAIMS VERIFICATION
        # -----------------------------------------------------------------
        print("\n--- TEST GROUP 2: JWT Token Claims Verification ---")

        # Login as user
        login_user_resp = client.post(
            "/api/auth/login",
            json={"email": user_email, "password": test_password},
        )
        assert login_user_resp.status_code == 200, f"User login failed: {login_user_resp.text}"
        user_token = login_user_resp.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        user_payload = jwt.decode(user_token, SECRET_KEY, algorithms=[ALGORITHM])
        assert user_payload.get("role") == "user", f"Token role claim mismatch: {user_payload}"
        print(f"[PASS] 2.1: User JWT contains sub={user_payload['sub']} and role='user'")

        # Login as coach
        login_coach_resp = client.post(
            "/api/auth/login",
            json={"email": coach_email, "password": test_password},
        )
        assert login_coach_resp.status_code == 200, f"Coach login failed: {login_coach_resp.text}"
        coach_token = login_coach_resp.json()["access_token"]
        coach_headers = {"Authorization": f"Bearer {coach_token}"}
        coach_payload = jwt.decode(coach_token, SECRET_KEY, algorithms=[ALGORITHM])
        assert coach_payload.get("role") == "wellness_coach", f"Coach token claim mismatch: {coach_payload}"
        print(f"[PASS] 2.2: Wellness Coach JWT contains sub={coach_payload['sub']} and role='wellness_coach'")

        # Verify admin token claims
        admin_payload = jwt.decode(admin_token, SECRET_KEY, algorithms=[ALGORITHM])
        assert admin_payload.get("role") == "admin", f"Admin token claim mismatch: {admin_payload}"
        print(f"[PASS] 2.3: Admin JWT contains sub={admin_payload['sub']} and role='admin'")

        # -----------------------------------------------------------------
        # TEST 3: ROLE AUTHORIZATION MATRIX & ENDPOINTS
        # -----------------------------------------------------------------
        print("\n--- TEST GROUP 3: Role Authorization Matrix & Endpoint Protection ---")

        # 3.1 Regular User -> Admin Endpoint (MUST FAIL 403)
        resp = client.get("/api/admin/stats", headers=user_headers)
        assert resp.status_code == 403, f"Regular user accessed admin stats! Got {resp.status_code}"
        print(f"[PASS] 3.1: Regular User blocked from /api/admin/stats (HTTP 403 Forbidden)")

        # 3.2 Regular User -> Coach Endpoint (MUST FAIL 403)
        resp = client.get("/api/coach/test", headers=user_headers)
        assert resp.status_code == 403, f"Regular user accessed coach test! Got {resp.status_code}"
        print(f"[PASS] 3.2: Regular User blocked from /api/coach/test (HTTP 403 Forbidden)")

        # 3.3 Wellness Coach -> Admin Endpoint (MUST FAIL 403)
        resp = client.get("/api/admin/stats", headers=coach_headers)
        assert resp.status_code == 403, f"Wellness Coach accessed admin stats! Got {resp.status_code}"
        print(f"[PASS] 3.3: Wellness Coach blocked from /api/admin/stats (HTTP 403 Forbidden)")

        # 3.4 Wellness Coach -> Coach Endpoint (MUST SUCCEED 200)
        resp = client.get("/api/coach/test", headers=coach_headers)
        assert resp.status_code == 200, f"Wellness Coach failed /api/coach/test: {resp.text}"
        data = resp.json()
        assert data["user"]["role"] == "wellness_coach"
        print(f"[PASS] 3.4: Wellness Coach successfully accessed /api/coach/test (HTTP 200 OK)")

        # 3.5 Wellness Coach -> Coach Profile (MUST SUCCEED 200)
        resp = client.get("/api/coach/profile", headers=coach_headers)
        assert resp.status_code == 200, f"Wellness Coach failed /api/coach/profile: {resp.text}"
        data = resp.json()
        assert data["role"] == "wellness_coach"
        print(f"[PASS] 3.5: Wellness Coach successfully accessed /api/coach/profile (HTTP 200 OK)")

        # 3.6 Admin -> Admin Endpoints (MUST SUCCEED 200)
        resp = client.get("/api/admin/test", headers=admin_headers)
        assert resp.status_code == 200, f"Admin test failed: {resp.text}"
        print(f"[PASS] 3.6: Admin successfully accessed /api/admin/test (HTTP 200 OK)")

        resp = client.get("/api/admin/stats", headers=admin_headers)
        assert resp.status_code == 200, f"Admin stats failed: {resp.text}"
        stats_data = resp.json()
        assert "total_coaches" in stats_data, "Admin stats missing 'total_coaches' metric!"
        assert stats_data["total_coaches"] >= 1, f"Expected total_coaches >= 1, got {stats_data['total_coaches']}"
        print(f"[PASS] 3.7: Admin /api/admin/stats returns 'total_coaches'={stats_data['total_coaches']} (HTTP 200 OK)")

        # -----------------------------------------------------------------
        # TEST 4: ADMIN ROLE MANAGEMENT
        # -----------------------------------------------------------------
        print("\n--- TEST GROUP 4: Admin Role Management ---")

        # 4.1 Admin promotes regular user to wellness_coach
        resp = client.put(
            f"/api/admin/users/{reg_user_id}/role?role=wellness_coach",
            headers=admin_headers,
        )
        assert resp.status_code == 200, f"Admin failed to update role: {resp.text}"
        assert resp.json()["user"]["role"] == "wellness_coach"

        db_user = db.query(User).filter(User.id == reg_user_id).first()
        assert db_user.role == "wellness_coach", f"DB role not updated: {db_user.role}"
        print(f"[PASS] 4.1: Admin successfully promoted user {reg_user_id} to 'wellness_coach'")

        # 4.2 Admin attempts invalid role
        resp = client.put(
            f"/api/admin/users/{reg_user_id}/role?role=superhero",
            headers=admin_headers,
        )
        assert resp.status_code == 400, f"Expected 400 for invalid role, got {resp.status_code}"
        print(f"[PASS] 4.2: Admin rejected when assigning invalid role 'superhero' (HTTP 400 Bad Request)")

        # 4.3 Admin attempts to change own role
        resp = client.put(
            f"/api/admin/users/{admin_user.id}/role?role=user",
            headers=admin_headers,
        )
        assert resp.status_code == 400, f"Expected 400 for self-role change, got {resp.status_code}"
        print(f"[PASS] 4.3: Admin cannot change own role (HTTP 400 Bad Request)")

        # 4.4 Admin demotes user back to regular user
        resp = client.put(
            f"/api/admin/users/{reg_user_id}/role?role=user",
            headers=admin_headers,
        )
        assert resp.status_code == 200, f"Admin failed to demote user: {resp.text}"
        assert resp.json()["user"]["role"] == "user"
        print(f"[PASS] 4.4: Admin demoted user {reg_user_id} back to 'user' (HTTP 200 OK)")

        # -----------------------------------------------------------------
        # TEST 5: DATA ISOLATION
        # -----------------------------------------------------------------
        print("\n--- TEST GROUP 5: Data Isolation ---")
        # Regular user accessing their own alarms endpoint
        resp = client.get("/api/alarms", headers=user_headers)
        assert resp.status_code == 200, f"Failed to get own alarms: {resp.text}"
        user_alarms = resp.json()
        assert isinstance(user_alarms, list), f"Expected list of alarms, got {type(user_alarms)}"
        # Confirm user only sees their own alarms
        for alarm in user_alarms:
            assert alarm["user_id"] == reg_user_id, "Data isolation violation: user saw another user's alarm!"
        print(f"[PASS] 5.1: User data isolation verified: query returns strictly owned resources")

        print("\n" + "=" * 75)
        print("ALL PHASE 1 RBAC TESTS PASSED SUCCESSFULLY!")
        print("=" * 75)

    finally:
        # Cleanup created test users
        if created_user_ids:
            try:
                db.query(User).filter(User.id.in_(created_user_ids)).delete(synchronize_session=False)
                db.commit()
                print(f"[CLEANUP] Safely purged temporary test user IDs: {created_user_ids}")
            except Exception as e:
                db.rollback()
                print(f"[CLEANUP WARNING] Failed to purge test users {created_user_ids}: {e}")
        db.close()


if __name__ == "__main__":
    run_phase1_rbac_tests()
