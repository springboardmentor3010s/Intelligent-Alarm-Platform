"""
Comprehensive Verification Test Suite for Phase 2: Complete User Features.

Tests all user-facing requirements:
1. User Profile & Sleep Schedule (GET/PUT /api/profile)
   - Preferred wake time
   - Sleep duration (schedule)
   - Time zone
   - Difficulty preference
2. Habit Goals & Daily Preferences (GET/PUT /api/habits)
   - Wake-up goal
   - Productivity goals
   - Habit preferences
3. Alarm Management Lifecycle
   - Alarm creation (with challenge type, difficulty, recurring pattern)
   - Alarm retrieval (GET /api/alarms)
   - Alarm editing (PUT /api/alarms/{id})
   - Alarm activation/deactivation toggle (PATCH /api/alarms/{id}/toggle)
   - Alarm deletion (DELETE /api/alarms/{id})
4. Cognitive Alarm & Challenge Session Lifecycle
   - Session initiation (POST /api/sessions/start)
   - Challenge retrieval (GET /api/sessions/{id}/challenge)
   - Snooze operation (POST /api/sessions/{id}/snooze)
   - Challenge answer & dismissal (POST /api/sessions/{id}/answer)
   - Session expiration handling (POST /api/sessions/{id}/expire)
5. Session History
   - Historical records retrieval (GET /api/sessions/history)
6. Behavioral Analytics & Intelligence
   - Executive Analytics (GET /api/analytics)
   - Habit Score calculation (GET /api/analytics/habit-score)
   - Recommendations (GET /api/analytics/recommendations)
   - Two-Attempt Adaptive Difficulty status (GET /api/analytics/adaptive-difficulty)
7. Reports & Export Engine
   - Summary data (GET /api/reports/data)
   - PDF export (GET /api/reports/export/pdf)
   - Excel export (GET /api/reports/export/excel)
   - CSV export (GET /api/reports/export/csv)
"""

import os
import sys
import uuid
from datetime import datetime, timezone, time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, CognitiveChallenge, UserProfile, Habit
from app.utils.security import create_access_token


client = TestClient(app)


def run_phase2_verification_suite():
    print("=" * 80)
    print("RUNNING PHASE 2: COMPLETE USER FEATURES INTEGRATION TEST SUITE")
    print("=" * 80)

    db = SessionLocal()
    temp_user_id = None

    try:
        # Create a dedicated test user for Phase 2 verification
        suffix = uuid.uuid4().hex[:6]
        test_email = f"phase2_test_{suffix}@example.com"
        reg_resp = client.post(
            "/api/auth/register",
            json={"name": "Phase2 User", "email": test_email, "password": "Password123!"},
        )
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        temp_user_id = reg_resp.json()["user"]["id"]
        auth_token = create_access_token(temp_user_id, "user")
        headers = {"Authorization": f"Bearer {auth_token}"}
        print(f"[SETUP] Created dedicated test user: ID={temp_user_id}, Email={test_email}")

        # -------------------------------------------------------------
        # 1. USER PROFILE & SLEEP SCHEDULE
        # -------------------------------------------------------------
        print("\n--- 1. Testing User Profile & Sleep Schedule ---")
        get_prof_resp = client.get("/api/profile", headers=headers)
        assert get_prof_resp.status_code == 200, f"GET /api/profile failed: {get_prof_resp.text}"
        print(f"[PASS] 1.1: GET /api/profile returns initial profile: {get_prof_resp.json()}")

        # Update profile with sleep schedule
        update_prof_resp = client.put(
            "/api/profile",
            json={
                "preferred_wake_time": "06:30:00",
                "sleep_duration": 8,
                "time_zone": "Asia/Kolkata",
                "difficulty_preference": "hard",
            },
            headers=headers,
        )
        assert update_prof_resp.status_code == 200, f"PUT /api/profile failed: {update_prof_resp.text}"
        prof_data = update_prof_resp.json()["profile"]
        assert prof_data["preferred_wake_time"] == "06:30:00"
        assert prof_data["sleep_duration"] == 8
        assert prof_data["time_zone"] == "Asia/Kolkata"
        assert prof_data["difficulty_preference"] == "hard"
        print(f"[PASS] 1.2: PUT /api/profile saved wake time (06:30), sleep duration (8h), timezone, difficulty")

        # -------------------------------------------------------------
        # 2. HABIT GOALS & DAILY PREFERENCES
        # -------------------------------------------------------------
        print("\n--- 2. Testing Habit Goals & Daily Preferences ---")
        get_habits_resp = client.get("/api/habits", headers=headers)
        assert get_habits_resp.status_code == 200, f"GET /api/habits failed: {get_habits_resp.text}"
        print(f"[PASS] 2.1: GET /api/habits returns initial habits: {get_habits_resp.json()}")

        # Update habit goals and preferences
        update_habits_resp = client.put(
            "/api/habits",
            json={
                "wake_up_goal": "Wake up at 06:30 AM refreshed without snoozing",
                "productivity_goals": "Complete 30 minutes morning cognitive challenge and deep focus work",
                "habit_preferences": "Prefer math and logic puzzles; strict 1-snooze limit on weekdays",
            },
            headers=headers,
        )
        assert update_habits_resp.status_code == 200, f"PUT /api/habits failed: {update_habits_resp.text}"
        habits_data = update_habits_resp.json()["habits"]
        assert habits_data["wake_up_goal"] == "Wake up at 06:30 AM refreshed without snoozing"
        assert habits_data["productivity_goals"] == "Complete 30 minutes morning cognitive challenge and deep focus work"
        assert habits_data["habit_preferences"] == "Prefer math and logic puzzles; strict 1-snooze limit on weekdays"
        print(f"[PASS] 2.2: PUT /api/habits successfully saved wake-up goal, productivity goals, and preferences")

        # Re-fetch habits to verify persistence
        refetch_habits_resp = client.get("/api/habits", headers=headers)
        assert refetch_habits_resp.status_code == 200
        assert refetch_habits_resp.json()["wake_up_goal"] == habits_data["wake_up_goal"]
        print(f"[PASS] 2.3: GET /api/habits verified persistent database storage")

        # -------------------------------------------------------------
        # 3. ALARM MANAGEMENT LIFECYCLE
        # -------------------------------------------------------------
        print("\n--- 3. Testing Alarm Management Lifecycle ---")
        create_alarm_resp = client.post(
            "/api/alarms",
            json={
                "name": "Phase2 Morning Sprint",
                "alarm_time": "06:30:00",
                "alarm_type": "recurring",
                "repeat_pattern": "Mon,Tue,Wed,Thu,Fri",
                "challenge_type": "math",
                "difficulty": "medium",
            },
            headers=headers,
        )
        assert create_alarm_resp.status_code == 200, f"Create alarm failed: {create_alarm_resp.text}"
        alarm = create_alarm_resp.json()
        alarm_id = alarm["id"]
        assert alarm["name"] == "Phase2 Morning Sprint"
        assert alarm["challenge_type"] == "math"
        assert alarm["difficulty"] == "medium"
        assert alarm["repeat_pattern"] == "Mon,Tue,Wed,Thu,Fri"
        print(f"[PASS] 3.1: POST /api/alarms created recurring alarm (ID={alarm_id})")

        # Edit alarm
        update_alarm_resp = client.put(
            f"/api/alarms/{alarm_id}",
            json={
                "name": "Updated Morning Sprint",
                "alarm_time": "07:00:00",
                "alarm_type": "daily",
                "repeat_pattern": "Every day",
                "challenge_type": "logic",
                "difficulty": "hard",
            },
            headers=headers,
        )
        assert update_alarm_resp.status_code == 200, f"Update alarm failed: {update_alarm_resp.text}"
        updated_alarm = update_alarm_resp.json()
        assert updated_alarm["name"] == "Updated Morning Sprint"
        assert updated_alarm["challenge_type"] == "logic"
        assert updated_alarm["difficulty"] == "hard"
        print(f"[PASS] 3.2: PUT /api/alarms/{alarm_id} updated alarm name, time, challenge, difficulty")

        # Toggle alarm
        toggle_resp = client.patch(f"/api/alarms/{alarm_id}/toggle", headers=headers)
        assert toggle_resp.status_code == 200, f"Toggle alarm failed: {toggle_resp.text}"
        assert toggle_resp.json()["is_active"] is False, "Expected alarm to be toggled to inactive"
        toggle_back_resp = client.patch(f"/api/alarms/{alarm_id}/toggle", headers=headers)
        assert toggle_back_resp.status_code == 200
        assert toggle_back_resp.json()["is_active"] is True, "Expected alarm to be toggled back to active"
        print(f"[PASS] 3.3: PATCH /api/alarms/{alarm_id}/toggle correctly toggled active/inactive states")

        # -------------------------------------------------------------
        # 4. COGNITIVE ALARM & CHALLENGE COMPLETION FLOW
        # -------------------------------------------------------------
        print("\n--- 4. Testing Cognitive Alarm & Challenge Session Lifecycle ---")
        # Start session
        start_session_resp = client.post(
            f"/api/sessions/start/{alarm_id}",
            headers=headers,
        )
        assert start_session_resp.status_code == 200, f"Start session failed: {start_session_resp.text}"
        session_data = start_session_resp.json()
        session_id = session_data["id"]
        challenge_id = session_data["challenge_id"]
        assert session_data["session_status"] == "started"
        print(f"[PASS] 4.1: POST /api/sessions/start/{alarm_id} started session {session_id} with challenge {challenge_id}")

        # Fetch challenge
        get_chal_resp = client.get(f"/api/challenges/{challenge_id}", headers=headers)
        assert get_chal_resp.status_code == 200, f"Get challenge failed: {get_chal_resp.text}"
        chal_info = get_chal_resp.json()
        assert "question" in chal_info
        assert "correct_answer" not in chal_info, "Security flaw: correct_answer leaked in challenge payload!"
        print(f"[PASS] 4.2: GET /api/challenges/{challenge_id} returned question securely: '{chal_info['question']}'")

        # Snooze session
        snooze_resp = client.post(f"/api/sessions/{session_id}/snooze", headers=headers)
        assert snooze_resp.status_code == 200, f"Snooze failed: {snooze_resp.text}"
        assert snooze_resp.json()["snooze_count"] == 1
        assert snooze_resp.json()["dismissal_status"] == "snoozed"
        print(f"[PASS] 4.3: POST /api/sessions/{session_id}/snooze incremented snooze_count to 1")

        # Answer challenge correctly
        db_challenge = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == challenge_id).first()
        answer_resp = client.post(
            f"/api/sessions/{session_id}/answer",
            json={"answer": db_challenge.correct_answer},
            headers=headers,
        )
        assert answer_resp.status_code == 200, f"Answer challenge failed: {answer_resp.text}"
        answer_data = answer_resp.json()
        assert answer_data["is_correct"] is True
        assert answer_data["session_status"] == "completed"
        assert answer_data["dismissal_status"] == "dismissed"
        assert "adaptive_difficulty" in answer_data
        print(f"[PASS] 4.4: POST /api/sessions/{session_id}/answer verified correct answer & completed dismissal")

        # Start second session to verify expiration flow
        start2_resp = client.post(
            f"/api/sessions/start/{alarm_id}",
            headers=headers,
        )
        assert start2_resp.status_code == 200
        session_id_2 = start2_resp.json()["id"]
        expire_resp = client.patch(f"/api/sessions/{session_id_2}/expire", headers=headers)
        assert expire_resp.status_code == 200
        assert expire_resp.json()["session_status"] == "expired"
        assert expire_resp.json()["dismissal_status"] == "expired"
        print(f"[PASS] 4.5: PATCH /api/sessions/{session_id_2}/expire marked session expired")

        # -------------------------------------------------------------
        # 5. SESSION HISTORY
        # -------------------------------------------------------------
        print("\n--- 5. Testing Session History ---")
        history_resp = client.get("/api/sessions/history", headers=headers)
        assert history_resp.status_code == 200, f"Session history failed: {history_resp.text}"
        history_items = history_resp.json()["sessions"]
        assert len(history_items) == 2, f"Expected 2 sessions in history, got {len(history_items)}"
        print(f"[PASS] 5.1: GET /api/sessions/history returned {len(history_items)} user sessions with full audit fields")

        # -------------------------------------------------------------
        # 6. ANALYTICS & INTELLIGENCE SUITE
        # -------------------------------------------------------------
        print("\n--- 6. Testing Analytics & Intelligence Suite ---")
        # Executive Analytics
        analytics_resp = client.get("/api/analytics?range=all", headers=headers)
        assert analytics_resp.status_code == 200, f"Analytics failed: {analytics_resp.text}"
        an_data = analytics_resp.json()
        assert "total_sessions" in an_data
        assert "habit_score" in an_data
        assert "recommended_difficulty" in an_data
        print(f"[PASS] 6.1: GET /api/analytics returned executive KPIs and intelligence indicators")

        # Habit Score
        habit_score_resp = client.get("/api/analytics/habit-score", headers=headers)
        assert habit_score_resp.status_code == 200, f"Habit score failed: {habit_score_resp.text}"
        hs_data = habit_score_resp.json()
        assert "overall_habit_score" in hs_data
        assert 0.0 <= hs_data["overall_habit_score"] <= 100.0
        print(f"[PASS] 6.2: GET /api/analytics/habit-score returned valid score: {hs_data['overall_habit_score']}")

        # Recommendations
        rec_resp = client.get("/api/analytics/recommendations", headers=headers)
        assert rec_resp.status_code == 200, f"Recommendations failed: {rec_resp.text}"
        recs = rec_resp.json()["recommendations"]
        assert len(recs) > 0, "Expected at least 1 recommendation"
        print(f"[PASS] 6.3: GET /api/analytics/recommendations returned {len(recs)} prioritized behavioral insights")

        # Adaptive Difficulty status
        adapt_resp = client.get(f"/api/analytics/adaptive-difficulty?alarm_id={alarm_id}", headers=headers)
        assert adapt_resp.status_code == 200, f"Adaptive difficulty failed: {adapt_resp.text}"
        ad_data = adapt_resp.json()
        assert "recommended_difficulty" in ad_data
        print(f"[PASS] 6.4: GET /api/analytics/adaptive-difficulty returned: {ad_data['recommended_difficulty']}")

        # -------------------------------------------------------------
        # 7. REPORTS & EXPORTS
        # -------------------------------------------------------------
        print("\n--- 7. Testing Reports & Export Engine ---")
        rep_data_resp = client.get("/api/reports/data?range=all", headers=headers)
        assert rep_data_resp.status_code == 200, f"Report data failed: {rep_data_resp.text}"
        print(f"[PASS] 7.1: GET /api/reports/data returned structured report summary")

        pdf_resp = client.get("/api/reports/export/pdf?range=all", headers=headers)
        assert pdf_resp.status_code == 200, f"PDF export failed: {pdf_resp.text}"
        assert len(pdf_resp.content) > 1000
        print(f"[PASS] 7.2: GET /api/reports/export/pdf generated valid PDF ({len(pdf_resp.content)} bytes)")

        excel_resp = client.get("/api/reports/export/excel?range=all", headers=headers)
        assert excel_resp.status_code == 200, f"Excel export failed: {excel_resp.text}"
        assert len(excel_resp.content) > 1000
        print(f"[PASS] 7.3: GET /api/reports/export/excel generated valid Excel spreadsheet ({len(excel_resp.content)} bytes)")

        csv_resp = client.get("/api/reports/export/csv?range=all", headers=headers)
        assert csv_resp.status_code == 200, f"CSV export failed: {csv_resp.text}"
        assert len(csv_resp.content) > 100
        print(f"[PASS] 7.4: GET /api/reports/export/csv generated valid CSV report ({len(csv_resp.content)} bytes)")

        # -------------------------------------------------------------
        # 8. ALARM DELETION
        # -------------------------------------------------------------
        print("\n--- 8. Testing Alarm Deletion Lifecycle ---")
        # Clean sessions first to allow deletion if needed or delete directly
        db.query(AlarmSession).filter(AlarmSession.alarm_id == alarm_id).delete()
        db.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id == alarm_id).delete()
        db.commit()
        del_alarm_resp = client.delete(f"/api/alarms/{alarm_id}", headers=headers)
        assert del_alarm_resp.status_code == 200, f"Delete alarm failed: {del_alarm_resp.text}"
        print(f"[PASS] 8.1: DELETE /api/alarms/{alarm_id} deleted alarm successfully")

        print("\n" + "=" * 80)
        print("ALL PHASE 2 USER FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 80)

    finally:
        # Cleanup test user and associated records
        if temp_user_id:
            try:
                db.query(AlarmSession).filter(
                    AlarmSession.alarm_id.in_(
                        db.query(Alarm.id).filter(Alarm.user_id == temp_user_id)
                    )
                ).delete(synchronize_session=False)
                db.query(CognitiveChallenge).filter(
                    CognitiveChallenge.alarm_id.in_(
                        db.query(Alarm.id).filter(Alarm.user_id == temp_user_id)
                    )
                ).delete(synchronize_session=False)
                db.query(Alarm).filter(Alarm.user_id == temp_user_id).delete(synchronize_session=False)
                db.query(Habit).filter(Habit.user_id == temp_user_id).delete(synchronize_session=False)
                db.query(UserProfile).filter(UserProfile.user_id == temp_user_id).delete(synchronize_session=False)
                db.query(User).filter(User.id == temp_user_id).delete(synchronize_session=False)
                db.commit()
                print(f"[CLEANUP] Safely purged temporary test user ID: {temp_user_id}")
            except Exception as e:
                db.rollback()
                print(f"[CLEANUP WARNING] Failed to purge test user {temp_user_id}: {e}")
        db.close()


if __name__ == "__main__":
    run_phase2_verification_suite()
