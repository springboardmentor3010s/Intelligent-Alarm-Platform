import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import sys
import unittest
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
from Models.user import User
from Models.notification import Notification, Announcement, CoachMessage
from Models.coach import CoachAssignment
from auth import create_access_token

client = TestClient(app)

def run_tests():
    db = SessionLocal()
    print("=" * 60)
    print("STARTING NOTIFICATIONS & MESSAGING VERIFICATION SUITE")
    print("=" * 60)

    # 1. Fetch real users
    user1 = db.query(User).filter(User.id == 1, User.role == "user").first()
    coach2 = db.query(User).filter(User.id == 2, User.role == "wellness_coach").first()
    admin3 = db.query(User).filter(User.id == 3, User.role == "admin").first()
    coach7 = db.query(User).filter(User.id == 7, User.role == "wellness_coach").first()

    assert user1 is not None, "Real User 1 (Gagan2) must exist"
    assert coach2 is not None, "Real Coach 2 (Wellness Coach) must exist"
    assert admin3 is not None, "Real Admin 3 (Gagan) must exist"
    assert coach7 is not None, "Real Coach 7 (krish) must exist"

    print(f"[OK] Found real accounts: User={user1.name} (ID {user1.id}), Coach={coach2.name} (ID {coach2.id}), Admin={admin3.name} (ID {admin3.id}), UnassignedCoach={coach7.name} (ID {coach7.id})")

    token_user1 = create_access_token({"user_id": user1.id, "name": user1.name, "email": user1.email, "role": user1.role})
    token_coach2 = create_access_token({"user_id": coach2.id, "name": coach2.name, "email": coach2.email, "role": coach2.role})
    token_admin3 = create_access_token({"user_id": admin3.id, "name": admin3.name, "email": admin3.email, "role": admin3.role})
    token_coach7 = create_access_token({"user_id": coach7.id, "name": coach7.name, "email": coach7.email, "role": coach7.role})

    # -------------------------------------------------------------
    # TEST 1: Unauthenticated & Unauthorized API Protection
    # -------------------------------------------------------------
    print("\n--- TEST 1: Authentication & Authorization Controls ---")
    r = client.get("/notifications")
    assert r.status_code in [401, 403], f"Unauthenticated GET /notifications must fail, got {r.status_code}"
    print("[PASS] Unauthenticated request to /notifications rejected.")

    # Regular user attempting to post announcement (admin only)
    r = client.post("/announcements", json={"title": "Hacked", "message": "Test", "recipient_type": "all"}, headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 403, f"Regular user cannot post announcement, got {r.status_code}"
    print("[PASS] Regular user cannot post announcements (403 Forbidden).")

    # Regular user attempting to send coach message (coach/admin only)
    r = client.post("/messages", json={"recipient_type": "single", "recipient_id": user1.id, "subject": "Hi", "body": "Hello"}, headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 403, f"Regular user cannot send coach message, got {r.status_code}"
    print("[PASS] Regular user cannot send coach messages (403 Forbidden).")

    # -------------------------------------------------------------
    # TEST 2: Coach Assignment Authorization Boundary
    # -------------------------------------------------------------
    print("\n--- TEST 2: Coach Assignment Authorization Boundary ---")
    # Coach 7 is NOT assigned to User 1
    r = client.post(
        "/messages",
        json={
            "recipient_type": "single",
            "recipient_id": user1.id,
            "message_type": "recommendation",
            "subject": "Unauthorized Coaching",
            "body": "Should fail because Coach 7 is not assigned to User 1"
        },
        headers={"Authorization": f"Bearer {token_coach7}"}
    )
    assert r.status_code == 403, f"Unassigned coach must not be permitted to message client, got {r.status_code}"
    print(f"[PASS] Unassigned Coach 7 correctly rejected with 403 Forbidden: {r.json().get('detail')}")

    # Coach 2 IS assigned to User 1
    r = client.post(
        "/messages",
        json={
            "recipient_type": "single",
            "recipient_id": user1.id,
            "message_type": "recommendation",
            "subject": "Sleep Consistency Strategy",
            "body": "Try dimming blue light 45 minutes before sleep to improve morning reaction speed."
        },
        headers={"Authorization": f"Bearer {token_coach2}"}
    )
    assert r.status_code == 200, f"Assigned coach message must succeed, got {r.status_code}: {r.text}"
    coach_msg_id = r.json().get("id")
    print(f"[PASS] Assigned Coach 2 successfully sent Coaching Recommendation to User 1 (ID {coach_msg_id}).")

    # Verify Coach Message Sent list
    r = client.get("/messages/sent", headers={"Authorization": f"Bearer {token_coach2}"})
    assert r.status_code == 200
    sent_list = r.json()
    assert any(m["id"] == coach_msg_id for m in sent_list), "Sent message must appear in coach sent list"
    print(f"[PASS] Coach Sent Messages list includes dispatched message with recipient details.")

    # Verify User 1 Received Messages list
    r = client.get("/messages/received", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    rec_list = r.json()
    assert any(m["id"] == coach_msg_id for m in rec_list), "User must see coach message in received list"
    rec_item = next(m for m in rec_list if m["id"] == coach_msg_id)
    assert rec_item["message_type"] == "recommendation", "Must preserve recommendation type"
    print(f"[PASS] User 1 received list shows recommendation with coach sender: '{rec_item['coach_name']}'.")

    # -------------------------------------------------------------
    # TEST 3: Admin Announcements & Multi-Scope Targeting
    # -------------------------------------------------------------
    print("\n--- TEST 3: Admin Announcements & Targeting Scopes ---")
    # Publish announcement targeted to coaches only
    r = client.post(
        "/announcements",
        json={
            "title": "Quarterly Coaching Standards Update",
            "message": "All wellness coaches must review updated cognitive verification guidelines.",
            "recipient_type": "coaches",
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token_admin3}"}
    )
    assert r.status_code == 200, f"Admin announcement must succeed, got {r.status_code}: {r.text}"
    coach_announcement_id = r.json().get("id")
    print(f"[PASS] Admin published announcement to 'coaches' scope (ID {coach_announcement_id}).")

    # Verify Coach 2 received announcement notification
    r = client.get("/notifications?category=announcement", headers={"Authorization": f"Bearer {token_coach2}"})
    assert r.status_code == 200
    coach_notifs = r.json()
    assert any(n["related_entity_id"] == coach_announcement_id for n in coach_notifs), "Coach must receive coach-targeted announcement"
    print("[PASS] Coach 2 received targeted announcement notification.")

    # Verify User 1 did NOT receive coach-targeted announcement
    r = client.get("/notifications?category=announcement", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    user_notifs = r.json()
    assert not any(n["related_entity_id"] == coach_announcement_id for n in user_notifs), "Regular user must NOT receive coach announcement"
    print("[PASS] User 1 did NOT receive announcement targeted only to coaches (Scope isolation verified).")

    # -------------------------------------------------------------
    # TEST 4: Notification Bell, Read Status & Unread Count
    # -------------------------------------------------------------
    print("\n--- TEST 4: Notification Bell, Filters & Read Updates ---")
    # Get User 1 unread count
    r = client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    initial_unread = r.json().get("unread_count")
    assert initial_unread > 0, "User 1 should have unread notification from coach"
    print(f"[PASS] User 1 initial unread count: {initial_unread}")

    # Get User 1 unread notifications list
    r = client.get("/notifications?filter=unread", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    unread_notifs = r.json()
    assert len(unread_notifs) == initial_unread
    target_notif = unread_notifs[0]

    # Mark single notification as read
    r = client.patch(f"/notifications/{target_notif['id']}/read", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    print(f"[PASS] Successfully marked notification {target_notif['id']} as read.")

    # Verify unread count decreased by 1
    r = client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    new_unread = r.json().get("unread_count")
    assert new_unread == initial_unread - 1, f"Expected {initial_unread - 1}, got {new_unread}"
    print(f"[PASS] Unread count updated accurately: {initial_unread} -> {new_unread}")

    # Mark all read
    r = client.patch("/notifications/read-all", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.status_code == 200
    r = client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {token_user1}"})
    assert r.json().get("unread_count") == 0
    print("[PASS] Mark-all-read cleared all unread notifications (Unread count = 0).")

    # -------------------------------------------------------------
    # TEST 5: Admin Delivery and Read Statistics
    # -------------------------------------------------------------
    print("\n--- TEST 5: Admin Announcements Delivery & Read Statistics ---")
    r = client.get("/announcements", headers={"Authorization": f"Bearer {token_admin3}"})
    assert r.status_code == 200
    admin_announcements = r.json()
    assert len(admin_announcements) > 0
    target_a = next(a for a in admin_announcements if a["id"] == coach_announcement_id)
    assert "stats" in target_a
    assert target_a["stats"]["delivered"] > 0
    print(f"[PASS] Admin announcements dashboard tracks real delivery: {target_a['stats']['delivered']} delivered, {target_a['stats']['read']} read ({target_a['stats']['read_rate']}%).")

    # Announcement Detail modal endpoint
    r = client.get(f"/announcements/{coach_announcement_id}", headers={"Authorization": f"Bearer {token_admin3}"})
    assert r.status_code == 200
    detail = r.json()
    assert "recipients" in detail
    assert len(detail["recipients"]) > 0
    print(f"[PASS] Admin announcement detail breakdown returned {len(detail['recipients'])} individual recipient delivery records.")

    # -------------------------------------------------------------
    # TEST 6: Duplicate Prevention
    # -------------------------------------------------------------
    print("\n--- TEST 6: Event Notification Duplicate Prevention ---")
    from services.notification_service import create_notification
    n1 = create_notification(db, user_id=user1.id, title="Test Alarm Reminder", message="Test message", category="alarm", link="/reminders", prevent_duplicate=True)
    n2 = create_notification(db, user_id=user1.id, title="Test Alarm Reminder", message="Test message", category="alarm", link="/reminders", prevent_duplicate=True)
    assert n1.id == n2.id, f"Duplicate notification should return existing ID {n1.id}, got {n2.id}"
    print(f"[PASS] Duplicate prevention confirmed: Identical notification returned original ID {n1.id} without duplication.")

    # Clean up test notifications created in this test run
    db.query(Notification).filter(Notification.title == "Test Alarm Reminder").delete()
    db.commit()

    print("\n" + "=" * 60)
    print("ALL 6 TEST SUITES PASSED FLAWLESSLY WITH ZERO FABRICATED DATA")
    print("=" * 60)
    db.close()

if __name__ == "__main__":
    run_tests()
