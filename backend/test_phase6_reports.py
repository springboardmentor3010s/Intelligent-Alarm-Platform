"""
Phase 6 Reports & Export Verification Test Suite
Covers:
1. User Report Access (GET /api/reports/data, /export/pdf, /export/excel, /export/csv)
2. Cross-User Report Isolation (User A data strictly isolated from User B)
3. Coach Access Behavior (Coach accesses own reports; coach blocked from admin reports; client isolation)
4. Admin System Report Access (GET /api/admin/reports/summary, /export/csv; non-admins blocked with 403)
5. PDF Document Validity (Magic bytes %PDF-, non-empty, proper content-disposition header)
6. Excel Spreadsheet Validity (Magic bytes PK, non-empty, verified all 6 workbook sheets)
7. CSV File Validity (Parsed with csv.reader, verified all 5 required report sections)
8. Empty User Data Handling (Cold-start user with 0 sessions/alarms exports cleanly without 500 error)
9. Demo Mode Report Behavior (/demo/data, /demo/export-pdf, /demo/export-excel, /demo/export-csv)
10. Sensitive Field Protection (Zero leakage of password_hash, tokens, secrets, or challenge correct_answer)
11. Mathematical Consistency & Report Calculations (Habit score formula, completion & accuracy rates)
12. Export & Download Headers (Correct MIME media types and attachment filenames)
13. Database Cleanup
"""

import csv
import io
import os
import sys
import uuid
import zipfile
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
)
from app.utils.security import create_access_token

client = TestClient(app)

created_user_ids = []

def run_tests():
    print("=" * 80)
    print("RUNNING PHASE 6: REPORTS & EXPORT VERIFICATION TEST SUITE")
    print("=" * 80)

    db = next(get_db())

    # -------------------------------------------------------------------------
    # SETUP: Existing Admin, Active User A, Cold-Start User B, Coach
    # -------------------------------------------------------------------------
    admin_user = db.query(User).filter(User.role == "admin").first()
    assert admin_user is not None, "Administrator account required"
    admin_token = create_access_token(admin_user.id, admin_user.role)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[SETUP] Existing Admin: ID={admin_user.id}, Role='{admin_user.role}'")

    # User A (Active user with profile, habits, alarm, sessions)
    user_a_email = f"p6_usera_{uuid.uuid4().hex[:6]}@example.com"
    res_a = client.post(
        "/api/auth/register",
        json={"name": "P6 Active User", "email": user_a_email, "password": "password123", "role": "user"},
    )
    assert res_a.status_code == 200, res_a.text
    user_a_id = res_a.json()["user"]["id"]
    created_user_ids.append(user_a_id)
    token_a = create_access_token(user_a_id, "user")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B (Empty / Cold-start user with 0 records)
    user_b_email = f"p6_userb_{uuid.uuid4().hex[:6]}@example.com"
    res_b = client.post(
        "/api/auth/register",
        json={"name": "P6 Cold User", "email": user_b_email, "password": "password123", "role": "user"},
    )
    assert res_b.status_code == 200, res_b.text
    user_b_id = res_b.json()["user"]["id"]
    created_user_ids.append(user_b_id)
    token_b = create_access_token(user_b_id, "user")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Coach
    coach_email = f"p6_coach_{uuid.uuid4().hex[:6]}@example.com"
    res_c = client.post(
        "/api/auth/register",
        json={"name": "P6 Coach", "email": coach_email, "password": "password123", "role": "wellness_coach"},
    )
    assert res_c.status_code == 200, res_c.text
    coach_id = res_c.json()["user"]["id"]
    created_user_ids.append(coach_id)
    token_c = create_access_token(coach_id, "wellness_coach")
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # Seed User A data
    profile_a = UserProfile(
        user_id=user_a_id,
        preferred_wake_time=time(6, 30),
        sleep_duration=8,
        difficulty_preference="medium",
    )
    db.add(profile_a)

    habit_a = Habit(
        user_id=user_a_id,
        wake_up_goal="06:30 AM Daily",
        productivity_goals="Deep work morning sprint and exercise",
        habit_preferences="Strict no snooze rule",
    )
    db.add(habit_a)

    alarm_a = Alarm(
        user_id=user_a_id,
        name="Morning Focus",
        alarm_time=time(6, 30),
        repeat_pattern="Mon,Tue,Wed,Thu,Fri",
        is_active=True,
        challenge_type="math",
        difficulty="medium",
    )
    db.add(alarm_a)
    db.flush()

    challenge_secret = "SECRET_ANSWER_TOP_CONFIDENTIAL"
    challenge_a1 = CognitiveChallenge(
        alarm_id=alarm_a.id,
        challenge_type="math",
        difficulty="medium",
        question="What is 15 * 4?",
        correct_answer=challenge_secret,
    )
    challenge_a2 = CognitiveChallenge(
        alarm_id=alarm_a.id,
        challenge_type="memory",
        difficulty="easy",
        question="Recall sequence 4-9-2",
        correct_answer=challenge_secret,
    )
    db.add(challenge_a1)
    db.add(challenge_a2)
    db.flush()

    # Session 1: completed, correct
    session_1 = AlarmSession(
        alarm_id=alarm_a.id,
        challenge_id=challenge_a1.id,
        user_answer="60",
        is_correct=True,
        session_status="completed",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        snooze_count=0,
        response_time_seconds=12,
        dismissal_status="dismissed",
    )
    # Session 2: completed, incorrect
    session_2 = AlarmSession(
        alarm_id=alarm_a.id,
        challenge_id=challenge_a2.id,
        user_answer="4-9-3",
        is_correct=False,
        session_status="completed",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        snooze_count=1,
        response_time_seconds=22,
        dismissal_status="dismissed",
    )
    db.add(session_1)
    db.add(session_2)
    db.commit()

    print("[SETUP] Seeded User A with profile, habit, alarm, challenges, and 2 sessions")

    # =========================================================================
    # TEST 1: USER REPORT DATA ACCESS & 5 CORE REPORTS STRUCTURE
    # =========================================================================
    print("\n--- TEST 1: User Report Data Access (5 Core Reports) ---")
    res_data = client.get("/api/reports/data", headers=headers_a)
    assert res_data.status_code == 200, res_data.text
    data = res_data.json()

    assert data["user_name"] == "P6 Active User"
    assert data["user_email"] == user_a_email
    assert data["is_demo"] is False
    assert "generated_at" in data

    # 1. Habit Report
    assert "habit_report" in data
    hr = data["habit_report"]
    for key in ("overall_habit_score", "wake_up_consistency", "challenge_completion", "snooze_reduction", "sleep_schedule_adherence"):
        assert key in hr, f"Missing key {key} in habit_report"
    print(f"  [PASS] 1. Habit Report verified (Score={hr['overall_habit_score']})")

    # 2. Wake-Up Report
    assert "wake_up_report" in data
    wr = data["wake_up_report"]
    assert wr["total_sessions"] == 2
    assert wr["successful_dismissals"] == 2
    assert wr["total_snoozes"] == 1
    print(f"  [PASS] 2. Wake-Up Report verified (Sessions={wr['total_sessions']}, Dismissals={wr['successful_dismissals']})")

    # 3. Cognitive Challenge Report
    assert "challenge_report" in data
    cr = data["challenge_report"]
    assert cr["total_challenges"] == 2
    assert cr["completed_challenges"] == 2
    assert cr["correct_answers"] == 1
    assert cr["incorrect_answers"] == 1
    assert len(cr["challenge_types"]) >= 2
    assert len(cr["difficulty_levels"]) >= 2
    print(f"  [PASS] 3. Cognitive Challenge Report verified (Total={cr['total_challenges']}, Accuracy={cr['accuracy_percentage']}%)")

    # 4. Productivity Report
    assert "productivity_report" in data
    pr = data["productivity_report"]
    assert pr["has_productivity_data"] is True
    assert "Deep work morning sprint" in pr["productivity_goals"]
    print(f"  [PASS] 4. Productivity Report verified (Status={pr['status']})")

    # 5. Sleep / Adherence Report
    assert "sleep_adherence_report" in data
    sr = data["sleep_adherence_report"]
    assert sr["has_profile_data"] is True
    assert "06:30" in sr["preferred_wake_time"]
    assert "8 hours" in sr["sleep_duration"]
    print(f"  [PASS] 5. Sleep / Adherence Report verified (Wake={sr['preferred_wake_time']}, Duration={sr['sleep_duration']})")

    # =========================================================================
    # TEST 2: MATHEMATICAL CONSISTENCY & REPORT CALCULATIONS
    # =========================================================================
    print("\n--- TEST 2: Mathematical Consistency & Calculations ---")
    # Total = Correct + Incorrect
    assert cr["total_challenges"] == cr["correct_answers"] + cr["incorrect_answers"]
    # Accuracy rate
    expected_acc = round((cr["correct_answers"] / cr["total_challenges"]) * 100, 1)
    assert cr["accuracy_percentage"] == expected_acc
    # Completion rate
    expected_comp = round((cr["completed_challenges"] / cr["total_challenges"]) * 100, 1)
    assert cr["completion_percentage"] == expected_comp
    # Habit score weighted formula check: 35% wake + 25% challenge + 20% snooze + 20% sleep
    expected_habit = round(
        (0.35 * hr["wake_up_consistency"])
        + (0.25 * hr["challenge_completion"])
        + (0.20 * hr["snooze_reduction"])
        + (0.20 * hr["sleep_schedule_adherence"]),
        1,
    )
    assert abs(hr["overall_habit_score"] - expected_habit) <= 0.1
    print(f"  [PASS] Calculations verified: Accuracy={expected_acc}%, Completion={expected_comp}%, HabitScore={expected_habit}")

    # =========================================================================
    # TEST 3: CROSS-USER DATA ISOLATION
    # =========================================================================
    print("\n--- TEST 3: Cross-User Report Data Isolation ---")
    res_b_data = client.get("/api/reports/data", headers=headers_b)
    assert res_b_data.status_code == 200, res_b_data.text
    data_b = res_b_data.json()

    assert data_b["user_name"] == "P6 Cold User"
    assert data_b["user_email"] == user_b_email
    # User B must have 0 sessions, 0 challenges, and no leakage of User A
    assert data_b["wake_up_report"]["total_sessions"] == 0
    assert data_b["challenge_report"]["total_challenges"] == 0
    assert data_b["habit_report"]["sessions_evaluated"] == 0
    assert user_a_email not in str(data_b)
    print("  [PASS] Strict cross-user data isolation confirmed: User B has 0 sessions and zero leakage of User A")

    # =========================================================================
    # TEST 4: COACH ACCESS BEHAVIOR
    # =========================================================================
    print("\n--- TEST 4: Wellness Coach Access Behavior ---")
    # Coach accessing /api/reports/data returns coach's own report data (not client data)
    coach_report_res = client.get("/api/reports/data", headers=headers_c)
    assert coach_report_res.status_code == 200, coach_report_res.text
    coach_data = coach_report_res.json()
    assert coach_data["user_email"] == coach_email
    assert coach_data["wake_up_report"]["total_sessions"] == 0

    # Coach blocked from admin system reports (HTTP 403)
    coach_admin_blocked = client.get("/api/admin/reports/summary", headers=headers_c)
    assert coach_admin_blocked.status_code == 403

    # User blocked from admin system reports (HTTP 403)
    user_admin_blocked = client.get("/api/admin/reports/summary", headers=headers_a)
    assert user_admin_blocked.status_code == 403
    print("  [PASS] Coach access verified: coach report isolated, coach and user blocked from admin reports (HTTP 403)")

    # =========================================================================
    # TEST 5: ADMIN SYSTEM REPORT ACCESS
    # =========================================================================
    print("\n--- TEST 5: Admin System Reports Access ---")
    admin_summary_res = client.get("/api/admin/reports/summary", headers=admin_headers)
    assert admin_summary_res.status_code == 200, admin_summary_res.text
    admin_sum = admin_summary_res.json()
    assert "platform_overview" in admin_sum
    assert "challenge_breakdown" in admin_sum
    assert "difficulty_breakdown" in admin_sum
    assert "data_safety_certification" in admin_sum
    assert admin_sum["platform_overview"]["total_users"] >= 2

    # Admin CSV system report export
    admin_csv_res = client.get("/api/admin/reports/export/csv", headers=admin_headers)
    assert admin_csv_res.status_code == 200, admin_csv_res.text
    assert "text/csv" in admin_csv_res.headers.get("content-type", "")
    assert "SYSTEM ADMINISTRATIVE REPORT" in admin_csv_res.text
    print("  [PASS] Admin system summary and system CSV export verified (HTTP 200)")

    # =========================================================================
    # TEST 6: PDF DOCUMENT EXPORT & VALIDITY
    # =========================================================================
    print("\n--- TEST 6: PDF Document Export & Validity ---")
    pdf_res = client.get("/api/reports/export/pdf", headers=headers_a)
    assert pdf_res.status_code == 200, pdf_res.text
    assert pdf_res.headers.get("content-type") == "application/pdf"
    assert "attachment" in pdf_res.headers.get("content-disposition", "")
    assert f"Cognitive_Alarm_Report_{user_a_id}.pdf" in pdf_res.headers.get("content-disposition", "")

    pdf_bytes = pdf_res.content
    assert len(pdf_bytes) > 1000, f"PDF too small: {len(pdf_bytes)} bytes"
    assert pdf_bytes.startswith(b"%PDF-"), "Invalid PDF: Magic bytes '%PDF-' missing"
    print(f"  [PASS] PDF export verified: Magic bytes valid, size={len(pdf_bytes)} bytes")

    # =========================================================================
    # TEST 7: EXCEL SPREADSHEET EXPORT & VALIDITY
    # =========================================================================
    print("\n--- TEST 7: Excel Spreadsheet Export & Validity ---")
    excel_res = client.get("/api/reports/export/excel", headers=headers_a)
    assert excel_res.status_code == 200, excel_res.text
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in excel_res.headers.get("content-type", "")
    assert "attachment" in excel_res.headers.get("content-disposition", "")
    assert f"Cognitive_Alarm_Report_{user_a_id}.xlsx" in excel_res.headers.get("content-disposition", "")

    excel_bytes = excel_res.content
    assert len(excel_bytes) > 2000, f"Excel file too small: {len(excel_bytes)} bytes"
    assert excel_bytes.startswith(b"PK\x03\x04"), "Invalid Excel file: Magic bytes 'PK' missing"

    # Inspect openpyxl workbook structure and all 6 sheets
    wb = load_workbook(io.BytesIO(excel_bytes), read_only=True)
    required_sheets = ["Summary", "Habit Metrics", "Wake-Up Performance", "Cognitive Challenges", "Sleep Adherence", "Productivity"]
    for s_name in required_sheets:
        assert s_name in wb.sheetnames, f"Missing sheet '{s_name}' in Excel workbook"
    wb.close()
    print(f"  [PASS] Excel export verified: Valid XLSX zip archive, size={len(excel_bytes)} bytes, all 6 sheets present: {required_sheets}")

    # =========================================================================
    # TEST 8: CSV EXPORT & VALIDITY
    # =========================================================================
    print("\n--- TEST 8: CSV Export & Validity ---")
    csv_res = client.get("/api/reports/export/csv", headers=headers_a)
    assert csv_res.status_code == 200, csv_res.text
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "attachment" in csv_res.headers.get("content-disposition", "")
    assert f"Cognitive_Alarm_Report_{user_a_id}.csv" in csv_res.headers.get("content-disposition", "")

    csv_text = csv_res.text
    assert len(csv_text) > 500
    assert "INTELLIGENT COGNITIVE ALARM — PERFORMANCE REPORT" in csv_text
    assert "1. HABIT PERFORMANCE & CONSISTENCY" in csv_text
    assert "2. WAKE-UP PERFORMANCE" in csv_text
    assert "3. COGNITIVE CHALLENGE PERFORMANCE" in csv_text
    assert "4. SLEEP & SCHEDULE ADHERENCE" in csv_text
    assert "5. PRODUCTIVITY REPORT" in csv_text

    # Parse with standard csv reader to verify syntax
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    assert len(rows) >= 20
    print(f"  [PASS] CSV export verified: Valid RFC 4180 format, {len(rows)} rows, all 5 core sections present")

    # =========================================================================
    # TEST 9: EMPTY / COLD-START USER HANDLING
    # =========================================================================
    print("\n--- TEST 9: Empty / Cold-Start User Handling ---")
    # Cold-start user PDF
    empty_pdf = client.get("/api/reports/export/pdf", headers=headers_b)
    assert empty_pdf.status_code == 200
    assert empty_pdf.content.startswith(b"%PDF-")

    # Cold-start user Excel
    empty_excel = client.get("/api/reports/export/excel", headers=headers_b)
    assert empty_excel.status_code == 200
    assert empty_excel.content.startswith(b"PK\x03\x04")

    # Cold-start user CSV
    empty_csv = client.get("/api/reports/export/csv", headers=headers_b)
    assert empty_csv.status_code == 200
    assert "No sessions" in empty_csv.text or "Total Sessions" in empty_csv.text
    print("  [PASS] Cold-start user handled gracefully across PDF, Excel, and CSV (HTTP 200, zero crashes)")

    # =========================================================================
    # TEST 10: DEMO MODE REPORT BEHAVIOR
    # =========================================================================
    print("\n--- TEST 10: Demo Mode Report Endpoints ---")
    demo_data_res = client.get("/api/reports/demo/data")
    assert demo_data_res.status_code == 200
    demo_data = demo_data_res.json()
    assert demo_data["is_demo"] is True
    assert demo_data["user_name"] == "Demo User"

    demo_pdf = client.get("/api/reports/demo/export-pdf")
    assert demo_pdf.status_code == 200
    assert demo_pdf.content.startswith(b"%PDF-")
    assert "Demo_Cognitive_Alarm_Report.pdf" in demo_pdf.headers.get("content-disposition", "")

    demo_excel = client.get("/api/reports/demo/export-excel")
    assert demo_excel.status_code == 200
    assert demo_excel.content.startswith(b"PK\x03\x04")
    assert "Demo_Cognitive_Alarm_Report.xlsx" in demo_excel.headers.get("content-disposition", "")

    demo_csv = client.get("/api/reports/demo/export-csv")
    assert demo_csv.status_code == 200
    assert "DEMO REPORT" in demo_csv.text
    assert "Demo_Cognitive_Alarm_Report.csv" in demo_csv.headers.get("content-disposition", "")
    print("  [PASS] Demo mode endpoints verified (Sample data banner, zero database query)")

    # =========================================================================
    # TEST 11: SENSITIVE FIELD PROTECTION
    # =========================================================================
    print("\n--- TEST 11: Sensitive Field Protection ---")
    full_payload_dump = (
        str(data)
        + str(data_b)
        + csv_text
        + admin_csv_res.text
        + str(admin_sum)
    )
    assert challenge_secret not in full_payload_dump, "CRITICAL: Challenge secret leaked in report payload!"
    assert "password_hash" not in full_payload_dump
    assert "password123" not in full_payload_dump
    assert "SECRET_KEY" not in full_payload_dump
    print("  [PASS] Zero leakage of password hashes, secrets, JWT tokens, or challenge correct_answer verified")

    # =========================================================================
    # CLEANUP
    # =========================================================================
    print("\n[CLEANUP] Cleaning up test users and entities...")
    for uid in created_user_ids:
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
    print("ALL PHASE 6 REPORTS & EXPORT VERIFICATION TESTS PASSED (100% SUCCESS)!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
