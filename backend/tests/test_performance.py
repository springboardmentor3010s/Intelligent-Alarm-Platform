import time

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


def test_profile_response_time():
    headers = get_auth_headers()

    start = time.perf_counter()

    response = client.get(
        "/profile",
        headers=headers
    )

    elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 3.0

    print(f"\nProfile response time: {elapsed:.3f} seconds")


def test_challenge_generation_response_time():
    headers = get_auth_headers()

    start = time.perf_counter()

    response = client.get(
        "/challenges/adaptive?challenge_type=math",
        headers=headers
    )

    elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 5.0

    print(f"\nAdaptive challenge response time: {elapsed:.3f} seconds")


def test_behavioral_analytics_response_time():
    headers = get_auth_headers()

    start = time.perf_counter()

    response = client.get(
        "/challenges/behavioral-analytics",
        headers=headers
    )

    elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 5.0

    print(f"\nBehavioral analytics response time: {elapsed:.3f} seconds")


def test_habit_score_response_time():
    headers = get_auth_headers()

    start = time.perf_counter()

    response = client.get(
        "/habit-score",
        headers=headers
    )

    elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 5.0

    print(f"\nHabit score response time: {elapsed:.3f} seconds")


def test_multiple_requests_performance():
    headers = get_auth_headers()

    start = time.perf_counter()

    for _ in range(5):
        response = client.get(
            "/profile",
            headers=headers
        )
        assert response.status_code == 200

    elapsed = time.perf_counter() - start

    assert elapsed < 10.0

    print(f"\n5 consecutive requests time: {elapsed:.3f} seconds")