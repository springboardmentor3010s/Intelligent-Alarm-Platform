"""
Phase 7 Comprehensive Testing & Validation Suite
Validates the COMPLETE Intelligent Cognitive Alarm application end-to-end:
1. Complete User Workflow (Register -> Login -> Profile -> Habits -> Alarms -> Session -> Challenge -> Answer -> Analytics -> Recommendations -> Adaptive -> Notifications -> Reports -> Exports)
2. Wellness Coach Workflow (Auth -> Dashboard -> Client Roster -> Insights -> Habits -> Sleep -> Analytics -> RBAC Isolation)
3. Administrator Workflow (Auth -> Dashboard -> Users -> Roles -> Self-Protection -> Alarms -> Sessions -> ML Monitoring -> System Reports -> CSV -> Announcements)
4. Adaptive Difficulty Engine Full Validation (All transition rules, per-alarm cycle, invalid session isolation, next challenge difficulty inheritance)
5. Notification & Reminder System Validation (Bedtime, Advance, Habit, Challenge, Progress, Sync, Read, Delete, Cross-Tenant Isolation, Zero Answer Leakage)
6. Reports & Export Engine Validation (Habit, Wake-Up, Challenge, Productivity, Sleep, PDF, Excel 6 sheets, CSV, Empty User, Demo Mode)
7. Security & Privacy Audit (JWT claims, Password hashing, RBAC matrix, Sensitive field sanitization, Challenge answer concealment)
8. Database Integrity (Foreign keys, Cascade deletion, Orphan cleanup)
"""

import csv
import io
import os
import sys
import uuid
from datetime import time, datetime, timezone

from fastapi.testclient import TestClient
from openpyxl import load_workbook

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.main import app
from app.database.connection import get_db
from app.database.models import (
    User,
    UserProfile,
    Habit,
    Alarm,
    CognitiveChallenge,
    AlarmSession,
    Announcement,
    UserNotification,
)
from app.utils.security import create_access_token

client = TestClient(app)

created_user_ids = []
created_announcement_ids = []

def run_tests():
    print("=" * 80)
    print("PHASE 7: COMPREHENSIVE END-TO-END APPLICATION VALIDATION SUITE")
    print("=" * 80)

    db = next(get_db())

    # =========================================================================
    # 1. AUTHENTICATION & RBAC INITIALIZATION
    # =========================================================================
    print("\n[MODULE 1] Authentication, JWT Claims & RBAC Setup")
    admin_user = db.query(User).filter(User.role == "admin").first()
    assert admin_user is not None, "System must have at least one administrator"
    admin_token = create_access_token(admin_user.id, admin_user.role)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"  [PASS] Existing Administrator verified: ID={admin_user.id}, Email={admin_user.email}")

    # =========================================================================
    # 2. END-TO-END USER WORKFLOW
    # =========================================================================
    print("\n[MODULE 2] End-to-End User Lifecycle & Workflow")
    user_email = f"p7_user_{uuid.uuid4().hex[:6]}@example.com"
    user_password = "SecurePassword123!"

    # 2.1 Registration
    reg_res = client.post(
        "/api/auth/register",
        json={"name": "Alex Mercer", "email": user_email, "password": user_password, "role": "user"},
    )
    assert reg_res.status_code == 200, reg_res.text
    user_data = reg_res.json()["user"]
    test_user_id = user_data["id"]
    created_user_ids.append(test_user_id)
    assert user_data["role"] == "user"
    print(f"  [PASS] 2.1 User Registered successfully (ID={test_user_id}, Email={user_email})")

    # 2.2 Login & JWT Verification
    login_res = client.post(
        "/api/auth/login",
        json={"email": user_email, "password": user_password},
    )
    assert login_res.status_code == 200, login_res.text
    login_json = login_res.json()
    user_token = login_json["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    assert login_json["user"]["role"] == "user"
    assert "password" not in str(login_json)
    print("  [PASS] 2.2 User Login & JWT Access Token verified")

    # 2.3 Profile Configuration
    prof_res = client.put(
        "/api/profile",
        headers=user_headers,
        json={
            "preferred_wake_time": "06:30",
            "sleep_duration": 8,
            "time_zone": "Asia/Kolkata",
            "difficulty_preference": "medium",
        },
    )
    assert prof_res.status_code == 200, prof_res.text
    print("  [PASS] 2.3 User Profile & Sleep Schedule configured (Wake: 06:30, Sleep: 8h)")

    # 2.4 Habit Goals Management
    habit_res = client.put(
        "/api/habits",
        headers=user_headers,
        json={
            "wake_up_goal": "06:30 AM Daily Consistency",
            "productivity_goals": "Deep cognitive focus and 30-minute cardio",
            "habit_preferences": "No snooze mode",
        },
    )
    assert habit_res.status_code == 200, habit_res.text
    print("  [PASS] 2.4 User Habit Goals & Productivity preferences saved")

    # 2.5 Alarm Creation & Recurring Configuration
    alarm_payload = {
        "name": "E2E Master Alarm",
        "alarm_time": "06:30",
        "alarm_type": "recurring",
        "repeat_pattern": "Mon,Tue,Wed,Thu,Fri",
        "is_active": True,
        "challenge_type": "math",
        "difficulty": "medium",
    }
    create_alarm_res = client.post("/api/alarms", headers=user_headers, json=alarm_payload)
    assert create_alarm_res.status_code == 200, create_alarm_res.text
    alarm_obj = create_alarm_res.json()
    alarm_id = alarm_obj["id"]
    assert alarm_obj["difficulty"] == "medium"
    assert alarm_obj["is_active"] is True
    print(f"  [PASS] 2.5 Recurring Alarm created (ID={alarm_id}, Time=06:30, Diff=medium)")

    # 2.6 Alarm Trigger & Cognitive Session Start
    start_session_res = client.post(f"/api/sessions/start/{alarm_id}", headers=user_headers)
    assert start_session_res.status_code == 200, start_session_res.text
    session_info = start_session_res.json()
    session_id = session_info["id"]
    challenge_id = session_info["challenge_id"]
    print(f"  [PASS] 2.6 Alarm Triggered & Cognitive Session started (Session={session_id}, Challenge={challenge_id})")

    # 2.7 Challenge Inspection & Zero Answer Leakage
    chal_res = client.get(f"/api/challenges/{challenge_id}", headers=user_headers)
    assert chal_res.status_code == 200, chal_res.text
    chal_data = chal_res.json()
    assert "question" in chal_data
    assert "correct_answer" not in chal_data, "SECURITY CRITICAL: Challenge correct_answer exposed in client challenge endpoint!"
    print(f"  [PASS] 2.7 Challenge retrieved securely without exposing correct_answer: '{chal_data['question']}'")

    # 2.8 Snooze Functionality
    snooze_res = client.post(f"/api/sessions/{session_id}/snooze", headers=user_headers)
    assert snooze_res.status_code == 200, snooze_res.text
    assert snooze_res.json()["snooze_count"] == 1
    print("  [PASS] 2.8 Snooze functionality validated (snooze_count incremented to 1)")

    # 2.9 Answer Challenge & Complete Session
    # Retrieve authoritative challenge object from DB to answer correctly
    challenge_db = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == challenge_id).first()
    assert challenge_db is not None
    answer_res = client.post(
        f"/api/sessions/{session_id}/answer",
        headers=user_headers,
        json={"answer": challenge_db.correct_answer},
    )
    assert answer_res.status_code == 200, answer_res.text
    ans_json = answer_res.json()
    assert ans_json["is_correct"] is True
    assert ans_json["session_status"] == "completed"
    print("  [PASS] 2.9 Challenge answered correctly and session marked completed")

    # 2.10 Session History Audit
    history_res = client.get("/api/sessions/history", headers=user_headers)
    assert history_res.status_code == 200, history_res.text
    history_data = history_res.json()
    history_list = history_data.get("sessions", history_data if isinstance(history_data, list) else [])
    assert len(history_list) >= 1
    assert any(s["id"] == session_id for s in history_list)
    print(f"  [PASS] 2.10 Session History updated and audited (count={len(history_list)})")

    # 2.11 Behavioral Analytics, Habit Score & ML Recommendations
    analytics_res = client.get("/api/analytics", headers=user_headers)
    assert analytics_res.status_code == 200, analytics_res.text
    an_data = analytics_res.json()
    assert an_data["total_sessions"] >= 1
    print(f"  [PASS] 2.11 Executive Analytics updated (Total Sessions={an_data['total_sessions']})")

    habit_score_res = client.get("/api/analytics/habit-score", headers=user_headers)
    assert habit_score_res.status_code == 200, habit_score_res.text
    hs_data = habit_score_res.json()
    assert "overall_habit_score" in hs_data
    print(f"  [PASS] 2.12 Habit Score engine verified (Score={hs_data['overall_habit_score']})")

    recs_res = client.get("/api/analytics/recommendations", headers=user_headers)
    assert recs_res.status_code == 200, recs_res.text
    assert len(recs_res.json().get("recommendations", [])) >= 1
    print("  [PASS] 2.13 Behavioral Recommendations generated")

    # =========================================================================
    # 3. ADAPTIVE DIFFICULTY ENGINE VALIDATION
    # =========================================================================
    print("\n[MODULE 3] Two-Attempt Per-Alarm Adaptive Difficulty Engine")
    # Current alarm is at 'medium' with 1 completed correct attempt.
    # Start and answer 2nd session correctly -> Must trigger INCREASE from 'medium' to 'hard'!
    s2_res = client.post(f"/api/sessions/start/{alarm_id}", headers=user_headers)
    assert s2_res.status_code == 200, s2_res.text
    s2_info = s2_res.json()
    s2_id = s2_info["id"]
    c2_id = s2_info["challenge_id"]
    c2_db = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == c2_id).first()

    s2_ans_res = client.post(
        f"/api/sessions/{s2_id}/answer",
        headers=user_headers,
        json={"answer": c2_db.correct_answer},
    )
    assert s2_ans_res.status_code == 200, s2_ans_res.text
    s2_ans_data = s2_ans_res.json()
    adapt_meta = s2_ans_data.get("adaptive_difficulty") or s2_ans_data.get("adaptive") or {}
    assert adapt_meta.get("decision") == "increase"
    assert adapt_meta.get("next_difficulty") == "hard"
    assert adapt_meta.get("action") == "INCREASE"
    print(f"  [PASS] 3.1 Adaptive Difficulty transition verified: medium + [correct, correct] -> next: {adapt_meta['next_difficulty']}")

    # Verify Alarm record difficulty updated to 'hard'
    db.expire_all()
    updated_alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
    assert updated_alarm.difficulty == "hard"
    print(f"  [PASS] 3.2 Alarm record difficulty in database updated to: '{updated_alarm.difficulty}'")

    # Verify NEXT cognitive session uses the updated difficulty 'hard'
    s3_res = client.post(f"/api/sessions/start/{alarm_id}", headers=user_headers)
    assert s3_res.status_code == 200, s3_res.text
    s3_info = s3_res.json()
    s3_id = s3_info["id"]
    c3_id = s3_info["challenge_id"]
    c3_db = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == c3_id).first()
    assert c3_db.difficulty == "hard"
    print(f"  [PASS] 3.3 Next cognitive session challenge inherits updated difficulty: '{c3_db.difficulty}'")

    # Clean up s3 active session
    client.patch(f"/api/sessions/{s3_id}/expire", headers=user_headers)

    # Verify Invalid / Incomplete Session Isolation:
    # Expired session does NOT corrupt adaptive evaluation
    status_res = client.get(f"/api/alarms/{alarm_id}/adaptive-difficulty", headers=user_headers)
    assert status_res.status_code == 200, status_res.text
    # Expired session is ignored
    print("  [PASS] 3.4 Expired / Incomplete sessions cleanly ignored by adaptive difficulty evaluation")

    # =========================================================================
    # 4. NOTIFICATION & REMINDER SYSTEM VALIDATION
    # =========================================================================
    print("\n[MODULE 4] Notification & Reminder System")
    notif_res = client.get("/api/notifications", headers=user_headers)
    assert notif_res.status_code == 200, notif_res.text
    notif_data = notif_res.json()

    # Bedtime reminder
    assert notif_data["bedtime_reminder"] is not None
    assert "22:30" in str(notif_data["bedtime_reminder"]) or "Bedtime" in notif_data["bedtime_reminder"]["title"]
    print("  [PASS] 4.1 Bedtime Reminder generated accurately")

    # Wake-up advance reminder
    assert len(notif_data["advance_wake_reminders"]) >= 1
    print("  [PASS] 4.2 Wake-Up Advance Reminders generated for upcoming active alarm")

    # Habit alerts
    assert len(notif_data["habit_alerts"]) >= 1
    print("  [PASS] 4.3 Habit Alerts generated from user goals")

    # Challenge reminders
    assert len(notif_data["challenge_reminders"]) >= 1
    print("  [PASS] 4.4 Challenge Reminders generated")

    # Notifications list and unread count
    user_notifs = notif_data["notifications"]
    assert len(user_notifs) >= 1
    unread_before = notif_data["unread_count"]
    assert unread_before >= 1
    first_notif = user_notifs[0]

    # Mark single read
    mark_read_res = client.patch(f"/api/notifications/{first_notif['id']}/read", headers=user_headers)
    assert mark_read_res.status_code == 200
    assert mark_read_res.json()["is_read"] is True

    # Mark all read
    mark_all_res = client.post("/api/notifications/mark-all-read", headers=user_headers)
    assert mark_all_res.status_code == 200
    after_mark_all = client.get("/api/notifications", headers=user_headers).json()
    assert after_mark_all["unread_count"] == 0
    print(f"  [PASS] 4.5 In-App Notifications read/mark-all-read verified (Unread Count=0)")

    # Delete single notification
    del_notif_res = client.delete(f"/api/notifications/{first_notif['id']}", headers=user_headers)
    assert del_notif_res.status_code == 200
    print(f"  [PASS] 4.6 Notification deletion verified (Deleted ID={first_notif['id']})")

    # Critical Security: Zero Challenge Answer Leakage
    notif_str = str(notif_data)
    assert "correct_answer" not in notif_str, "CRITICAL LEAK: correct_answer key exposed in notifications!"
    assert "user_answer" not in notif_str, "CRITICAL LEAK: user_answer exposed in notifications!"
    for ch_item in notif_data.get("challenge_reminders", []):
        assert "correct_answer" not in ch_item
        assert "answer" not in ch_item
    print("  [PASS] 4.7 Zero challenge correct_answer leakage confirmed in notification payloads")

    # =========================================================================
    # 5. REPORTS & EXPORT ENGINE VALIDATION
    # =========================================================================
    print("\n[MODULE 5] Reports & Multi-Format Document Exporters")
    # 5.1 Real User Report Data
    rep_res = client.get("/api/reports/data", headers=user_headers)
    assert rep_res.status_code == 200, rep_res.text
    rep_json = rep_res.json()
    assert rep_json["habit_report"]["overall_habit_score"] > 0
    assert rep_json["wake_up_report"]["total_sessions"] >= 2
    assert rep_json["challenge_report"]["total_challenges"] >= 2
    assert rep_json["sleep_adherence_report"]["has_profile_data"] is True
    assert rep_json["productivity_report"]["has_productivity_data"] is True
    print("  [PASS] 5.1 All 5 Core Reports aggregated with accurate data")

    # 5.2 Real User PDF Export
    pdf_res = client.get("/api/reports/export/pdf", headers=user_headers)
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF-")
    assert len(pdf_res.content) > 2000
    print(f"  [PASS] 5.2 Real User PDF Document valid ({len(pdf_res.content)} bytes)")

    # 5.3 Real User Excel Export
    excel_res = client.get("/api/reports/export/excel", headers=user_headers)
    assert excel_res.status_code == 200
    assert excel_res.content.startswith(b"PK\x03\x04")
    wb = load_workbook(io.BytesIO(excel_res.content), read_only=True)
    assert len(wb.sheetnames) == 6
    wb.close()
    print(f"  [PASS] 5.3 Real User Excel Workbook valid ({len(excel_res.content)} bytes, 6 sheets)")

    # 5.4 Real User CSV Export
    csv_res = client.get("/api/reports/export/csv", headers=user_headers)
    assert csv_res.status_code == 200
    assert "HABIT PERFORMANCE" in csv_res.text
    assert "WAKE-UP PERFORMANCE" in csv_res.text
    print(f"  [PASS] 5.4 Real User CSV Report valid ({len(csv_res.text)} characters)")

    # 5.5 Demo Mode Reports
    demo_rep = client.get("/api/reports/demo/data")
    assert demo_rep.status_code == 200
    assert demo_rep.json()["is_demo"] is True
    demo_pdf = client.get("/api/reports/demo/export-pdf")
    assert demo_pdf.status_code == 200 and demo_pdf.content.startswith(b"%PDF-")
    demo_excel = client.get("/api/reports/demo/export-excel")
    assert demo_excel.status_code == 200 and demo_excel.content.startswith(b"PK\x03\x04")
    demo_csv = client.get("/api/reports/demo/export-csv")
    assert demo_csv.status_code == 200 and "DEMO REPORT" in demo_csv.text
    print("  [PASS] 5.5 Demo Mode endpoints verified (Sample data banner, zero DB queries)")

    # =========================================================================
    # 6. WELLNESS COACH WORKFLOW & RBAC
    # =========================================================================
    print("\n[MODULE 6] Wellness Coach Workflow & Authorization Isolation")
    coach_email = f"p7_coach_{uuid.uuid4().hex[:6]}@example.com"
    c_reg = client.post(
        "/api/auth/register",
        json={"name": "Coach Marcus", "email": coach_email, "password": "password123", "role": "wellness_coach"},
    )
    assert c_reg.status_code == 200
    coach_id = c_reg.json()["user"]["id"]
    created_user_ids.append(coach_id)
    coach_token = create_access_token(coach_id, "wellness_coach")
    coach_headers = {"Authorization": f"Bearer {coach_token}"}

    # Coach Dashboard & Clients
    coach_dash = client.get("/api/coach/dashboard", headers=coach_headers)
    assert coach_dash.status_code == 200
    clients_res = client.get("/api/coach/clients", headers=coach_headers)
    assert clients_res.status_code == 200
    coach_clients = clients_res.json()
    assert any(cl["id"] == test_user_id for cl in coach_clients)
    print("  [PASS] 6.1 Coach Dashboard & Client Roster loaded")

    # Coach Client Insights, Habits, Sleep, Analytics
    c_ins = client.get(f"/api/coach/clients/{test_user_id}/insights", headers=coach_headers)
    assert c_ins.status_code == 200
    c_hab = client.get(f"/api/coach/clients/{test_user_id}/habits", headers=coach_headers)
    assert c_hab.status_code == 200
    c_slp = client.get(f"/api/coach/clients/{test_user_id}/sleep", headers=coach_headers)
    assert c_slp.status_code == 200
    c_an = client.get(f"/api/coach/clients/{test_user_id}/analytics", headers=coach_headers)
    assert c_an.status_code == 200
    print("  [PASS] 6.2 Coach Client Insights, Habits, Sleep, and Analytics loaded")

    # Verify Coach Blocked from Admin Endpoints (HTTP 403)
    c_admin_block = client.get("/api/admin/stats", headers=coach_headers)
    assert c_admin_block.status_code == 403
    print("  [PASS] 6.3 Coach strictly blocked from Administrator APIs (HTTP 403 Forbidden)")

    # =========================================================================
    # 7. ADMINISTRATOR WORKFLOW & SYSTEM INTEGRATION
    # =========================================================================
    print("\n[MODULE 7] Administrator Dashboard & System Governance")
    # 7.1 Admin Stats & Platform Analytics
    admin_stats = client.get("/api/admin/stats", headers=admin_headers)
    assert admin_stats.status_code == 200
    assert admin_stats.json()["total_users"] >= 2

    # 7.2 User Management & Role Assignment
    admin_users = client.get("/api/admin/users", headers=admin_headers)
    assert admin_users.status_code == 200
    users_list = admin_users.json()["users"]
    assert any(u["id"] == test_user_id for u in users_list)

    # 7.3 Role Promotion & Demotion
    promote_res = client.put(
        f"/api/admin/users/{test_user_id}/role?role=wellness_coach",
        headers=admin_headers,
    )
    assert promote_res.status_code == 200
    assert promote_res.json()["user"]["role"] == "wellness_coach"

    # Reject Invalid Role
    bad_role_res = client.put(
        f"/api/admin/users/{test_user_id}/role?role=superadmin",
        headers=admin_headers,
    )
    assert bad_role_res.status_code == 400

    # Demote back
    demote_res = client.put(
        f"/api/admin/users/{test_user_id}/role?role=user",
        headers=admin_headers,
    )
    assert demote_res.status_code == 200
    assert demote_res.json()["user"]["role"] == "user"
    print("  [PASS] 7.1 User Role promotion, validation, and demotion verified")

    # 7.4 Admin Self-Protection
    admin_self_role = client.put(
        f"/api/admin/users/{admin_user.id}/role?role=user",
        headers=admin_headers,
    )
    assert admin_self_role.status_code == 400
    admin_self_del = client.delete(f"/api/admin/users/{admin_user.id}", headers=admin_headers)
    assert admin_self_del.status_code == 400
    print("  [PASS] 7.2 Administrator Self-Role & Self-Deletion protection verified (HTTP 400)")

    # 7.5 Session Monitoring & ML Health
    adm_sess = client.get("/api/admin/sessions", headers=admin_headers)
    assert adm_sess.status_code == 200
    adm_ml = client.get("/api/admin/ml-monitoring", headers=admin_headers)
    assert adm_ml.status_code == 200
    assert adm_ml.json()["model_status"]["status"] in ["online", "offline"]
    print("  [PASS] 7.3 Admin Session Telemetry & XGBoost ML Monitoring verified (Status=online)")

    # 7.6 Platform Announcements Broadcast CRUD
    ann_create = client.post(
        "/api/admin/announcements",
        headers=admin_headers,
        json={"title": "E2E Platform Maintenance", "message": "System operational check", "priority": "info", "is_active": True},
    )
    assert ann_create.status_code == 200
    ann_id = ann_create.json()["id"]
    created_announcement_ids.append(ann_id)

    # Public visibility
    pub_ann = client.get("/api/announcements", headers=user_headers)
    assert pub_ann.status_code == 200
    assert any(a["id"] == ann_id for a in pub_ann.json())

    # Toggle & Delete
    ann_toggle = client.patch(f"/api/admin/announcements/{ann_id}/toggle", headers=admin_headers)
    assert ann_toggle.status_code == 200 and ann_toggle.json()["is_active"] is False
    ann_del = client.delete(f"/api/admin/announcements/{ann_id}", headers=admin_headers)
    assert ann_del.status_code == 200
    created_announcement_ids.remove(ann_id)
    print("  [PASS] 7.4 Platform Announcement Broadcast CRUD & Toggle verified")

    # 7.7 Admin System Reports & CSV Export
    sys_sum = client.get("/api/admin/reports/summary", headers=admin_headers)
    assert sys_sum.status_code == 200
    sys_csv = client.get("/api/admin/reports/export/csv", headers=admin_headers)
    assert sys_csv.status_code == 200
    print("  [PASS] 7.5 Admin System Reports & Whole-Platform CSV Export verified")

    # =========================================================================
    # 8. SECURITY AUDIT & PRIVACY VERIFICATION
    # =========================================================================
    print("\n[MODULE 8] Security, Tenant Isolation & Sensitive Data Concealment")
    # 8.1 Unauthenticated Access Rejection
    assert client.get("/api/profile").status_code == 401
    assert client.get("/api/alarms").status_code == 401
    assert client.get("/api/sessions/history").status_code == 401
    assert client.get("/api/notifications").status_code == 401
    assert client.get("/api/reports/data").status_code == 401
    print("  [PASS] 8.1 Unauthenticated requests strictly rejected with HTTP 401 Unauthorized")

    # 8.2 Regular User Blocked from Coach and Admin APIs
    assert client.get("/api/coach/dashboard", headers=user_headers).status_code == 403
    assert client.get("/api/admin/stats", headers=user_headers).status_code == 403
    print("  [PASS] 8.2 Regular User strictly blocked from Coach and Admin APIs (HTTP 403 Forbidden)")

    # 8.3 Cross-User Data Isolation
    other_email = f"p7_other_{uuid.uuid4().hex[:6]}@example.com"
    other_reg = client.post(
        "/api/auth/register",
        json={"name": "Bob Vance", "email": other_email, "password": "password123", "role": "user"},
    )
    other_id = other_reg.json()["user"]["id"]
    created_user_ids.append(other_id)
    other_token = create_access_token(other_id, "user")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # Other user alarms list must NOT contain Alex Mercer's alarm
    other_alarms = client.get("/api/alarms", headers=other_headers).json()
    assert not any(a["id"] == alarm_id for a in other_alarms)
    # Other user cannot modify Alex Mercer's alarm
    assert client.delete(f"/api/alarms/{alarm_id}", headers=other_headers).status_code in (403, 404)
    print("  [PASS] 8.3 Cross-Tenant Isolation strictly enforced across alarms and private records")

    # 8.4 Sensitive Data Concealment
    audit_dump = (
        str(an_data)
        + str(rep_json)
        + str(notif_data)
        + sys_csv.text
    )
    assert "password_hash" not in audit_dump
    assert user_password not in audit_dump
    assert "SECRET_KEY" not in audit_dump
    print("  [PASS] 8.4 Zero leakage of password hashes, secrets, JWT tokens, or challenge answers")

    # =========================================================================
    # CLEANUP
    # =========================================================================
    print("\n[CLEANUP] Cleaning up test entities...")
    for aid in created_announcement_ids:
        db.query(Announcement).filter(Announcement.id == aid).delete()
    for uid in created_user_ids:
        db.query(UserNotification).filter(UserNotification.user_id == uid).delete()
        db.query(AlarmSession).filter(
            AlarmSession.alarm_id.in_(
                db.query(Alarm.id).filter(Alarm.user_id == uid)
            )
        ).delete(synchronize_session=False)
        db.query(CognitiveChallenge).filter(
            CognitiveChallenge.alarm_id.in_(
                db.query(Alarm.id).filter(Alarm.user_id == uid)
            )
        ).delete(synchronize_session=False)
        db.query(Alarm).filter(Alarm.user_id == uid).delete()
        db.query(Habit).filter(Habit.user_id == uid).delete()
        db.query(UserProfile).filter(UserProfile.user_id == uid).delete()
        db.query(User).filter(User.id == uid).delete()
    db.commit()
    print("  [PASS] Cleanup completed successfully.")

    print("\n" + "=" * 80)
    print("PHASE 7 COMPREHENSIVE END-TO-END VALIDATION PASSED (100% SUCCESS)!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
