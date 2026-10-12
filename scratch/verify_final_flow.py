import requests

BASE_URL = "http://127.0.0.1:8000/api"

def test_flow():
    print("--- COMPREHENSIVE AUTHENTICATION & ROLE-BASED ACCESS SUITE ---")
    
    # 1. Health check
    r = requests.get("http://127.0.0.1:8000/health")
    assert r.status_code == 200, f"Backend health check failed: {r.status_code}"
    print("1. Backend Health Check: OK")

    # 2. Registration testing for USER, WELLNESS_COACH, ADMIN
    import time
    ts = int(time.time())
    users_to_test = [
        (f"user_{ts}", f"user_{ts}@cognitivewake.com", "USER", None),
        (f"mod_{ts}", f"mod_{ts}@cognitivewake.com", "WELLNESS_COACH", "MOD123"),
        (f"admin_{ts}", f"admin_{ts}@cognitivewake.com", "ADMIN", "ADMIN123"),
    ]
    
    tokens = {}
    
    for username, email, role, sec_code in users_to_test:
        reg_payload = {
            "name": f"Cognitive {role} Account",
            "username": username,
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "timezone": "Asia/Kolkata",
            "role": role,
            "security_code": sec_code
        }
        r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
        print(f"2. Registration for {role} ({username}): Status {r.status_code}")
        assert r.status_code in [200, 409], f"Registration failed: {r.text}"

        # 3. Successful Login test (matching credentials + matching selected role)
        login_payload = {
            "email": username,
            "password": "Password123!",
            "role": role
        }
        r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
        assert r.status_code == 200, f"Login failed for {role}: {r.text}"
        data = r.json()
        tokens[role] = data["access_token"]
        assert data["user"]["role"] == role, f"Expected role {role}, got {data['user']['role']}"
        print(f"3. Login for {role} with matching selected role: SUCCESS")

    # 4. Mismatched Role Login Matrix Tests (Requirement 16)
    mismatch_cases = [
        (f"user_{ts}", "WELLNESS_COACH"),
        (f"user_{ts}", "ADMIN"),
        (f"mod_{ts}", "USER"),
        (f"mod_{ts}", "ADMIN"),
        (f"admin_{ts}", "USER"),
        (f"admin_{ts}", "WELLNESS_COACH"),
    ]
    
    for username, wrong_role in mismatch_cases:
        r = requests.post(f"{BASE_URL}/auth/login", json={
            "email": username,
            "password": "Password123!",
            "role": wrong_role
        })
        assert r.status_code == 401, f"Mismatch case ({username} as {wrong_role}) was not rejected! Status: {r.status_code}"
        assert r.json().get("detail") == "Invalid username or password.", f"Unexpected error message: {r.json()}"
        print(f"4. Mismatch check ({username} selecting {wrong_role}): REJECTED correctly (401)")

    # 5. Wrong Password & Username Tests
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": f"user_{ts}", "password": "WrongPassword!", "role": "USER"})
    assert r.status_code == 401 and r.json().get("detail") == "Invalid username or password."
    print("5. Wrong password test: REJECTED correctly (401)")

    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "nonexistent_user", "password": "Password123!", "role": "USER"})
    assert r.status_code == 401 and r.json().get("detail") == "Invalid username or password."
    print("6. Non-existent user test: REJECTED correctly (401)")

    # 6. Protected Endpoint Access Security Checks
    user_headers = {"Authorization": f"Bearer {tokens['USER']}"}
    mod_headers = {"Authorization": f"Bearer {tokens['WELLNESS_COACH']}"}
    admin_headers = {"Authorization": f"Bearer {tokens['ADMIN']}"}

    # USER trying to call Admin endpoint
    r = requests.get(f"{BASE_URL}/admin/users", headers=user_headers)
    assert r.status_code == 403, f"USER was able to call admin endpoint: {r.status_code}"
    print("7. Protected API Check: USER blocked from /admin/users (403)")

    # WELLNESS_COACH trying to call Admin endpoint
    r = requests.get(f"{BASE_URL}/admin/users", headers=mod_headers)
    assert r.status_code == 403, f"WELLNESS_COACH was able to call admin endpoint: {r.status_code}"
    print("8. Protected API Check: WELLNESS_COACH blocked from /admin/users (403)")

    # ADMIN calling Admin endpoint
    r = requests.get(f"{BASE_URL}/admin/users", headers=admin_headers)
    assert r.status_code == 200, f"ADMIN failed to call admin endpoint: {r.status_code}"
    print("9. Protected API Check: ADMIN allowed to /admin/users (200)")

    print("\nSUCCESS: All authentication and role security checks passed!")

if __name__ == "__main__":
    test_flow()
