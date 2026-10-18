import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


# =========================================================
# Basic API Tests
# =========================================================

def test_home():
    response = client.get("/")

    assert response.status_code == 200
    assert "message" in response.json()


def test_database_connection():
    response = client.get("/database-test")

    assert response.status_code == 200
    assert response.json()["status"] in ["success", "error"]


# =========================================================
# Authentication Tests
# =========================================================

def test_login():
    response = client.post(
        "/login",
        json={
            "email": "testuser123@gmail.com",
            "password": "Test12345"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert "user_id" in data
    assert "role" in data


# =========================================================
# Helper - Login
# =========================================================

def get_auth_headers():

    response = client.post(
        "/login",
        json={
            "email": "testuser123@gmail.com",
            "password": "Test12345"
        }
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


# =========================================================
# Authenticated User Tests
# =========================================================

def test_profile():

    headers = get_auth_headers()

    response = client.get(
        "/profile",
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()

    assert "user_id" in data
    assert "email" in data
    assert "role" in data


def test_get_alarms():

    headers = get_auth_headers()

    response = client.get(
        "/alarms",
        headers=headers
    )

    assert response.status_code == 200

    assert isinstance(
        response.json(),
        list
    )


# =========================================================
# Challenge Tests
# =========================================================

def test_challenge_analytics():

    headers = get_auth_headers()

    response = client.get(
        "/challenges/analytics",
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()

    assert "total_challenges" in data
    assert "accuracy_percentage" in data


def test_challenge_history():

    headers = get_auth_headers()

    response = client.get(
        "/challenges/history",
        headers=headers
    )

    assert response.status_code == 200

    assert isinstance(
        response.json(),
        list
    )


# =========================================================
# Adaptive Difficulty Test
# =========================================================

def test_adaptive_challenge():

    headers = get_auth_headers()

    response = client.get(
        "/challenges/adaptive",
        params={
            "challenge_type": "math"
        },
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()

    assert "challenge_id" in data
    assert "challenge_type" in data
    assert "difficulty" in data

    assert data["difficulty"] in [
        "easy",
        "medium",
        "hard"
    ]


# =========================================================
# PyTorch Test
# =========================================================

def test_pytorch_behavior():

    headers = get_auth_headers()

    response = client.get(
        "/ai/pytorch-behavior",
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()

    assert "model" in data
    assert data["model"] == "PyTorch"


# =========================================================
# Reinforcement Learning Test
# =========================================================

def test_rl_adaptive_difficulty():

    headers = get_auth_headers()

    response = client.get(
        "/ai/rl-adaptive-difficulty",
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()

    assert data["model"] == "Reinforcement Learning"

    assert data["selected_difficulty"] in [
        "easy",
        "medium",
        "hard"
    ]

    assert data["state"] in [
        "low",
        "moderate",
        "good",
        "excellent"
    ]


# =========================================================
# Habit Score Test
# =========================================================

def test_habit_score():

    headers = get_auth_headers()

    response = client.get(
        "/habit-score",
        headers=headers
    )

    assert response.status_code == 200


# =========================================================
# Behavioral Analytics Test
# =========================================================

def test_behavioral_analytics():

    headers = get_auth_headers()

    response = client.get(
        "/challenges/behavioral-analytics",
        params={
            "period": "weekly"
        },
        headers=headers
    )

    assert response.status_code == 200


# =========================================================
# Recommendation Test
# =========================================================

def test_recommendations():

    headers = get_auth_headers()

    response = client.get(
        "/recommendations",
        headers=headers
    )

    assert response.status_code == 200

    assert isinstance(
        response.json(),
        list
    )