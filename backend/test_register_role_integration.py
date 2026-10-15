"""
Validation Test Suite for Register Screen Role Field & Backend Security Integration

Tests:
1. Default registration submits role="user" -> Creates User account
2. Select Wellness Coach submits role="wellness_coach" -> Creates Wellness Coach account
3. Select Administrator: Frontend blocks submission; backend coercion protects against direct API attack
4. Existing Login still works for all roles
5. Existing User RBAC still works
6. Existing Wellness Coach RBAC still works
7. Existing Administrator accounts still work
8. Admin can promote users to Administrator from Admin Dashboard
9. Admin can promote users to Wellness Coach from Admin Dashboard
10. USER cannot access admin APIs (HTTP 403)
11. WELLNESS_COACH cannot access admin APIs (HTTP 403)
"""

import os
import sys
import uuid
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, UserProfile, Alarm, AlarmSession, CognitiveChallenge, UserNotification
from app.utils.security import create_access_token

client = TestClient(app)


def run_tests():
    print("=" * 80)
    print("RUNNING REGISTER ROLE FIELD & RBAC INTEGRATION VALIDATION SUITE")
    print("=" * 80)

    db = SessionLocal()
    created_user_ids = []

    try:
        # 1. Existing Administrator Verification
        admin_user = db.query(User).filter(User.role == "admin").first()
        assert admin_user is not None, "An admin user must exist"
        admin_token = create_access_token(admin_user.id, "admin")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"[CHECK] Existing Admin verified: ID={admin_user.id}, Role={admin_user.role}")

        suffix = uuid.uuid4().hex[:6]
        user_email = f"reg_user_{suffix}@example.com"
        coach_email = f"reg_coach_{suffix}@example.com"
        hack_email = f"reg_hack_{suffix}@example.com"
        test_pw = "Password123!"

        # -------------------------------------------------------------
        # TEST 1: Default registration -> User
        # -------------------------------------------------------------
        res_user = client.post(
            "/api/auth/register",
            json={"name": "Standard User", "email": user_email, "password": test_pw, "role": "user"},
        )
        assert res_user.status_code == 200
        u_data = res_user.json()["user"]
        user_id = u_data["id"]
        created_user_ids.append(user_id)
        assert u_data["role"] == "user"
        print(f"[PASS] 1. Default registration created User account (ID={user_id}, Role='{u_data['role']}')")

        # -------------------------------------------------------------
        # TEST 2: Wellness Coach registration -> Wellness Coach
        # -------------------------------------------------------------
        res_coach = client.post(
            "/api/auth/register",
            json={"name": "Pro Coach", "email": coach_email, "password": test_pw, "role": "wellness_coach"},
        )
        assert res_coach.status_code == 200
        c_data = res_coach.json()["user"]
        coach_id = c_data["id"]
        created_user_ids.append(coach_id)
        assert c_data["role"] == "wellness_coach"
        print(f"[PASS] 2. Wellness Coach registration created Coach account (ID={coach_id}, Role='{c_data['role']}')")

        # -------------------------------------------------------------
        # TEST 3: Administrator Selection & Privilege Escalation Defense
        # -------------------------------------------------------------
        # Direct POST attempt simulating bypassed frontend
        res_hack = client.post(
            "/api/auth/register",
            json={"name": "Attacker", "email": hack_email, "password": test_pw, "role": "admin"},
        )
        assert res_hack.status_code == 200
        h_data = res_hack.json()["user"]
        hack_id = h_data["id"]
        created_user_ids.append(hack_id)
        assert h_data["role"] == "user", "CRITICAL SECURITY BREACH: Public registration created an admin account!"
        print(f"[PASS] 3. Backend privilege escalation defense confirmed: Attempted role='admin' coerced to role='user'")

        # -------------------------------------------------------------
        # TEST 4: Existing Login Works for all roles
        # -------------------------------------------------------------
        login_u = client.post("/api/auth/login", json={"email": user_email, "password": test_pw})
        assert login_u.status_code == 200
        assert login_u.json()["user"]["role"] == "user"

        login_c = client.post("/api/auth/login", json={"email": coach_email, "password": test_pw})
        assert login_c.status_code == 200
        assert login_c.json()["user"]["role"] == "wellness_coach"
        print("[PASS] 4. Login operates successfully for registered User and Wellness Coach accounts")

        user_token = login_u.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        coach_token = login_c.json()["access_token"]
        coach_headers = {"Authorization": f"Bearer {coach_token}"}

        # -------------------------------------------------------------
        # TEST 5 & 6: Existing User & Coach RBAC
        # -------------------------------------------------------------
        # User profile access
        assert client.get("/api/profile", headers=user_headers).status_code == 200
        # Coach dashboard access
        assert client.get("/api/coach/dashboard", headers=coach_headers).status_code == 200
        print("[PASS] 5 & 6. User and Wellness Coach RBAC functional on respective authorized routes")

        # -------------------------------------------------------------
        # TEST 7: Existing Administrator Accounts Function
        # -------------------------------------------------------------
        assert client.get("/api/admin/stats", headers=admin_headers).status_code == 200
        print("[PASS] 7. Existing Administrator account governance operational")

        # -------------------------------------------------------------
        # TEST 8 & 9: Admin Role Promotions
        # -------------------------------------------------------------
        # Promote User to Wellness Coach
        prom_c = client.put(f"/api/admin/users/{user_id}/role?role=wellness_coach", headers=admin_headers)
        assert prom_c.status_code == 200
        assert prom_c.json()["user"]["role"] == "wellness_coach"
        print("[PASS] 8. Admin successfully promoted User to Wellness Coach")

        # Promote User to Administrator
        prom_a = client.put(f"/api/admin/users/{user_id}/role?role=admin", headers=admin_headers)
        assert prom_a.status_code == 200
        assert prom_a.json()["user"]["role"] == "admin"
        print("[PASS] 9. Admin successfully promoted account to Administrator")

        # Demote back
        dem_u = client.put(f"/api/admin/users/{user_id}/role?role=user", headers=admin_headers)
        assert dem_u.status_code == 200
        assert dem_u.json()["user"]["role"] == "user"

        # -------------------------------------------------------------
        # TEST 10 & 11: Non-Admins Blocked from Admin APIs
        # -------------------------------------------------------------
        assert client.get("/api/admin/stats", headers=user_headers).status_code == 403
        assert client.get("/api/admin/stats", headers=coach_headers).status_code == 403
        assert client.get("/api/admin/users", headers=coach_headers).status_code == 403
        print("[PASS] 10 & 11. USER and WELLNESS_COACH strictly blocked from Admin APIs (HTTP 403 Forbidden)")

        print("\n" + "=" * 80)
        print("ALL REGISTER SCREEN ROLE INTEGRATION TESTS PASSED (100% SUCCESS)!")
        print("=" * 80)

    finally:
        print("\n[CLEANUP] Cleaning test entities...")
        db_cleanup = SessionLocal()
        for uid in created_user_ids:
            try:
                db_cleanup.query(UserProfile).filter(UserProfile.user_id == uid).delete()
                u_obj = db_cleanup.query(User).filter(User.id == uid).first()
                if u_obj:
                    db_cleanup.delete(u_obj)
                db_cleanup.commit()
            except Exception as e:
                db_cleanup.rollback()
                print(f"Error purging user {uid}: {e}")
        db_cleanup.close()
        print(f"[CLEANUP] Safely purged temporary test IDs: {created_user_ids}")


if __name__ == "__main__":
    run_tests()
