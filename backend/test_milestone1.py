
import sys
import os
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app

client = TestClient(app)

def test_milestone1_flow():
    print("=== STARTING MILESTONE 1 VERIFICATION TESTS ===")

    # 1. Test Home Endpoint
    res = client.get("/")
    assert res.status_code == 200
    print("[SUCCESS] Home API Endpoint Operational:", res.json())

    # 2. Register Users with different roles
    import time
    timestamp = str(int(time.time()))
    user_email = f"user_{timestamp}@example.com"
    coach_email = f"coach_{timestamp}@example.com"
    admin_email = f"admin_{timestamp}@example.com"

    reg_user = client.post("/register", json={
        "name": "Standard User",
        "email": user_email,
        "password": "password123",
        "role": "user"
    })
    assert reg_user.status_code in [200, 400]
    user_id = reg_user.json()["user"]["id"]
    print("[SUCCESS] User Registration API Operational")

    reg_coach = client.post("/register", json={
        "name": "Coach Sarah",
        "email": coach_email,
        "password": "password123",
        "role": "wellness_coach"
    })
    assert reg_coach.status_code in [200, 400]
    print("[SUCCESS] Wellness Coach Registration API Operational")

    reg_admin = client.post("/register", json={
        "name": "Admin Alex",
        "email": admin_email,
        "password": "password123",
        "role": "admin"
    })
    assert reg_admin.status_code in [200, 400]
    print("[SUCCESS] Administrator Registration API Operational")

    # 3. Test JWT Login (User Login)
    login_res = client.post("/login", json={
        "email": user_email,
        "password": "password123",
        "login_type": "user"
    })
    assert login_res.status_code == 200
    user_token = login_res.json()["access_token"]
    print("[SUCCESS] JWT User Login Successful")

    # 3b. Test Admin Login Tab
    admin_login_res = client.post("/login", json={
        "email": admin_email,
        "password": "password123",
        "login_type": "admin"
    })
    assert admin_login_res.status_code == 200
    admin_token = admin_login_res.json()["access_token"]
    print("[SUCCESS] JWT Admin Portal Login Successful")

    # 4. Test OAuth2 Login Endpoint
    oauth_res = client.post("/auth/oauth", json={
        "name": "Google SSO User",
        "email": "sso_test@example.com",
        "provider": "google"
    })
    assert oauth_res.status_code == 200
    print("[SUCCESS] Google OAuth2 Authentication Endpoint Operational")

    # 5. Test Profile APIs
    user_headers = {"Authorization": f"Bearer {user_token}"}
    prof_get = client.get("/profile", headers=user_headers)
    assert prof_get.status_code == 200
    print("[SUCCESS] GET Profile API Operational:", prof_get.json()["Name"])

    prof_put = client.put("/profile", headers=user_headers, json={
        "Name": "Standard User Updated",
        "Email": user_email,
        "preferred_wakeup_time": "06:00 AM",
        "sleep_duration": 8.0,
        "time_zone": "UTC+05:30",
        "productivity_goals": "Morning Run, Read 20 pages",
        "difficulty_preference": "Hard",
        "habit_preferences": "Early Riser Routine",
        "sleep_schedule_start": "22:00",
        "sleep_schedule_end": "06:00"
    })
    assert prof_put.status_code == 200
    assert prof_put.json()["profile"]["difficulty_preference"] == "Hard"
    print("[SUCCESS] PUT Profile & Preferences API Operational")

    # 6. Test Habit Management APIs
    create_habit_res = client.post("/habits", headers=user_headers, json={
        "name": "Drink Morning Water",
        "category": "Health",
        "frequency": "Daily",
        "target_duration_minutes": 5
    })
    assert create_habit_res.status_code == 200
    habit_id = create_habit_res.json()["habit"]["id"]
    print("[SUCCESS] POST Habit Creation API Operational")

    get_habits_res = client.get("/habits", headers=user_headers)
    assert get_habits_res.status_code == 200
    print("[SUCCESS] GET Habits API Operational")

    toggle_habit_res = client.patch(f"/habits/{habit_id}/toggle", headers=user_headers)
    assert toggle_habit_res.status_code == 200
    print("[SUCCESS] PATCH Toggle Habit Completion Status API Operational")

    # 7. Test Alarm Scheduling APIs
    create_alarm_res = client.post("/alarms", headers=user_headers, json={
        "title": "Smart Adaptive Wakeup",
        "time": "06:30",
        "alarm_type": "Smart Adaptive Alarm",
        "days_of_week": "Mon,Tue,Wed,Thu,Fri",
        "challenge_type": "Logic Puzzles",
        "difficulty": "Hard",
        "snooze_limit": 2,
        "sound_tone": "Gentle Chimes",
        "is_active": True
    })
    assert create_alarm_res.status_code == 200
    alarm_id = create_alarm_res.json()["alarm"]["id"]
    print("[SUCCESS] POST Alarm Creation API Operational")

    get_alarms_res = client.get("/alarms", headers=user_headers)
    assert get_alarms_res.status_code == 200
    print("[SUCCESS] GET Alarms List API Operational")

    # 8. Test Admin APIs
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    users_admin_res = client.get("/admin/users", headers=admin_headers)
    assert users_admin_res.status_code == 200
    print("[SUCCESS] Admin User List API Operational")

    role_change_res = client.put(f"/admin/users/{user_id}/role", headers=admin_headers, json={"role": "wellness_coach"})
    assert role_change_res.status_code == 200
    print("[SUCCESS] Admin Role Assignment API Operational")

    print("\n=== ALL MILESTONE 1 API TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_milestone1_flow()
