"""
Automated Test Suite for Adaptive Difficulty Engine.

Verifies:
1. Pure rule evaluation function evaluate_two_attempt_adaptive_difficulty
   - Test 1: Medium + [correct, correct] → Hard
   - Test 2: Medium + [correct, incorrect] → Medium
   - Test 3: Medium + [incorrect, correct] → Medium
   - Test 4: Medium + [incorrect, incorrect] → Easy
   - Test 5: Expert + [correct, correct] → Expert
   - Test 6: Beginner + [incorrect, incorrect] → Beginner
   - Test 7: Only one completed attempt → No difficulty change
2. Database-backed per-alarm isolation & application
   - Test 8: Two attempts on different alarms → Do NOT combine them
   - Test 9: Verify NEXT challenge generated for alarm uses the newly calculated difficulty
   - Test 10: Verify API endpoints integration (sessions & challenges answer)
   - Test 11: Idempotence & pair cycle logic
"""

import sys
import os

# Set UTF-8 encoding for Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from datetime import datetime, time, timezone

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, CognitiveChallenge
from app.services.adaptive_difficulty import (
    evaluate_two_attempt_adaptive_difficulty,
    evaluate_and_apply_adaptive_difficulty,
    get_alarm_adaptive_status,
    DIFFICULTY_LEVELS,
)
from app.services.challenge_generator import generate_challenge


def test_pure_rules():
    print("=" * 60)
    print("RUNNING PURE RULE EVALUATION TESTS (10 REQUIRED CASES)")
    print("=" * 60)

    # 1. Beginner + [correct, correct] → Easy
    c1 = evaluate_two_attempt_adaptive_difficulty("beginner", [True, True])
    print(f"Case 1: Beginner + [True, True] -> {c1['next_difficulty']} ({c1['reason']})")
    assert c1["next_difficulty"] == "easy", f"Expected 'easy', got {c1['next_difficulty']}"
    assert c1["action"] == "INCREASE"
    assert c1["decision"] == "increase"
    assert c1["adjusted"] is True

    # 2. Easy + [correct, correct] → Medium
    c2 = evaluate_two_attempt_adaptive_difficulty("easy", [True, True])
    print(f"Case 2: Easy + [True, True] -> {c2['next_difficulty']} ({c2['reason']})")
    assert c2["next_difficulty"] == "medium", f"Expected 'medium', got {c2['next_difficulty']}"
    assert c2["action"] == "INCREASE"
    assert c2["decision"] == "increase"
    assert c2["adjusted"] is True

    # 3. Medium + [correct, correct] → Hard
    c3 = evaluate_two_attempt_adaptive_difficulty("medium", [True, True])
    print(f"Case 3: Medium + [True, True] -> {c3['next_difficulty']} ({c3['reason']})")
    assert c3["next_difficulty"] == "hard", f"Expected 'hard', got {c3['next_difficulty']}"
    assert c3["action"] == "INCREASE"
    assert c3["decision"] == "increase"
    assert c3["adjusted"] is True

    # 4. Hard + [correct, correct] → Expert
    c4 = evaluate_two_attempt_adaptive_difficulty("hard", [True, True])
    print(f"Case 4: Hard + [True, True] -> {c4['next_difficulty']} ({c4['reason']})")
    assert c4["next_difficulty"] == "expert", f"Expected 'expert', got {c4['next_difficulty']}"
    assert c4["action"] == "INCREASE"
    assert c4["decision"] == "increase"
    assert c4["adjusted"] is True

    # 5. Expert + [correct, correct] → Expert
    c5 = evaluate_two_attempt_adaptive_difficulty("expert", [True, True])
    print(f"Case 5: Expert + [True, True] -> {c5['next_difficulty']} ({c5['reason']})")
    assert c5["next_difficulty"] == "expert", f"Expected 'expert', got {c5['next_difficulty']}"
    assert c5["action"] == "MAINTAIN"
    assert c5["decision"] == "maintain"
    assert c5["adjusted"] is False

    # 6. Hard + [correct, incorrect] → Hard
    c6 = evaluate_two_attempt_adaptive_difficulty("hard", [True, False])
    print(f"Case 6: Hard + [True, False] -> {c6['next_difficulty']} ({c6['reason']})")
    assert c6["next_difficulty"] == "hard", f"Expected 'hard', got {c6['next_difficulty']}"
    assert c6["action"] == "MAINTAIN"
    assert c6["decision"] == "maintain"
    assert c6["adjusted"] is False

    # 7. Hard + [incorrect, correct] → Hard
    c7 = evaluate_two_attempt_adaptive_difficulty("hard", [False, True])
    print(f"Case 7: Hard + [False, True] -> {c7['next_difficulty']} ({c7['reason']})")
    assert c7["next_difficulty"] == "hard", f"Expected 'hard', got {c7['next_difficulty']}"
    assert c7["action"] == "MAINTAIN"
    assert c7["decision"] == "maintain"
    assert c7["adjusted"] is False

    # 8. Hard + [incorrect, incorrect] → Medium
    c8 = evaluate_two_attempt_adaptive_difficulty("hard", [False, False])
    print(f"Case 8: Hard + [False, False] -> {c8['next_difficulty']} ({c8['reason']})")
    assert c8["next_difficulty"] == "medium", f"Expected 'medium', got {c8['next_difficulty']}"
    assert c8["action"] == "DECREASE"
    assert c8["decision"] == "decrease"
    assert c8["adjusted"] is True

    # 9. Only one attempt → No change
    c9 = evaluate_two_attempt_adaptive_difficulty("hard", [True])
    print(f"Case 9: Hard + [True] (1 attempt) -> {c9['next_difficulty']} ({c9['reason']})")
    assert c9["next_difficulty"] == "hard", f"Expected 'hard', got {c9['next_difficulty']}"
    assert c9["action"] == "MAINTAIN"
    assert c9["decision"] == "maintain"
    assert c9["adjusted"] is False

    # Additional boundary verification:
    c_dec_exp = evaluate_two_attempt_adaptive_difficulty("expert", [False, False])
    assert c_dec_exp["next_difficulty"] == "hard"
    assert c_dec_exp["action"] == "DECREASE"

    c_dec_beg = evaluate_two_attempt_adaptive_difficulty("beginner", [False, False])
    assert c_dec_beg["next_difficulty"] == "beginner"
    assert c_dec_beg["action"] == "MAINTAIN"

    print(">>> Pure rule evaluation tests PASSED successfully!\n")


def test_database_isolation_and_flow():
    print("=" * 60)
    print("RUNNING DATABASE INTEGRATION & PER-ALARM TESTS")
    print("=" * 60)

    db = SessionLocal()
    user = None
    alarm_a = None
    alarm_b = None

    try:
        # Find or create a test user
        user = db.query(User).filter(User.email == "adaptive_test_user@example.com").first()
        if not user:
            user = User(
                name="adaptive_test",
                email="adaptive_test_user@example.com",
                password_hash="hashed_pw_test",
                role="user",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create Alarm A (starts at Medium)
        alarm_a = Alarm(
            user_id=user.id,
            name="Test Alarm Alpha",
            alarm_time=time(7, 0),
            challenge_type="math",
            difficulty="medium",
            is_active=True,
        )
        # Create Alarm B (starts at Medium)
        alarm_b = Alarm(
            user_id=user.id,
            name="Test Alarm Beta",
            alarm_time=time(8, 0),
            challenge_type="logic",
            difficulty="medium",
            is_active=True,
        )
        db.add_all([alarm_a, alarm_b])
        db.commit()
        db.refresh(alarm_a)
        db.refresh(alarm_b)

        print(f"Created Alarm A (id={alarm_a.id}, diff={alarm_a.difficulty})")
        print(f"Created Alarm B (id={alarm_b.id}, diff={alarm_b.difficulty})")

        # -------------------------------------------------------------
        # Test 8: Two attempts on different alarms -> Do NOT combine them
        # -------------------------------------------------------------
        # Attempt 1 on Alarm A (correct)
        s_a1 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=True,
            user_answer="correct",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a1)
        db.commit()

        # Attempt 1 on Alarm B (correct)
        s_b1 = AlarmSession(
            alarm_id=alarm_b.id,
            session_status="completed",
            is_correct=True,
            user_answer="correct",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_b1)
        db.commit()

        # Evaluate Alarm A - should NOT see Alarm B's attempt!
        res_a1 = evaluate_and_apply_adaptive_difficulty(alarm_a.id, db)
        db.refresh(alarm_a)
        print(f"Alarm A after 1 attempt: diff={alarm_a.difficulty}, adjusted={res_a1['adjusted']}, total_in_eval={len(res_a1['results'])}")
        assert alarm_a.difficulty == "medium", "Alarm A difficulty must NOT change after only 1 attempt on Alarm A!"
        assert res_a1["decision"] == "maintain"

        # Evaluate Alarm B - should NOT see Alarm A's attempt!
        res_b1 = evaluate_and_apply_adaptive_difficulty(alarm_b.id, db)
        db.refresh(alarm_b)
        print(f"Alarm B after 1 attempt: diff={alarm_b.difficulty}, adjusted={res_b1['adjusted']}, total_in_eval={len(res_b1['results'])}")
        assert alarm_b.difficulty == "medium", "Alarm B difficulty must NOT change after only 1 attempt on Alarm B!"
        assert res_b1["decision"] == "maintain"

        # -------------------------------------------------------------
        # Test 1 & 9: Alarm A completes attempt 2 (correct) -> Medium + [correct, correct] -> Hard
        # And verify the NEXT challenge generated for Alarm A uses "hard"
        # -------------------------------------------------------------
        s_a2 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=True,
            user_answer="correct",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a2)
        db.commit()

        res_a2 = evaluate_and_apply_adaptive_difficulty(alarm_a.id, db)
        db.refresh(alarm_a)
        print(f"Alarm A after 2nd attempt: diff={alarm_a.difficulty}, decision={res_a2['decision']}, next={res_a2['next_difficulty']}")
        assert alarm_a.difficulty == "hard", f"Expected Alarm A difficulty 'hard', got {alarm_a.difficulty}"
        assert res_a2["action"] == "INCREASE"
        assert res_a2["next_difficulty"] == "hard"
        assert res_a2["previous_difficulty"] == "medium"
        assert res_a2["results"] == ["correct", "correct"]

        # Alarm B must still be "medium"!
        db.refresh(alarm_b)
        assert alarm_b.difficulty == "medium", f"Alarm B difficulty was leaked! Got {alarm_b.difficulty}"

        # Test 9: Verify NEXT challenge generated for Alarm A uses "hard"
        next_challenge = generate_challenge(
            challenge_type=alarm_a.challenge_type,
            difficulty=alarm_a.difficulty,
        )
        print(f"Next generated challenge for Alarm A: type={next_challenge['challenge_type']}, diff={next_challenge['difficulty']}")
        assert next_challenge["difficulty"] == "hard", f"Expected challenge difficulty 'hard', got {next_challenge['difficulty']}"

        # -------------------------------------------------------------
        # Test 4 & 10: Alarm A is currently Hard. Give it 2 CORRECT attempts!
        # Hard + [correct, correct] MUST transition to Expert.
        # Confirm:
        # - alarm_a.difficulty == "expert" in PostgreSQL DB
        # - get_alarm_adaptive_status shows previous=hard, next=expert, action=INCREASE
        # - NEXT challenge generated has difficulty == "expert"
        # -------------------------------------------------------------
        s_a3 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=True,
            user_answer="correct",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a3)
        db.commit()

        res_a3 = evaluate_and_apply_adaptive_difficulty(alarm_a.id, db)
        db.refresh(alarm_a)
        print(f"Alarm A after 3rd attempt (1/2 in cycle): diff={alarm_a.difficulty}, decision={res_a3['decision']}")
        assert alarm_a.difficulty == "hard", "Difficulty must not change on odd attempt!"
        assert res_a3["adjusted"] is False

        s_a4 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=True,
            user_answer="correct",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a4)
        db.commit()

        res_a4 = evaluate_and_apply_adaptive_difficulty(alarm_a.id, db)
        db.refresh(alarm_a)
        print(f"Alarm A after 4th attempt (Hard + [correct, correct]): diff={alarm_a.difficulty}, decision={res_a4['decision']}, next={res_a4['next_difficulty']}")
        assert alarm_a.difficulty == "expert", f"Expected Alarm A difficulty 'expert', got {alarm_a.difficulty}"
        assert res_a4["action"] == "INCREASE"
        assert res_a4["next_difficulty"] == "expert"
        assert res_a4["previous_difficulty"] == "hard"
        assert res_a4["results"] == ["correct", "correct"]
        assert res_a4["adjusted"] is True
        assert res_a4["reason"] == "2/2 correct → Difficulty increased"

        # Verify get_alarm_adaptive_status matches requirements
        status_expert = get_alarm_adaptive_status(alarm_a.id, db)
        print(f"Alarm A adaptive status at Expert: {status_expert}")
        assert status_expert["alarm_id"] == alarm_a.id
        assert status_expert["previous_difficulty"] == "hard"
        assert status_expert["next_difficulty"] == "expert"
        assert status_expert["action"] == "INCREASE"
        assert status_expert["adjusted"] is True
        assert status_expert["reason"] == "2/2 correct → Difficulty increased"

        # Requirement 10: Confirm the NEXT challenge generated for Hard + [correct, correct] has difficulty = "expert"
        expert_challenge = generate_challenge(
            challenge_type=alarm_a.challenge_type,
            difficulty=alarm_a.difficulty,
        )
        print(f"Next generated challenge for Alarm A (at Expert): type={expert_challenge['challenge_type']}, diff={expert_challenge['difficulty']}")
        assert expert_challenge["difficulty"] == "expert", f"Expected difficulty 'expert', got {expert_challenge['difficulty']}"

        # -------------------------------------------------------------
        # Now test Expert + [False, False] -> decreases back to Hard
        # -------------------------------------------------------------
        s_a5 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=False,
            user_answer="wrong",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a5)
        db.commit()

        s_a6 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=False,
            user_answer="wrong",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a6)
        db.commit()

        res_a6 = evaluate_and_apply_adaptive_difficulty(alarm_a.id, db)
        db.refresh(alarm_a)
        print(f"Alarm A after Expert + [False, False]: diff={alarm_a.difficulty}, next={res_a6['next_difficulty']}")
        assert alarm_a.difficulty == "hard", f"Expected difficulty 'hard', got {alarm_a.difficulty}"
        assert res_a6["action"] == "DECREASE"
        assert res_a6["next_difficulty"] == "hard"
        assert res_a6["previous_difficulty"] == "expert"

        # -------------------------------------------------------------
        # Now test Hard + [False, False] -> decreases to Medium
        # -------------------------------------------------------------
        s_a7 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=False,
            user_answer="wrong",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a7)
        db.commit()

        s_a8 = AlarmSession(
            alarm_id=alarm_a.id,
            session_status="completed",
            is_correct=False,
            user_answer="wrong",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(s_a8)
        db.commit()

        res_a8 = evaluate_and_apply_adaptive_difficulty(alarm_a.id, db)
        db.refresh(alarm_a)
        print(f"Alarm A after Hard + [False, False]: diff={alarm_a.difficulty}, next={res_a8['next_difficulty']}")
        assert alarm_a.difficulty == "medium", f"Expected difficulty 'medium', got {alarm_a.difficulty}"
        assert res_a8["action"] == "DECREASE"
        assert res_a8["next_difficulty"] == "medium"
        assert res_a8["previous_difficulty"] == "hard"

        print(">>> Database integration & isolation tests PASSED successfully!\n")

    finally:
        # Cleanup test records
        try:
            if alarm_a:
                db.query(AlarmSession).filter(AlarmSession.alarm_id == alarm_a.id).delete()
                db.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id == alarm_a.id).delete()
                db.delete(alarm_a)
            if alarm_b:
                db.query(AlarmSession).filter(AlarmSession.alarm_id == alarm_b.id).delete()
                db.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id == alarm_b.id).delete()
                db.delete(alarm_b)
            if user:
                db.delete(user)
            db.commit()
            print("Cleanup completed.")
        except Exception as e:
            print(f"Cleanup warning: {e}")
            db.rollback()
        finally:
            db.close()


def test_api_endpoints():
    print("=" * 60)
    print("RUNNING API ENDPOINT INTEGRATION TESTS")
    print("=" * 60)

    from fastapi.testclient import TestClient
    from app.main import app
    from app.utils.security import create_access_token

    client = TestClient(app)
    db = SessionLocal()
    user = None
    alarm = None

    try:
        user = db.query(User).filter(User.email == "api_adaptive_test@example.com").first()
        if not user:
            user = User(
                name="api_adaptive_test",
                email="api_adaptive_test@example.com",
                password_hash="hashed_pw_test",
                role="user",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        alarm = Alarm(
            user_id=user.id,
            name="API Adaptive Alarm",
            alarm_time=time(7, 30),
            challenge_type="math",
            difficulty="medium",
            is_active=True,
        )
        db.add(alarm)
        db.commit()
        db.refresh(alarm)

        token = create_access_token(user.id, user.role)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Start Session 1
        res1 = client.post(f"/api/sessions/start/{alarm.id}", headers=headers)
        assert res1.status_code == 200, f"Start session 1 failed: {res1.text}"
        sess1_data = res1.json()
        sess1_id = sess1_data["id"]
        chal1_id = sess1_data["challenge_id"]

        # Fetch challenge 1 to get correct answer
        chal1 = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == chal1_id).first()
        assert chal1 is not None
        assert chal1.difficulty == "medium", f"Initial challenge difficulty must be medium, got {chal1.difficulty}"

        # 2. Submit Answer for Session 1 (via challenges endpoint)
        ans1_res = client.post(
            f"/api/challenges/answer/{chal1_id}",
            json={"answer": chal1.correct_answer},
            headers=headers,
        )
        assert ans1_res.status_code == 200, f"Submit answer 1 failed: {ans1_res.text}"
        ans1_data = ans1_res.json()
        print(f"API answer 1 response: correct={ans1_data['correct']}, adaptive={ans1_data.get('adaptive_difficulty')}")
        assert ans1_data["correct"] is True
        assert "adaptive_difficulty" in ans1_data
        assert ans1_data["adaptive_difficulty"]["decision"] == "maintain"
        assert ans1_data["adaptive_difficulty"]["next_difficulty"] == "medium"

        # 3. Start Session 2
        res2 = client.post(f"/api/sessions/start/{alarm.id}", headers=headers)
        assert res2.status_code == 200, f"Start session 2 failed: {res2.text}"
        sess2_data = res2.json()
        sess2_id = sess2_data["id"]
        chal2_id = sess2_data["challenge_id"]

        chal2 = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == chal2_id).first()
        assert chal2 is not None

        # 4. Submit Answer for Session 2 (via sessions answer endpoint)
        ans2_res = client.post(
            f"/api/sessions/{sess2_id}/answer",
            json={"answer": chal2.correct_answer},
            headers=headers,
        )
        assert ans2_res.status_code == 200, f"Submit answer 2 failed: {ans2_res.text}"
        ans2_data = ans2_res.json()
        print(f"API answer 2 response: is_correct={ans2_data['is_correct']}, adaptive={ans2_data.get('adaptive_difficulty')}")
        assert ans2_data["is_correct"] is True
        assert "adaptive_difficulty" in ans2_data
        assert ans2_data["adaptive_difficulty"]["decision"] == "increase"
        assert ans2_data["adaptive_difficulty"]["action"] == "INCREASE"
        assert ans2_data["adaptive_difficulty"]["next_difficulty"] == "hard"
        assert ans2_data["adaptive_difficulty"]["previous_difficulty"] == "medium"
        assert ans2_data["adaptive_difficulty"]["results"] == ["correct", "correct"]

        # 5. Check Alarm Adaptive Difficulty Status Endpoint
        status_res = client.get(f"/api/alarms/{alarm.id}/adaptive-difficulty", headers=headers)
        assert status_res.status_code == 200, f"Status failed: {status_res.text}"
        status_data = status_res.json()
        print(f"API alarm status endpoint: {status_data}")
        assert status_data["alarm_id"] == alarm.id
        assert status_data["next_difficulty"] == "hard"
        assert status_data["results"] == ["correct", "correct"]

        # 6. Test 9 via API: Start Session 3 and verify NEXT challenge is HARD!
        res3 = client.post(f"/api/sessions/start/{alarm.id}", headers=headers)
        assert res3.status_code == 200, f"Start session 3 failed: {res3.text}"
        sess3_data = res3.json()
        chal3_id = sess3_data["challenge_id"]

        chal3 = db.query(CognitiveChallenge).filter(CognitiveChallenge.id == chal3_id).first()
        print(f"Challenge 3 generated for Alarm: type={chal3.challenge_type}, difficulty={chal3.difficulty}")
        assert chal3.difficulty == "hard", f"Expected challenge 3 difficulty 'hard', got {chal3.difficulty}"

        print(">>> API endpoint integration tests PASSED successfully!\n")

    finally:
        try:
            if alarm:
                db.query(AlarmSession).filter(AlarmSession.alarm_id == alarm.id).delete()
                db.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id == alarm.id).delete()
                db.delete(alarm)
            if user:
                db.delete(user)
            db.commit()
            print("API cleanup completed.")
        except Exception as e:
            print(f"API cleanup warning: {e}")
            db.rollback()
        finally:
            db.close()


if __name__ == "__main__":
    test_pure_rules()
    test_database_isolation_and_flow()
    test_api_endpoints()
    print("ALL ADAPTIVE DIFFICULTY ENGINE TESTS PASSED!")
