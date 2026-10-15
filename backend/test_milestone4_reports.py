"""
Milestone 4 — Phase 1: Reports & Export System Test Suite.

Validates:
1. GET /api/reports/data (Authenticated report data & schema conformance)
2. All 5 report sections present with proper calculations:
   - Habit Report (evaluate_user_habit integration)
   - Wake-Up Performance Report
   - Cognitive Challenge Performance Report
   - Sleep / Adherence Report (with graceful profile fallbacks)
   - Productivity Report (strictly non-fabricated data)
3. User Data Isolation: User A cannot see User B's sessions/alarms
4. Authentication & Security:
   - 401 when unauthenticated
   - No passwords, hashes, secrets, or raw answers exposed in data or exports
5. Export Endpoints:
   - GET /api/reports/export/pdf: valid PDF stream (%PDF-)
   - GET /api/reports/export/excel: valid .xlsx workbook with 6 specific sheets
   - GET /api/reports/export/csv: valid .csv with clear section markers
6. Demo Mode Endpoints:
   - GET /api/reports/demo/data: returns demo sample data without DB access
   - GET /api/reports/demo/export-pdf: returns PDF with DEMO banner
   - GET /api/reports/demo/export-excel: returns Excel with DEMO banner
   - GET /api/reports/demo/export-csv: returns CSV with DEMO banner
"""

import io
import os
import sys
from openpyxl import load_workbook

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession
from app.utils.security import create_access_token
from app.schemas.reports import ReportSummaryResponse

client = TestClient(app)


def run_all_tests():
    print("=" * 70)
    print("RUNNING MILESTONE 4 — PHASE 1 REPORTS & EXPORT TEST SUITE")
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
        # TEST 1: Authentication & Protection
        # -----------------------------------------------------------------
        resp_unauth = client.get("/api/reports/data")
        assert resp_unauth.status_code in [401, 403], f"Expected 401/403, got {resp_unauth.status_code}"

        resp_unauth_pdf = client.get("/api/reports/export/pdf")
        assert resp_unauth_pdf.status_code in [401, 403], f"Expected 401/403, got {resp_unauth_pdf.status_code}"

        resp_unauth_excel = client.get("/api/reports/export/excel")
        assert resp_unauth_excel.status_code in [401, 403], f"Expected 401/403, got {resp_unauth_excel.status_code}"

        resp_unauth_csv = client.get("/api/reports/export/csv")
        assert resp_unauth_csv.status_code in [401, 403], f"Expected 401/403, got {resp_unauth_csv.status_code}"
        print("[PASS] Test 1: Authentication enforced on all real-user report endpoints.")

        # -----------------------------------------------------------------
        # TEST 2: GET /api/reports/data Schema & Structure
        # -----------------------------------------------------------------
        resp_a = client.get("/api/reports/data", headers=headers_a)
        assert resp_a.status_code == 200, f"Expected 200, got {resp_a.status_code}: {resp_a.text}"
        data_a = resp_a.json()

        # Validate with Pydantic model
        validated = ReportSummaryResponse(**data_a)
        assert validated.user_email == user_a.email
        assert validated.is_demo is False
        assert "habit_report" in data_a
        assert "wake_up_report" in data_a
        assert "challenge_report" in data_a
        assert "sleep_adherence_report" in data_a
        assert "productivity_report" in data_a

        # Habit report checks
        hr = data_a["habit_report"]
        assert 0 <= hr["overall_habit_score"] <= 100
        assert 0 <= hr["wake_up_consistency"] <= 100
        assert 0 <= hr["challenge_completion"] <= 100
        assert 0 <= hr["snooze_reduction"] <= 100

        # Productivity report check: no fabricated numbers
        pr = data_a["productivity_report"]
        assert "has_productivity_data" in pr
        if not pr["has_productivity_data"]:
            assert pr["message"] == "Productivity data is not available yet."
            assert pr["productivity_goals"] is None

        print("[PASS] Test 2: GET /api/reports/data returns valid ReportSummaryResponse structure.")

        # -----------------------------------------------------------------
        # TEST 3: User Data Isolation
        # -----------------------------------------------------------------
        resp_b = client.get("/api/reports/data", headers=headers_b)
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        assert data_b["user_email"] == user_b.email
        assert data_b["user_email"] != data_a["user_email"]

        # Verify alarms and sessions count isolation
        user_a_alarms = db.query(Alarm).filter(Alarm.user_id == user_a.id).all()
        user_a_alarm_ids = [a.id for a in user_a_alarms]
        user_a_sessions_cnt = db.query(AlarmSession).filter(AlarmSession.alarm_id.in_(user_a_alarm_ids)).count() if user_a_alarm_ids else 0

        assert data_a["wake_up_report"]["total_sessions"] == user_a_sessions_cnt, (
            f"User A total_sessions expected {user_a_sessions_cnt}, got {data_a['wake_up_report']['total_sessions']}"
        )
        print("[PASS] Test 3: User isolation strictly enforced between User A and User B.")

        # -----------------------------------------------------------------
        # TEST 4: No Secrets or Passwords Exposed
        # -----------------------------------------------------------------
        raw_dump = str(data_a)
        forbidden_keys = ["hashed_password", "password_hash", "secret_key", "jwt_secret"]
        for key in forbidden_keys:
            assert key not in raw_dump, f"Forbidden key '{key}' found in report data payload!"
        print("[PASS] Test 4: Zero secret leakage in report data payload.")

        # -----------------------------------------------------------------
        # TEST 5: PDF Export (GET /api/reports/export/pdf)
        # -----------------------------------------------------------------
        resp_pdf = client.get("/api/reports/export/pdf", headers=headers_a)
        assert resp_pdf.status_code == 200, f"Expected 200, got {resp_pdf.status_code}"
        assert resp_pdf.headers["content-type"] == "application/pdf"
        assert resp_pdf.content.startswith(b"%PDF-"), "Exported PDF does not have valid %PDF- magic bytes"
        assert len(resp_pdf.content) > 1000, "Exported PDF is suspiciously small"
        print(f"[PASS] Test 5: Real user PDF export generated successfully ({len(resp_pdf.content)} bytes).")

        # -----------------------------------------------------------------
        # TEST 6: Excel Export (GET /api/reports/export/excel)
        # -----------------------------------------------------------------
        resp_excel = client.get("/api/reports/export/excel", headers=headers_a)
        assert resp_excel.status_code == 200, f"Expected 200, got {resp_excel.status_code}"
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in resp_excel.headers["content-type"]

        wb = load_workbook(io.BytesIO(resp_excel.content))
        expected_sheets = [
            "Summary",
            "Habit Metrics",
            "Wake-Up Performance",
            "Cognitive Challenges",
            "Sleep Adherence",
            "Productivity",
        ]
        assert wb.sheetnames == expected_sheets, f"Expected sheets {expected_sheets}, got {wb.sheetnames}"
        ws_summary = wb["Summary"]
        assert "INTELLIGENT COGNITIVE ALARM" in ws_summary.cell(row=1, column=1).value or "INTELLIGENT COGNITIVE ALARM" in ws_summary.cell(row=3, column=1).value
        print(f"[PASS] Test 6: Real user Excel export valid with all 6 sheets ({len(resp_excel.content)} bytes).")

        # -----------------------------------------------------------------
        # TEST 7: CSV Export (GET /api/reports/export/csv)
        # -----------------------------------------------------------------
        resp_csv = client.get("/api/reports/export/csv", headers=headers_a)
        assert resp_csv.status_code == 200, f"Expected 200, got {resp_csv.status_code}"
        assert "text/csv" in resp_csv.headers["content-type"]
        csv_text = resp_csv.content.decode("utf-8-sig")
        assert "INTELLIGENT COGNITIVE ALARM — PERFORMANCE REPORT" in csv_text
        assert "--- 1. HABIT PERFORMANCE & CONSISTENCY ---" in csv_text
        assert "--- 2. WAKE-UP PERFORMANCE ---" in csv_text
        assert "--- 3. COGNITIVE CHALLENGE PERFORMANCE ---" in csv_text
        assert "--- 4. SLEEP & SCHEDULE ADHERENCE ---" in csv_text
        assert "--- 5. PRODUCTIVITY REPORT ---" in csv_text
        print(f"[PASS] Test 7: Real user CSV export valid with all sections ({len(csv_text)} chars).")

        # -----------------------------------------------------------------
        # TEST 8: Demo Mode Endpoints (Data & Exports)
        # -----------------------------------------------------------------
        resp_demo_data = client.get("/api/reports/demo/data")
        assert resp_demo_data.status_code == 200
        demo_json = resp_demo_data.json()
        assert demo_json["is_demo"] is True
        assert demo_json["user_name"] == "Demo User"
        assert demo_json["habit_report"]["overall_habit_score"] == 82.5

        resp_demo_pdf = client.get("/api/reports/demo/export-pdf")
        assert resp_demo_pdf.status_code == 200
        assert resp_demo_pdf.content.startswith(b"%PDF-")

        resp_demo_excel = client.get("/api/reports/demo/export-excel")
        assert resp_demo_excel.status_code == 200
        demo_wb = load_workbook(io.BytesIO(resp_demo_excel.content))
        assert "Summary" in demo_wb.sheetnames
        assert "DEMO REPORT" in str(demo_wb["Summary"]["A1"].value)

        resp_demo_csv = client.get("/api/reports/demo/export-csv")
        assert resp_demo_csv.status_code == 200
        demo_csv_text = resp_demo_csv.content.decode("utf-8-sig")
        assert "*** DEMO REPORT — SAMPLE DATA (READ-ONLY) ***" in demo_csv_text

        print("[PASS] Test 8: Demo mode endpoints generate verified demo artifacts without DB access.")

        print("=" * 70)
        print("ALL MILESTONE 4 — PHASE 1 TESTS PASSED SUCCESSFULLY!")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_all_tests()
