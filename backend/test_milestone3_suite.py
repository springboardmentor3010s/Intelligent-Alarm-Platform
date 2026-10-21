import sys
import os
import unittest
from datetime import datetime, date

# Ensure all models and routes are loaded
import main
from database import SessionLocal
from Models.user import User, UserProfile
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent, Challenge, ChallengeAttempt
from services.analytics import adapt_alarm_difficulty, calculate_daily_habit_score, DIFFICULTIES
from services.difficulty_engine import get_next_difficulty, DIFFICULTY_LEVELS
from services.adaptive_difficulty import predict_performance
from services.recommendation import generate_daily_recommendations


def run_milestone3_tests():
    print("=" * 60)
    print("RUNNING MILESTONE 3: ADAPTIVE INTELLIGENCE & RECOMMENDATIONS TESTS")
    print("=" * 60)

    db = SessionLocal()
    user = db.query(User).filter(User.email == "Gagan2@gmail.com").first()
    if not user:
        user = db.query(User).first()
    user_id = user.id

    results = {}

    # ---------------------------------------------------------
    # TEST A: Successful Performance (Medium -> Hard)
    # ---------------------------------------------------------
    print("\n--- TEST A: Successful Performance ---")
    try:
        # Features: correctness=1.0, solve_time=10.0, attempts=1, difficulty=2 (Medium)
        res_a = get_next_difficulty(
            correctness=1.0,
            solve_time=10.0,
            attempts=1,
            current_difficulty="Medium"
        )
        print(f"Predicted Performance: {res_a['performance']}")
        print(f"Action: {res_a['action']} (2=Harder)")
        print(f"Current Difficulty: {res_a['current_difficulty']} -> Next: {res_a['next_difficulty']}")
        
        assert res_a["performance"] == "High", f"Expected High, got {res_a['performance']}"
        assert res_a["action"] == 2, f"Expected action 2 (Harder), got {res_a['action']}"
        assert res_a["next_difficulty"] == "Hard", f"Expected Hard, got {res_a['next_difficulty']}"
        print("[PASS] TEST A passed successfully.")
        results["TEST A"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST A failed: {e}")
        results["TEST A"] = f"FAIL: {e}"

    # ---------------------------------------------------------
    # TEST B: Poor Performance (Hard -> Medium)
    # ---------------------------------------------------------
    print("\n--- TEST B: Poor Performance ---")
    try:
        # Features: correctness=0.25, solve_time=50.0, attempts=4, difficulty=3 (Hard)
        res_b = get_next_difficulty(
            correctness=0.25,
            solve_time=50.0,
            attempts=4,
            current_difficulty="Hard"
        )
        print(f"Predicted Performance: {res_b['performance']}")
        print(f"Action: {res_b['action']} (0=Easier)")
        print(f"Current Difficulty: {res_b['current_difficulty']} -> Next: {res_b['next_difficulty']}")
        
        assert res_b["performance"] == "Low", f"Expected Low, got {res_b['performance']}"
        assert res_b["action"] == 0, f"Expected action 0 (Easier), got {res_b['action']}"
        assert res_b["next_difficulty"] == "Medium", f"Expected Medium, got {res_b['next_difficulty']}"
        print("[PASS] TEST B passed successfully.")
        results["TEST B"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST B failed: {e}")
        results["TEST B"] = f"FAIL: {e}"

    # ---------------------------------------------------------
    # TEST C: Medium Performance (Medium -> Medium)
    # ---------------------------------------------------------
    print("\n--- TEST C: Medium Performance ---")
    try:
        # Features: correctness=0.7, solve_time=35.0, attempts=3, difficulty=2 (Medium)
        res_c = get_next_difficulty(
            correctness=0.7,
            solve_time=35.0,
            attempts=3,
            current_difficulty="Medium"
        )
        print(f"Predicted Performance: {res_c['performance']}")
        print(f"Action: {res_c['action']} (1=Same)")
        print(f"Current Difficulty: {res_c['current_difficulty']} -> Next: {res_c['next_difficulty']}")
        
        assert res_c["performance"] == "Medium", f"Expected Medium, got {res_c['performance']}"
        assert res_c["action"] == 1, f"Expected action 1 (Same), got {res_c['action']}"
        assert res_c["next_difficulty"] == "Medium", f"Expected Medium, got {res_c['next_difficulty']}"
        print("[PASS] TEST C passed successfully.")
        results["TEST C"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST C failed: {e}")
        results["TEST C"] = f"FAIL: {e}"

    # ---------------------------------------------------------
    # TEST D: Beginner Boundary (Beginner + Easier -> Beginner)
    # ---------------------------------------------------------
    print("\n--- TEST D: Beginner Boundary ---")
    try:
        # Poor performance at Beginner
        res_d = get_next_difficulty(
            correctness=0.1,
            solve_time=65.0,
            attempts=5,
            current_difficulty="Beginner"
        )
        print(f"Current: {res_d['current_difficulty']} | Action: {res_d['action']} | Next: {res_d['next_difficulty']}")
        assert res_d["current_difficulty"] == "Beginner"
        assert res_d["next_difficulty"] == "Beginner", f"Beginner cannot become easier than Beginner, got {res_d['next_difficulty']}"
        print("[PASS] TEST D passed successfully.")
        results["TEST D"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST D failed: {e}")
        results["TEST D"] = f"FAIL: {e}"

    # ---------------------------------------------------------
    # TEST E: Expert Boundary (Expert + Harder -> Expert)
    # ---------------------------------------------------------
    print("\n--- TEST E: Expert Boundary ---")
    try:
        # High performance at Expert
        res_e = get_next_difficulty(
            correctness=1.0,
            solve_time=10.0,
            attempts=1,
            current_difficulty="Expert"
        )
        print(f"Current: {res_e['current_difficulty']} | Action: {res_e['action']} | Next: {res_e['next_difficulty']}")
        assert res_e["current_difficulty"] == "Expert"
        assert res_e["next_difficulty"] == "Expert", f"Expert cannot become harder than Expert, got {res_e['next_difficulty']}"
        print("[PASS] TEST E passed successfully.")
        results["TEST E"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST E failed: {e}")
        results["TEST E"] = f"FAIL: {e}"

    # ---------------------------------------------------------
    # TEST F: Database Persistence
    # ---------------------------------------------------------
    print("\n--- TEST F: Database Persistence ---")
    temp_alarm = None
    temp_event = None
    temp_challenge = None
    temp_attempt = None
    try:
        # Create an isolated temporary alarm at Medium
        temp_alarm = Alarm(
            user_id=user_id,
            title="Temp Test F Alarm",
            time="07:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(temp_alarm)
        db.commit()
        db.refresh(temp_alarm)

        temp_event = WakeUpEvent(
            user_id=user_id,
            alarm_id=temp_alarm.id,
            status="completed",
            verification_status="verified",
            required_challenges=1,
            completed_challenges=1,
            total_attempts=1,
            completed_at=datetime.utcnow()
        )
        db.add(temp_event)
        db.commit()
        db.refresh(temp_event)

        temp_challenge = Challenge(
            user_id=user_id,
            alarm_id=temp_alarm.id,
            wake_up_event_id=temp_event.id,
            challenge_type="Math Problems",
            difficulty="Medium",
            question="1+1",
            correct_answer="2",
            status="completed"
        )
        db.add(temp_challenge)
        db.commit()
        db.refresh(temp_challenge)

        temp_attempt = ChallengeAttempt(
            challenge_id=temp_challenge.id,
            user_id=user_id,
            attempt_number=1,
            user_answer="2",
            is_correct=True,
            solve_time=10
        )
        db.add(temp_attempt)
        db.commit()

        # Run adaptive difficulty
        adapt_alarm_difficulty(temp_event.id, db)

        # Close session completely and open a new session to query from PostgreSQL
        alarm_id = temp_alarm.id
        db.close()
        new_db = SessionLocal()
        reloaded_alarm = new_db.query(Alarm).filter(Alarm.id == alarm_id).first()
        print(f"Persisted difficulty after new session reload: {reloaded_alarm.difficulty}")
        assert reloaded_alarm.difficulty == "Hard", f"Expected Hard, got {reloaded_alarm.difficulty}"
        new_db.close()
        db = SessionLocal()
        print("[PASS] TEST F passed successfully.")
        results["TEST F"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST F failed: {e}")
        results["TEST F"] = f"FAIL: {e}"
    finally:
        # Clean up temporary test records
        try:
            if temp_attempt:
                db.query(ChallengeAttempt).filter(ChallengeAttempt.id == temp_attempt.id).delete()
            if temp_challenge:
                db.query(Challenge).filter(Challenge.id == temp_challenge.id).delete()
            if temp_event:
                db.query(WakeUpEvent).filter(WakeUpEvent.id == temp_event.id).delete()
            if temp_alarm:
                db.query(Alarm).filter(Alarm.id == temp_alarm.id).delete()
            db.commit()
        except Exception:
            db.rollback()

    # ---------------------------------------------------------
    # TEST G: Next Challenge uses updated difficulty
    # ---------------------------------------------------------
    print("\n--- TEST G: Next Challenge Generation Uses Updated Difficulty ---")
    temp_alarm_g = None
    temp_event_g = None
    try:
        temp_alarm_g = Alarm(
            user_id=user_id,
            title="Temp Test G Alarm",
            time="07:00",
            difficulty="Hard",
            challenge_type="Math Problems"
        )
        db.add(temp_alarm_g)
        db.commit()
        db.refresh(temp_alarm_g)

        # Simulate starting next wake-up event for this alarm
        temp_event_g = WakeUpEvent(
            user_id=user_id,
            alarm_id=temp_alarm_g.id,
            status="in_progress",
            verification_status="pending",
            required_challenges=1,
            completed_challenges=0,
            total_attempts=0
        )
        db.add(temp_event_g)
        db.commit()
        db.refresh(temp_event_g)

        # Generate challenge using backend router logic
        from routers.challenges import generate_challenge, GenerateChallengeRequest
        req = GenerateChallengeRequest(alarm_id=temp_alarm_g.id, wake_up_event_id=temp_event_g.id)
        current_user = {"user_id": user_id}
        resp = generate_challenge(req, current_user=current_user, db=db)
        print(f"Generated challenge difficulty: {resp['difficulty']} (Alarm difficulty: {temp_alarm_g.difficulty})")
        assert resp["difficulty"] == "Hard", f"Expected challenge difficulty 'Hard', got {resp['difficulty']}"
        print("[PASS] TEST G passed successfully.")
        results["TEST G"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST G failed: {e}")
        results["TEST G"] = f"FAIL: {e}"
    finally:
        try:
            if temp_event_g:
                db.query(Challenge).filter(Challenge.wake_up_event_id == temp_event_g.id).delete()
                db.query(WakeUpEvent).filter(WakeUpEvent.id == temp_event_g.id).delete()
            if temp_alarm_g:
                db.query(Alarm).filter(Alarm.id == temp_alarm_g.id).delete()
            db.commit()
        except Exception:
            db.rollback()

    # ---------------------------------------------------------
    # TEST H: Incomplete Wake-Up (Must NOT Adapt)
    # ---------------------------------------------------------
    print("\n--- TEST H: Incomplete Wake-Up ---")
    temp_alarm_h = None
    temp_event_h = None
    try:
        temp_alarm_h = Alarm(
            user_id=user_id,
            title="Temp Test H Alarm",
            time="07:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(temp_alarm_h)
        db.commit()
        db.refresh(temp_alarm_h)

        temp_event_h = WakeUpEvent(
            user_id=user_id,
            alarm_id=temp_alarm_h.id,
            status="in_progress",  # NOT completed
            verification_status="pending",
            required_challenges=2,
            completed_challenges=0,
            total_attempts=0
        )
        db.add(temp_event_h)
        db.commit()
        db.refresh(temp_event_h)

        res_h = adapt_alarm_difficulty(temp_event_h.id, db)
        db.refresh(temp_alarm_h)
        assert res_h is None, "Expected None return for incomplete wake-up event"
        assert temp_alarm_h.difficulty == "Medium", "Alarm difficulty should remain unchanged"
        print("[PASS] TEST H passed: Incomplete wake-up did not trigger difficulty adaptation.")
        results["TEST H"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST H failed: {e}")
        results["TEST H"] = f"FAIL: {e}"
    finally:
        try:
            if temp_event_h:
                db.query(WakeUpEvent).filter(WakeUpEvent.id == temp_event_h.id).delete()
            if temp_alarm_h:
                db.query(Alarm).filter(Alarm.id == temp_alarm_h.id).delete()
            db.commit()
        except Exception:
            db.rollback()

    # ---------------------------------------------------------
    # TEST I: Duplicate Completion Idempotency
    # ---------------------------------------------------------
    print("\n--- TEST I: Duplicate Completion Idempotency ---")
    temp_alarm_i = None
    temp_event_i = None
    temp_chal_i = None
    temp_att_i = None
    try:
        temp_alarm_i = Alarm(
            user_id=user_id,
            title="Temp Test I Alarm",
            time="07:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(temp_alarm_i)
        db.commit()
        db.refresh(temp_alarm_i)

        temp_event_i = WakeUpEvent(
            user_id=user_id,
            alarm_id=temp_alarm_i.id,
            status="completed",
            verification_status="verified",
            required_challenges=1,
            completed_challenges=1,
            total_attempts=1,
            completed_at=datetime.utcnow()
        )
        db.add(temp_event_i)
        db.commit()
        db.refresh(temp_event_i)

        temp_chal_i = Challenge(
            user_id=user_id,
            alarm_id=temp_alarm_i.id,
            wake_up_event_id=temp_event_i.id,
            challenge_type="Math Problems",
            difficulty="Medium",
            question="1+1",
            correct_answer="2",
            status="completed"
        )
        db.add(temp_chal_i)
        db.commit()
        db.refresh(temp_chal_i)

        temp_att_i = ChallengeAttempt(
            challenge_id=temp_chal_i.id,
            user_id=user_id,
            attempt_number=1,
            user_answer="2",
            is_correct=True,
            solve_time=10
        )
        db.add(temp_att_i)
        db.commit()

        # First adaptation -> upgrades to Hard
        res_i1 = adapt_alarm_difficulty(temp_event_i.id, db)
        db.refresh(temp_alarm_i)
        assert temp_alarm_i.difficulty == "Hard"

        # Second adaptation on the SAME event -> must be a no-op due to idempotency
        res_i2 = adapt_alarm_difficulty(temp_event_i.id, db)
        db.refresh(temp_alarm_i)
        assert res_i2 is None, "Expected duplicate adaptation to return None"
        assert temp_alarm_i.difficulty == "Hard", "Duplicate adaptation must not re-advance difficulty"
        print("[PASS] TEST I passed: Duplicate completion did not re-trigger difficulty adaptation.")
        results["TEST I"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST I failed: {e}")
        results["TEST I"] = f"FAIL: {e}"
    finally:
        try:
            if temp_att_i:
                db.query(ChallengeAttempt).filter(ChallengeAttempt.id == temp_att_i.id).delete()
            if temp_chal_i:
                db.query(Challenge).filter(Challenge.id == temp_chal_i.id).delete()
            if temp_event_i:
                db.query(WakeUpEvent).filter(WakeUpEvent.id == temp_event_i.id).delete()
            if temp_alarm_i:
                db.query(Alarm).filter(Alarm.id == temp_alarm_i.id).delete()
            db.commit()
        except Exception:
            db.rollback()

    # ---------------------------------------------------------
    # TEST J: Existing Functionality Preserved
    # ---------------------------------------------------------
    print("\n--- TEST J: Existing Functionality Preserved ---")
    try:
        # 1. Habit score calculation
        temp_alarm_j = Alarm(
            user_id=user_id,
            title="Temp Test J Alarm",
            time="07:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(temp_alarm_j)
        db.commit()
        db.refresh(temp_alarm_j)

        temp_event_j = WakeUpEvent(
            user_id=user_id,
            alarm_id=temp_alarm_j.id,
            status="completed",
            verification_status="verified",
            required_challenges=1,
            completed_challenges=1,
            total_attempts=1,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        db.add(temp_event_j)
        db.commit()
        db.refresh(temp_event_j)

        calculate_daily_habit_score(user_id, temp_event_j.id, db)
        print("Habit scoring ran successfully.")

        # 2. Recommendations generation
        from Models.analytics import BehaviorProfile
        profile = db.query(BehaviorProfile).filter(BehaviorProfile.user_id == user_id, BehaviorProfile.date == date.today()).first()
        if profile:
            recs = generate_daily_recommendations(user_id, profile, db)
            print("Generated daily recommendations successfully.")

        print("[PASS] TEST J passed: Habit scoring and recommendations operate properly.")
        results["TEST J"] = "PASS"
    except Exception as e:
        print(f"[FAIL] TEST J failed: {e}")
        results["TEST J"] = f"FAIL: {e}"
    finally:
        try:
            if temp_event_j:
                db.query(WakeUpEvent).filter(WakeUpEvent.id == temp_event_j.id).delete()
            if temp_alarm_j:
                db.query(Alarm).filter(Alarm.id == temp_alarm_j.id).delete()
            db.commit()
        except Exception:
            db.rollback()

    db.close()

    print("\n" + "=" * 60)
    print("SUMMARY OF TEST RESULTS:")
    print("=" * 60)
    for test_name, status in results.items():
        print(f"  {test_name}: {status}")
    print("=" * 60)

    all_passed = all(status == "PASS" for status in results.values())
    if all_passed:
        print("\nALL 10 TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("\nSOME TESTS FAILED.")
        return 1


if __name__ == "__main__":
    sys.exit(run_milestone3_tests())
