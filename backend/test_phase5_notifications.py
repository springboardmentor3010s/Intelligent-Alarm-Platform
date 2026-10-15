"""
Phase 5 Notification & Reminder System Integration & Security Test Suite
Covers:
1. Bedtime Reminders (dynamic calculation based on active alarms and target sleep duration)
2. Advance Wake-Up Reminders (evaluates upcoming active alarms)
3. Habit Alerts (evaluates habits needing attention / progress)
4. Challenge Reminders (evaluates pending alarms with cognitive challenges, ensures zero answer leakage)
5. Progress Notifications (milestones and habit progress)
6. Notification Center APIs (GET /api/notifications, PATCH /api/notifications/{id}/read, POST /api/notifications/mark-all-read, DELETE /api/notifications/{id})
7. Platform Announcements - Public (GET /api/announcements)
8. Platform Announcements - Admin CRUD (GET, POST, PUT, PATCH toggle, DELETE /api/admin/announcements)
9. Role-Based Access Control (RBAC):
   - Unauthenticated access blocked (HTTP 401)
   - User blocked from admin announcement management (HTTP 403)
   - Coach blocked from admin announcement management (HTTP 403)
10. Data Isolation & Privacy:
   - User B cannot mark read, delete, or access User A's private notifications (HTTP 404/403)
11. Security Protection: Zero leakage of passwords, password hashes, secrets, or challenge correct answers.
12. Database cleanup of all test entities.
"""

import os
import sys
import uuid
from datetime import time, datetime, timezone

from fastapi.testclient import TestClient

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
    print("RUNNING PHASE 5: NOTIFICATION & REMINDER SYSTEM TEST SUITE")
    print("=" * 80)

    db = next(get_db())

    # 1. SETUP ACTORS: Admin, User A, User B, Coach
    admin_user = db.query(User).filter(User.role == "admin").first()
    assert admin_user is not None, "Administrator account required"
    admin_token = create_access_token(admin_user.id, admin_user.role)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[SETUP] Existing Admin: ID={admin_user.id}, Role='{admin_user.role}'")

    # User A
    user_a_email = f"p5_usera_{uuid.uuid4().hex[:6]}@example.com"
    res_a = client.post(
        "/api/auth/register",
        json={"name": "P5 User A", "email": user_a_email, "password": "password123", "role": "user"},
    )
    assert res_a.status_code == 200, res_a.text
    user_a_id = res_a.json()["user"]["id"]
    created_user_ids.append(user_a_id)
    token_a = create_access_token(user_a_id, "user")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B
    user_b_email = f"p5_userb_{uuid.uuid4().hex[:6]}@example.com"
    res_b = client.post(
        "/api/auth/register",
        json={"name": "P5 User B", "email": user_b_email, "password": "password123", "role": "user"},
    )
    assert res_b.status_code == 200, res_b.text
    user_b_id = res_b.json()["user"]["id"]
    created_user_ids.append(user_b_id)
    token_b = create_access_token(user_b_id, "user")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Coach
    coach_email = f"p5_coach_{uuid.uuid4().hex[:6]}@example.com"
    res_c = client.post(
        "/api/auth/register",
        json={"name": "P5 Coach", "email": coach_email, "password": "password123", "role": "wellness_coach"},
    )
    assert res_c.status_code == 200, res_c.text
    coach_id = res_c.json()["user"]["id"]
    created_user_ids.append(coach_id)
    token_c = create_access_token(coach_id, "wellness_coach")
    headers_c = {"Authorization": f"Bearer {token_c}"}

    print(f"[SETUP] Created User A (ID={user_a_id}), User B (ID={user_b_id}), Coach (ID={coach_id})")

    # 2. SETUP USER A DATA: Profile, Alarm with Challenge, Habit, Completed Session
    # Profile with 8 hours sleep
    profile_a = db.query(UserProfile).filter(UserProfile.user_id == user_a_id).first()
    if not profile_a:
        profile_a = UserProfile(
            user_id=user_a_id,
            preferred_wake_time=time(7, 0),
            sleep_duration=8,
            difficulty_preference="medium",
        )
        db.add(profile_a)
    else:
        profile_a.preferred_wake_time = time(7, 0)
        profile_a.sleep_duration = 8

    # Active Alarm for User A at 07:00 with math challenge
    alarm_a = Alarm(
        user_id=user_a_id,
        name="Morning Alarm",
        alarm_time=time(7, 0),
        repeat_pattern="Mon,Tue,Wed,Thu,Fri",
        is_active=True,
        challenge_type="math",
        difficulty="medium",
    )
    db.add(alarm_a)
    db.flush()

    challenge_secret = "SECRET_ANSWER_42"
    challenge_a = CognitiveChallenge(
        alarm_id=alarm_a.id,
        challenge_type="math",
        difficulty="medium",
        question="What is 40 + 2?",
        correct_answer=challenge_secret,
    )
    db.add(challenge_a)
    db.flush()

    # Habit for User A
    habit_a = Habit(
        user_id=user_a_id,
        wake_up_goal="07:00 AM Daily",
        productivity_goals="Morning reading and hydration",
        habit_preferences="No snooze mode",
    )
    db.add(habit_a)

    # Completed Alarm Session for User A
    session_a = AlarmSession(
        alarm_id=alarm_a.id,
        challenge_id=challenge_a.id,
        user_answer=challenge_secret,
        is_correct=True,
        session_status="completed",
        completed_at=datetime.now(timezone.utc),
        snooze_count=0,
        response_time_seconds=18,
    )
    db.add(session_a)
    db.commit()
    print("[SETUP] Seeded User A profile, active alarm, cognitive challenge, habit, and completed session")

    # =========================================================================
    # TEST 1: BEDTIME REMINDER DYNAMIC CALCULATION
    # =========================================================================
    print("\n[TEST 1] Bedtime Reminder dynamic calculation")
    res = client.get("/api/notifications", headers=headers_a)
    assert res.status_code == 200, res.text
    data = res.json()
    bedtime = data.get("bedtime_reminder")
    assert bedtime is not None, "Expected bedtime reminder to be generated for User A"
    assert "Bedtime" in bedtime["title"]
    assert "23:00" in bedtime["message"] or "7:00" in bedtime["message"] or "sleep" in bedtime["message"].lower()
    assert bedtime["recommended_bedtime"] == "23:00"
    assert "07:00" in bedtime["next_alarm_time"]
    print(f"  PASS: Bedtime reminder generated correctly -> {bedtime['title']}: {bedtime['message']}")

    # =========================================================================
    # TEST 2: ADVANCE WAKE-UP REMINDERS
    # =========================================================================
    print("\n[TEST 2] Advance Wake-Up Reminders")
    adv_reminders = data.get("advance_wake_reminders", [])
    assert len(adv_reminders) >= 1, "Expected at least 1 advance wake-up reminder"
    first_adv = adv_reminders[0]
    assert first_adv["alarm_id"] == alarm_a.id
    time_val = first_adv.get("alarm_time") or first_adv.get("scheduled_time", "")
    assert "07:00" in time_val
    print(f"  PASS: Advance wake-up reminder verified -> {first_adv['title']}: {first_adv['message']}")

    # =========================================================================
    # TEST 3: HABIT ALERTS
    # =========================================================================
    print("\n[TEST 3] Habit Alerts")
    habit_alerts = data.get("habit_alerts", [])
    assert len(habit_alerts) >= 1, "Expected at least 1 habit alert"
    assert any("hydration" in h["message"].lower() or "07:00" in h["message"].lower() for h in habit_alerts)
    print(f"  PASS: Habit alert verified -> {habit_alerts[0]['title']}: {habit_alerts[0]['message']}")

    # =========================================================================
    # TEST 4: CHALLENGE REMINDERS & SENSITIVE DATA SECURITY
    # =========================================================================
    print("\n[TEST 4] Challenge Reminders and Sensitive Field Protection")
    challenges = data.get("challenge_reminders", [])
    assert len(challenges) >= 1, "Expected challenge reminder for alarm with challenge"
    ch = challenges[0]
    assert ch["alarm_id"] == alarm_a.id
    assert "math" in ch["challenge_type"].lower()
    # CRITICAL: Verify secret answer is NEVER in the payload
    payload_str = str(data)
    assert challenge_secret not in payload_str, "CRITICAL SECURITY LEAK: Challenge correct_answer exposed in notification!"
    assert "password_hash" not in payload_str
    print(f"  PASS: Challenge reminder verified without leaking correct_answer -> {ch['title']}")

    # =========================================================================
    # TEST 5: PROGRESS NOTIFICATIONS
    # =========================================================================
    print("\n[TEST 5] Progress Notifications")
    progress = data.get("progress_notifications", [])
    assert len(progress) >= 1, "Expected progress notification from completed session"
    assert "Habit Score" in progress[0]["title"] or "Milestone" in progress[0]["title"] or "Progress" in progress[0]["title"]
    print(f"  PASS: Progress notification verified -> {progress[0]['title']}: {progress[0]['message']}")

    # =========================================================================
    # TEST 6: IN-APP USER NOTIFICATIONS CRUD & UNREAD COUNT
    # =========================================================================
    print("\n[TEST 6] In-App User Notifications (Sync, Read, Mark All, Delete)")
    notifications = data.get("notifications", [])
    assert len(notifications) >= 1, "Expected synced in-app notifications"
    assert data["unread_count"] == len([n for n in notifications if not n["is_read"]])
    print(f"  Initial unread count: {data['unread_count']}")

    # Mark single notification as read
    first_notif_id = notifications[0]["id"]
    patch_res = client.patch(f"/api/notifications/{first_notif_id}/read", headers=headers_a)
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["is_read"] is True
    print(f"  PASS: Marked notification {first_notif_id} as read")

    # Mark all as read
    mark_all_res = client.post("/api/notifications/mark-all-read", headers=headers_a)
    assert mark_all_res.status_code == 200, mark_all_res.text
    res_after_read = client.get("/api/notifications", headers=headers_a)
    assert res_after_read.json()["unread_count"] == 0, "Expected 0 unread after mark-all-read"
    print("  PASS: Mark all notifications read verified (unread_count = 0)")

    # Delete single notification
    del_res = client.delete(f"/api/notifications/{first_notif_id}", headers=headers_a)
    assert del_res.status_code == 200, del_res.text
    res_after_del = client.get("/api/notifications", headers=headers_a)
    remaining_ids = [n["id"] for n in res_after_del.json()["notifications"]]
    assert first_notif_id not in remaining_ids, "Deleted notification should not be present"
    print(f"  PASS: Deleted notification {first_notif_id}")

    # =========================================================================
    # TEST 7: USER DATA ISOLATION (User B cannot access or modify User A)
    # =========================================================================
    print("\n[TEST 7] User Data Isolation & Cross-Tenant Security")
    # User A creates a fresh notification
    notif_a = UserNotification(
        user_id=user_a_id,
        category="custom",
        title="Secret User A Memo",
        message="Confidential user A message",
        priority="high",
        is_read=False,
    )
    db.add(notif_a)
    db.commit()
    db.refresh(notif_a)

    # User B tries to read User A's notification -> Must return 404
    b_read_attempt = client.patch(f"/api/notifications/{notif_a.id}/read", headers=headers_b)
    assert b_read_attempt.status_code == 404, f"Expected 404, got {b_read_attempt.status_code}"

    # User B tries to delete User A's notification -> Must return 404
    b_del_attempt = client.delete(f"/api/notifications/{notif_a.id}", headers=headers_b)
    assert b_del_attempt.status_code == 404, f"Expected 404, got {b_del_attempt.status_code}"

    # User B fetches notifications -> Must NOT contain User A's notification
    b_list = client.get("/api/notifications", headers=headers_b).json()
    b_ids = [n["id"] for n in b_list.get("notifications", [])]
    assert notif_a.id not in b_ids, "Cross-user data leakage: User B received User A's notification!"
    print("  PASS: Data isolation strictly enforced. User B cannot access, read, or delete User A's notifications.")

    # =========================================================================
    # TEST 8: ADMIN ANNOUNCEMENTS CRUD & RBAC
    # =========================================================================
    print("\n[TEST 8] Platform Announcements (Admin CRUD & RBAC)")

    # 8a: Non-admins blocked from Admin Announcements endpoints (HTTP 403)
    user_blocked = client.get("/api/admin/announcements", headers=headers_a)
    assert user_blocked.status_code == 403, f"Expected 403 for user, got {user_blocked.status_code}"
    coach_blocked = client.get("/api/admin/announcements", headers=headers_c)
    assert coach_blocked.status_code == 403, f"Expected 403 for coach, got {coach_blocked.status_code}"
    unauth_blocked = client.get("/api/admin/announcements")
    assert unauth_blocked.status_code == 401, f"Expected 401 unauth, got {unauth_blocked.status_code}"
    print("  PASS: Non-admins blocked from Admin Announcements API (HTTP 401/403)")

    # 8b: Admin creates announcement
    ann_payload = {
        "title": "Scheduled Server Upgrade",
        "message": "Routine database maintenance scheduled for Sunday at 02:00 UTC.",
        "priority": "warning",
        "is_active": True,
    }
    create_res = client.post("/api/admin/announcements", headers=admin_headers, json=ann_payload)
    assert create_res.status_code == 200, create_res.text
    created_ann = create_res.json()
    ann_id = created_ann["id"]
    created_announcement_ids.append(ann_id)
    assert created_ann["title"] == ann_payload["title"]
    assert created_ann["priority"] == "warning"
    assert created_ann["is_active"] is True
    print(f"  PASS: Admin created announcement (ID={ann_id})")

    # 8c: Admin lists announcements
    list_res = client.get("/api/admin/announcements", headers=admin_headers)
    assert list_res.status_code == 200, list_res.text
    admin_anns = list_res.json()
    assert any(a["id"] == ann_id for a in admin_anns)
    print(f"  PASS: Admin listed announcements (count={len(admin_anns)})")

    # 8d: Public endpoint returns active announcement to normal users
    public_res = client.get("/api/announcements", headers=headers_a)
    assert public_res.status_code == 200, public_res.text
    pub_anns = public_res.json()
    assert any(a["id"] == ann_id for a in pub_anns)
    print("  PASS: Normal user received active announcement via public /api/announcements")

    # 8e: Admin updates announcement
    update_res = client.put(
        f"/api/admin/announcements/{ann_id}",
        headers=admin_headers,
        json={"title": "Updated Server Upgrade", "priority": "critical"},
    )
    assert update_res.status_code == 200, update_res.text
    assert update_res.json()["title"] == "Updated Server Upgrade"
    assert update_res.json()["priority"] == "critical"
    print("  PASS: Admin updated announcement successfully")

    # 8f: Admin toggles active state
    toggle_res = client.patch(f"/api/admin/announcements/{ann_id}/toggle", headers=admin_headers)
    assert toggle_res.status_code == 200, toggle_res.text
    assert toggle_res.json()["is_active"] is False

    # Deactivated announcement must no longer appear in public announcements
    pub_res_after_toggle = client.get("/api/announcements", headers=headers_a)
    assert not any(a["id"] == ann_id for a in pub_res_after_toggle.json()), "Deactivated announcement should not be visible publicly"
    print("  PASS: Admin toggled announcement to inactive; hidden from public users")

    # 8g: Admin deletes announcement
    del_ann_res = client.delete(f"/api/admin/announcements/{ann_id}", headers=admin_headers)
    assert del_ann_res.status_code == 200, del_ann_res.text
    created_announcement_ids.remove(ann_id)

    # Verify announcement 404 after deletion
    toggle_missing = client.patch(f"/api/admin/announcements/{ann_id}/toggle", headers=admin_headers)
    assert toggle_missing.status_code == 404
    print("  PASS: Admin deleted announcement successfully")

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
    print("  PASS: Cleanup completed successfully.")

    print("\n" + "=" * 80)
    print("ALL PHASE 5 NOTIFICATION & REMINDER TESTS PASSED (100% SUCCESS)!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
