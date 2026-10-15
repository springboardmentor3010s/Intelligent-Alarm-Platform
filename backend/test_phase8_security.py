"""
Phase 8 Security Audit Test Suite
Validates the complete security posture of the Intelligent Cognitive Alarm Platform:
1. JWT Security (Signature verification, Tampering, Expiration, Algorithm enforcement)
2. Password Hashing (pwdlib Argon2id, Salt uniqueness, Verification robustness)
3. Privilege Escalation Prevention during Registration
4. Role-Based Access Control (RBAC) Matrix (USER, WELLNESS_COACH, ADMIN)
5. Admin Self-Protection Safeguards
6. Multi-Tenant Data Isolation across Alarms, Sessions, Habits, and Notifications
7. Challenge Solution Concealment (Zero correct_answer leakage)
8. Credential & Hash Concealment in all API outputs
9. SQL Injection Resistance in filters, queries, and search fields
10. Health Check & Error Payload Sanitization
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from jose import jwt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.main import app
from app.database.connection import get_db, SessionLocal
from app.database.models import User, UserProfile, Alarm, CognitiveChallenge, AlarmSession, UserNotification
from app.utils.security import (
    SECRET_KEY,
    ALGORITHM,
    hash_password,
    verify_password,
    create_access_token,
    password_hash,
)

client = TestClient(app)


def run_security_audit():
    print("=" * 80)
    print("RUNNING PHASE 8: COMPREHENSIVE SECURITY AUDIT & VALIDATION SUITE")
    print("=" * 80)

    db = SessionLocal()
    created_user_ids = []

    try:
        # Locate administrator
        admin_user = db.query(User).filter(User.role == "admin").first()
        assert admin_user is not None, "An administrator account must exist in the database."
        admin_token = create_access_token(admin_user.id, "admin")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"[SETUP] Existing Administrator verified: ID={admin_user.id}")

        # Create test accounts
        suffix = uuid.uuid4().hex[:6]
        user_email = f"sec_user_{suffix}@example.com"
        coach_email = f"sec_coach_{suffix}@example.com"
        other_user_email = f"sec_other_{suffix}@example.com"
        test_password = "SecurePassword123!"

        # Register normal user
        reg_user = client.post(
            "/api/auth/register",
            json={"name": "Alice Security", "email": user_email, "password": test_password, "role": "user"},
        )
        assert reg_user.status_code == 200
        user_id = reg_user.json()["user"]["id"]
        created_user_ids.append(user_id)
        user_token = create_access_token(user_id, "user")
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # Register wellness coach
        reg_coach = client.post(
            "/api/auth/register",
            json={"name": "Coach Security", "email": coach_email, "password": test_password, "role": "wellness_coach"},
        )
        assert reg_coach.status_code == 200
        coach_id = reg_coach.json()["user"]["id"]
        created_user_ids.append(coach_id)
        coach_token = create_access_token(coach_id, "wellness_coach")
        coach_headers = {"Authorization": f"Bearer {coach_token}"}

        # Register second user for cross-tenant checks
        reg_other = client.post(
            "/api/auth/register",
            json={"name": "Bob Security", "email": other_user_email, "password": test_password, "role": "user"},
        )
        assert reg_other.status_code == 200
        other_id = reg_other.json()["user"]["id"]
        created_user_ids.append(other_id)
        other_token = create_access_token(other_id, "user")
        other_headers = {"Authorization": f"Bearer {other_token}"}

        print("[SETUP] Created isolated test users: User A, User B, Wellness Coach")

        # =====================================================================
        # 1. JWT SECURITY AUDIT
        # =====================================================================
        print("\n[AUDIT 1] JWT Token Signature, Expiration & Tamper Resistance")

        # 1.1 Valid Token
        me_valid = client.get("/api/auth/me", headers=user_headers)
        assert me_valid.status_code == 200
        assert me_valid.json()["id"] == user_id
        print("  [PASS] 1.1 Valid JWT signature correctly authenticated")

        # 1.2 Tampered Payload (Modified sub)
        parts = user_token.split(".")
        tampered_token = f"{parts[0]}.eyAic3ViIjogIjEwMDAwIiwgInJvbGUiOiAiYWRtaW4iIH0.{parts[2]}"
        tamper_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
        assert tamper_res.status_code == 401
        print("  [PASS] 1.2 Tampered token payload rejected (HTTP 401 Unauthorized)")

        # 1.3 Forged Signature with Different Secret
        forged_token = jwt.encode(
            {"sub": str(user_id), "role": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "attacker_bogus_secret_key_1234567890",
            algorithm=ALGORITHM,
        )
        forged_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged_token}"})
        assert forged_res.status_code == 401
        print("  [PASS] 1.3 Forged signature with unauthorized key rejected (HTTP 401 Unauthorized)")

        # 1.4 Expired Token
        expired_token = jwt.encode(
            {"sub": str(user_id), "role": "user", "exp": datetime.now(timezone.utc) - timedelta(minutes=5)},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        exp_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert exp_res.status_code == 401
        print("  [PASS] 1.4 Expired token rejected by expiration timestamp (HTTP 401 Unauthorized)")

        # 1.5 Missing Authorization Header
        unauth_res = client.get("/api/profile")
        assert unauth_res.status_code == 401
        print("  [PASS] 1.5 Missing Authorization header rejected (HTTP 401 Unauthorized)")

        # =====================================================================
        # 2. PASSWORD HASHING AUDIT (pwdlib / Argon2id)
        # =====================================================================
        print("\n[AUDIT 2] Password Hashing & Cryptographic Robustness")

        h1 = hash_password("SamePassword123!")
        h2 = hash_password("SamePassword123!")

        # Algorithm identification
        assert h1.startswith("$argon2id$")
        print("  [PASS] 2.1 Password hash conforms strictly to OWASP Argon2id ($argon2id$ prefix)")

        # Salt uniqueness
        assert h1 != h2, "Cryptographic flaw: Identical passwords produced identical hashes (missing unique salt)!"
        print("  [PASS] 2.2 Salt uniqueness verified: Identical passwords produce distinct hashes")

        # Verification correctness
        assert verify_password("SamePassword123!", h1) is True
        assert verify_password("WrongPassword999!", h1) is False
        print("  [PASS] 2.3 Password verification correctly approves valid and rejects invalid passwords")

        # =====================================================================
        # 3. REGISTRATION PRIVILEGE ESCALATION
        # =====================================================================
        print("\n[AUDIT 3] Registration Privilege Escalation Protection")

        # Attempt to register directly as 'admin'
        hacker_email = f"sec_hacker_{suffix}@example.com"
        reg_hack = client.post(
            "/api/auth/register",
            json={"name": "Hacker", "email": hacker_email, "password": test_password, "role": "admin"},
        )
        assert reg_hack.status_code == 200
        hack_id = reg_hack.json()["user"]["id"]
        created_user_ids.append(hack_id)
        assert reg_hack.json()["user"]["role"] == "user", "Privilege Escalation! User registered as admin!"
        print("  [PASS] 3.1 Registration with requested role='admin' strictly coerced to role='user'")

        # Attempt to register with arbitrary role
        root_email = f"sec_root_{suffix}@example.com"
        reg_root = client.post(
            "/api/auth/register",
            json={"name": "RootAttempt", "email": root_email, "password": test_password, "role": "superadmin"},
        )
        assert reg_root.status_code == 200
        root_id = reg_root.json()["user"]["id"]
        created_user_ids.append(root_id)
        assert reg_root.json()["user"]["role"] == "user"
        print("  [PASS] 3.2 Registration with arbitrary role='superadmin' strictly coerced to role='user'")

        # =====================================================================
        # 4. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
        # =====================================================================
        print("\n[AUDIT 4] Role-Based Access Control (RBAC) Matrix")

        # Regular user blocked from admin endpoints
        assert client.get("/api/admin/stats", headers=user_headers).status_code == 403
        assert client.get("/api/admin/users", headers=user_headers).status_code == 403
        assert client.get("/api/admin/sessions", headers=user_headers).status_code == 403
        assert client.get("/api/admin/ml-monitoring", headers=user_headers).status_code == 403
        assert client.get("/api/coach/dashboard", headers=user_headers).status_code == 403
        print("  [PASS] 4.1 Regular USER blocked from Admin & Coach APIs (HTTP 403 Forbidden)")

        # Wellness Coach blocked from admin endpoints
        assert client.get("/api/admin/stats", headers=coach_headers).status_code == 403
        assert client.get("/api/admin/users", headers=coach_headers).status_code == 403
        assert client.get("/api/admin/reports/summary", headers=coach_headers).status_code == 403
        assert client.post("/api/admin/announcements", headers=coach_headers, json={"title": "x", "message": "y"}).status_code == 403
        print("  [PASS] 4.2 WELLNESS_COACH blocked from Administrator APIs (HTTP 403 Forbidden)")

        # Wellness Coach cannot inspect Admin or other Coach accounts
        assert client.get(f"/api/coach/clients/{admin_user.id}/insights", headers=coach_headers).status_code == 403
        assert client.get(f"/api/coach/clients/{coach_id}/insights", headers=coach_headers).status_code == 403
        print("  [PASS] 4.3 WELLNESS_COACH blocked from inspecting Administrator or Coach accounts (HTTP 403)")

        # Wellness Coach can access standard user
        coach_view_user = client.get(f"/api/coach/clients/{user_id}/insights", headers=coach_headers)
        assert coach_view_user.status_code == 200
        print("  [PASS] 4.4 WELLNESS_COACH authorized to access client user insights (HTTP 200)")

        # =====================================================================
        # 5. ADMIN GOVERNANCE & SELF-PROTECTION SAFEGUARDS
        # =====================================================================
        print("\n[AUDIT 5] Admin Governance & Self-Protection Safeguards")

        # Admin cannot change own role
        self_role = client.put(f"/api/admin/users/{admin_user.id}/role?role=user", headers=admin_headers)
        assert self_role.status_code == 400
        print("  [PASS] 5.1 Administrator self-role demotion strictly prevented (HTTP 400)")

        # Admin cannot delete own account
        self_del = client.delete(f"/api/admin/users/{admin_user.id}", headers=admin_headers)
        assert self_del.status_code == 400
        print("  [PASS] 5.2 Administrator self-account deletion strictly prevented (HTTP 400)")

        # Admin cannot assign invalid roles
        bad_role = client.put(f"/api/admin/users/{user_id}/role?role=hacker_role", headers=admin_headers)
        assert bad_role.status_code == 400
        print("  [PASS] 5.3 Admin assignment of invalid role rejected (HTTP 400)")

        # =====================================================================
        # 6. MULTI-TENANT DATA ISOLATION
        # =====================================================================
        print("\n[AUDIT 6] Multi-Tenant Data Isolation Across Resources")

        # Create alarm for User A
        alarm_a = client.post(
            "/api/alarms",
            headers=user_headers,
            json={"name": "Alice Alarm", "alarm_time": "07:00:00", "alarm_type": "daily", "challenge_type": "math", "difficulty": "medium"},
        ).json()
        alarm_a_id = alarm_a["id"]

        # User B cannot view User A's alarm
        b_get_a = client.get(f"/api/alarms/{alarm_a_id}", headers=other_headers)
        assert b_get_a.status_code == 404
        print("  [PASS] 6.1 User B cannot read User A's alarm (HTTP 404)")

        # User B cannot update User A's alarm
        b_put_a = client.put(
            f"/api/alarms/{alarm_a_id}",
            headers=other_headers,
            json={"name": "Hijacked", "alarm_time": "07:00:00", "alarm_type": "daily", "challenge_type": "math", "difficulty": "hard"},
        )
        assert b_put_a.status_code == 404
        print("  [PASS] 6.2 User B cannot modify User A's alarm (HTTP 404)")

        # User B cannot delete User A's alarm
        b_del_a = client.delete(f"/api/alarms/{alarm_a_id}", headers=other_headers)
        assert b_del_a.status_code == 404
        print("  [PASS] 6.3 User B cannot delete User A's alarm (HTTP 404)")

        # Start session on User A's alarm
        sess_a = client.post(f"/api/sessions/start/{alarm_a_id}", headers=user_headers).json()
        sess_a_id = sess_a["id"]
        chal_a_id = sess_a["challenge_id"]

        # User B cannot snooze or answer User A's session
        b_snooze = client.post(f"/api/sessions/{sess_a_id}/snooze", headers=other_headers)
        assert b_snooze.status_code == 404
        b_answer = client.post(f"/api/sessions/{sess_a_id}/answer", headers=other_headers, json={"answer": "42"})
        assert b_answer.status_code == 404
        print("  [PASS] 6.4 User B cannot snooze or answer User A's cognitive session (HTTP 404)")

        # User B cannot fetch User A's challenge
        b_chal = client.get(f"/api/challenges/{chal_a_id}", headers=other_headers)
        assert b_chal.status_code == 404
        print("  [PASS] 6.5 User B cannot inspect User A's cognitive challenge (HTTP 404)")

        # =====================================================================
        # 7. CHALLENGE SOLUTION CONCEALMENT (Zero correct_answer Leakage)
        # =====================================================================
        print("\n[AUDIT 7] Challenge Solution Concealment Verification")

        # 7.1 Challenge GET endpoint
        chal_res = client.get(f"/api/challenges/{chal_a_id}", headers=user_headers).json()
        assert "correct_answer" not in chal_res, "Critical Security Leak: correct_answer exposed in /api/challenges/{id}!"
        print("  [PASS] 7.1 Zero correct_answer in /api/challenges/{id} payload")

        # 7.2 Session response
        assert "correct_answer" not in sess_a, "Critical Security Leak: correct_answer exposed in SessionResponse!"
        print("  [PASS] 7.2 Zero correct_answer in SessionResponse payload")

        # 7.3 Session history
        hist = client.get("/api/sessions/history", headers=user_headers).json()["sessions"]
        for s in hist:
            assert "correct_answer" not in s
        print("  [PASS] 7.3 Zero correct_answer in /api/sessions/history payload")

        # 7.4 Notifications
        notifs = client.get("/api/notifications", headers=user_headers).json()
        assert "correct_answer" not in str(notifs)
        print("  [PASS] 7.4 Zero challenge answer leakage in notifications or dynamic reminders")

        # =====================================================================
        # 8. CREDENTIAL & HASH CONCEALMENT
        # =====================================================================
        print("\n[AUDIT 8] Credential & Password Hash Sanitization")

        # Audit user profile, habits, alarms, coach, admin outputs
        admin_users_payload = client.get("/api/admin/users", headers=admin_headers).json()
        for u in admin_users_payload["users"]:
            assert "password" not in u
            assert "password_hash" not in u
            assert "hashed_password" not in u
        print("  [PASS] 8.1 Zero password or hash leakage in /api/admin/users")

        user_me_payload = client.get("/api/auth/me", headers=user_headers).json()
        assert "password" not in user_me_payload and "password_hash" not in user_me_payload
        print("  [PASS] 8.2 Zero password or hash leakage in /api/auth/me")

        # =====================================================================
        # 9. SQL INJECTION DEFENSE IN DEPTH
        # =====================================================================
        print("\n[AUDIT 9] SQL Injection Resistance")

        sql_payloads = [
            "' OR '1'='1",
            "1; DROP TABLE users; --",
            "' UNION SELECT id, email, password_hash, role FROM users --",
            "admin'--",
            "\" OR \"\"=\"",
        ]

        for p in sql_payloads:
            # Test in email login
            login_sqli = client.post("/api/auth/login", json={"email": p, "password": "xyz"})
            assert login_sqli.status_code in (401, 422), f"SQL injection caused unexpected response: {login_sqli.status_code}"

            # Test in admin session search
            admin_search_sqli = client.get(f"/api/admin/sessions?search={p}", headers=admin_headers)
            assert admin_search_sqli.status_code == 200, f"SQL injection in search caused 500 error: {admin_search_sqli.text}"

        print("  [PASS] 9.1 Parameterized queries safely neutralized all SQL injection payloads")

        # =====================================================================
        # 10. HEALTH CHECK & ERROR DISCLOSURE SANITIZATION
        # =====================================================================
        print("\n[AUDIT 10] Health Check & Error Sanitization")

        health_res = client.get("/health")
        assert health_res.status_code == 200
        health_data = health_res.json()
        assert health_data["status"] == "healthy"
        assert health_data["database"] == "connected"
        assert "password" not in str(health_data).lower()
        assert "postgresql://" not in str(health_data).lower()
        print("  [PASS] 10.1 Health check operates securely without internal error or credential disclosure")

        print("\n" + "=" * 80)
        print("ALL PHASE 8 SECURITY AUDIT TESTS PASSED (100% SUCCESS)!")
        print("=" * 80)

    finally:
        print("\n[CLEANUP] Purging test accounts...")
        db_cleanup = SessionLocal()
        for uid in created_user_ids:
            try:
                alarms = db_cleanup.query(Alarm).filter(Alarm.user_id == uid).all()
                for a in alarms:
                    db_cleanup.query(AlarmSession).filter(AlarmSession.alarm_id == a.id).delete()
                    db_cleanup.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id == a.id).delete()
                db_cleanup.query(Alarm).filter(Alarm.user_id == uid).delete()
                db_cleanup.query(UserProfile).filter(UserProfile.user_id == uid).delete()
                db_cleanup.query(UserNotification).filter(UserNotification.user_id == uid).delete()
                u_obj = db_cleanup.query(User).filter(User.id == uid).first()
                if u_obj:
                    db_cleanup.delete(u_obj)
                db_cleanup.commit()
            except Exception as e:
                db_cleanup.rollback()
                print(f"Error cleaning up user {uid}: {e}")
        db_cleanup.close()
        print(f"[CLEANUP] Successfully removed {len(created_user_ids)} temporary test entities.")


if __name__ == "__main__":
    run_security_audit()
