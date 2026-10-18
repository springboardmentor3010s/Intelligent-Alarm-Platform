from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

TEST_EMAIL = "testuser123@gmail.com"
TEST_PASSWORD = "Test12345"


def get_auth_headers():
    response = client.post(
        "/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


def test_protected_endpoint_without_token():
    response = client.get("/profile")

    assert response.status_code in (401, 403)


def test_protected_endpoint_with_invalid_token():
    headers = {
        "Authorization": "Bearer invalid-token"
    }

    response = client.get("/profile", headers=headers)

    assert response.status_code in (401, 403)


def test_normal_user_cannot_access_admin_dashboard():
    headers = get_auth_headers()

    response = client.get(
        "/admin/executive-analytics",
        headers=headers
    )

    assert response.status_code == 403


def test_normal_user_cannot_access_admin_test():
    headers = get_auth_headers()

    response = client.get(
        "/admin-test",
        headers=headers
    )

    assert response.status_code == 403


def test_normal_user_cannot_access_coach_endpoint():
    headers = get_auth_headers()

    response = client.get(
        "/coach-test",
        headers=headers
    )

    assert response.status_code == 403


def test_valid_user_can_access_profile():
    headers = get_auth_headers()

    response = client.get(
        "/profile",
        headers=headers
    )

    assert response.status_code == 200


def test_invalid_challenge_type_is_rejected():
    headers = get_auth_headers()

    response = client.get(
        "/challenges/adaptive?challenge_type=invalid_type",
        headers=headers
    )

    assert response.status_code == 400