from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


# =========================================================
# End-to-End Cognitive Alarm Workflow Test
# =========================================================

def test_complete_user_workflow():

    # -----------------------------------------------------
    # 1. LOGIN
    # -----------------------------------------------------

    login_response = client.post(
        "/login",
        json={
            "email": "testuser123@gmail.com",
            "password": "Test12345"
        }
    )

    assert login_response.status_code == 200

    login_data = login_response.json()

    assert "access_token" in login_data
    assert "user_id" in login_data

    token = login_data["access_token"]

    headers = {
        "Authorization": f"Bearer {token}"
    }


    # -----------------------------------------------------
    # 2. VERIFY AUTHENTICATED PROFILE
    # -----------------------------------------------------

    profile_response = client.get(
        "/profile",
        headers=headers
    )

    assert profile_response.status_code == 200

    profile_data = profile_response.json()

    assert profile_data["user_id"] == login_data["user_id"]


    # -----------------------------------------------------
    # 3. GENERATE ADAPTIVE CHALLENGES
    # -----------------------------------------------------

    challenge_ids = []

    for _ in range(3):

        challenge_response = client.get(
            "/challenges/adaptive",
            params={
                "challenge_type": "math"
            },
            headers=headers
        )

        assert challenge_response.status_code == 200

        challenge_data = challenge_response.json()

        assert "challenge_id" in challenge_data
        assert "challenge_type" in challenge_data
        assert "difficulty" in challenge_data

        assert challenge_data["challenge_type"] == "math"

        assert challenge_data["difficulty"] in [
            "easy",
            "medium",
            "hard"
        ]

        assert challenge_data["adaptive_ai"] == (
            "M3 baseline + M4 Reinforcement Learning"
        )

        challenge_ids.append(
            challenge_data["challenge_id"]
        )


    # -----------------------------------------------------
    # 4. ANSWER EACH CHALLENGE
    # -----------------------------------------------------

    for challenge_id in challenge_ids:

        answer_response = client.post(
            f"/challenges/{challenge_id}/answer",
            json={
                "answer": "__e2e_test_answer__",
                "time_taken": 5
            },
            headers=headers
        )

        assert answer_response.status_code == 200

        answer_data = answer_response.json()

        assert answer_data["challenge_id"] == challenge_id
        assert "is_correct" in answer_data
        assert "attempts" in answer_data


    # -----------------------------------------------------
    # 5. CHECK CHALLENGE HISTORY
    # -----------------------------------------------------

    history_response = client.get(
        "/challenges/history",
        headers=headers
    )

    assert history_response.status_code == 200

    history_data = history_response.json()

    assert isinstance(history_data, list)

    assert len(history_data) >= 3


    # -----------------------------------------------------
    # 6. CHECK CHALLENGE ANALYTICS
    # -----------------------------------------------------

    analytics_response = client.get(
        "/challenges/analytics",
        headers=headers
    )

    assert analytics_response.status_code == 200

    analytics_data = analytics_response.json()

    assert analytics_data["total_challenges"] >= 3
    assert "accuracy_percentage" in analytics_data
    assert "average_time_seconds" in analytics_data


    # -----------------------------------------------------
    # 7. PYTORCH BEHAVIOR PREDICTION
    # -----------------------------------------------------

    pytorch_response = client.get(
        "/ai/pytorch-behavior",
        headers=headers
    )

    assert pytorch_response.status_code == 200

    pytorch_data = pytorch_response.json()

    assert pytorch_data["model"] == "PyTorch"


    # -----------------------------------------------------
    # 8. REINFORCEMENT LEARNING
    # -----------------------------------------------------

    rl_response = client.get(
        "/ai/rl-adaptive-difficulty",
        headers=headers
    )

    assert rl_response.status_code == 200

    rl_data = rl_response.json()

    assert rl_data["model"] == "Reinforcement Learning"

    assert rl_data["selected_difficulty"] in [
        "easy",
        "medium",
        "hard"
    ]

    assert rl_data["state"] in [
        "low",
        "moderate",
        "good",
        "excellent"
    ]


    # -----------------------------------------------------
    # 9. BEHAVIORAL ANALYTICS
    # -----------------------------------------------------

    behavior_response = client.get(
        "/challenges/behavioral-analytics",
        params={
            "period": "weekly"
        },
        headers=headers
    )

    assert behavior_response.status_code == 200

    behavior_data = behavior_response.json()

    assert "total_attempts" in behavior_data
    assert "accuracy" in behavior_data
    assert "wake_up_behavior" in behavior_data
    assert "snooze_behavior" in behavior_data


    # -----------------------------------------------------
    # 10. HABIT SCORE
    # -----------------------------------------------------

    habit_response = client.get(
        "/habit-score",
        headers=headers
    )

    assert habit_response.status_code == 200

    habit_data = habit_response.json()

    assert habit_data is not None


    # -----------------------------------------------------
    # 11. RECOMMENDATIONS
    # -----------------------------------------------------

    recommendation_response = client.get(
        "/recommendations",
        headers=headers
    )

    assert recommendation_response.status_code == 200

    recommendation_data = recommendation_response.json()

    assert isinstance(
        recommendation_data,
        list
    )


    # -----------------------------------------------------
    # FINAL VERIFICATION
    # -----------------------------------------------------

    print("\n========================================")
    print("END-TO-END WORKFLOW TEST PASSED")
    print("========================================")
    print("Login                 : PASS")
    print("Profile               : PASS")
    print("Adaptive Challenges   : PASS")
    print("Challenge Answers     : PASS")
    print("Challenge History     : PASS")
    print("Challenge Analytics   : PASS")
    print("PyTorch Prediction    : PASS")
    print("Reinforcement Learning: PASS")
    print("Behavioral Analytics  : PASS")
    print("Habit Score           : PASS")
    print("Recommendations       : PASS")
    print("========================================")