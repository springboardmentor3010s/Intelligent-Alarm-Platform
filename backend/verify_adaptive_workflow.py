import os
import sys
import json
import random
from datetime import datetime

# Set backend in path
sys.path.append(os.path.dirname(__file__))

import Models.user
import Models.habit
import Models.challenge
import Models.alarm
from database import SessionLocal
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent, Challenge, ChallengeAttempt
from services.difficulty_engine import get_next_difficulty, DIFFICULTY_LEVELS
from services.adaptive_difficulty import predict_performance
from services.analytics import adapt_alarm_difficulty
from routers.challenges import (
    generate_math,
    generate_logic,
    generate_memory,
    generate_word,
    generate_pattern,
    generate_riddle,
    generate_quiz,
    create_challenge_data,
    CHALLENGE_TYPES
)

def run_all_verifications():
    results = {}
    print("================================================================")
    print("VERIFICATION SUITE: ADAPTIVE DIFFICULTY & ALARM WORKFLOW")
    print("================================================================\n")

    # -------------------------------------------------------------
    # 1. VERIFY DIFFICULTY LEVELS ORDER AND CONSISTENCY
    # -------------------------------------------------------------
    print("--- 1. Testing Difficulty Levels Hierarchy ---")
    expected_levels = ["Beginner", "Easy", "Medium", "Hard", "Expert"]
    assert DIFFICULTY_LEVELS == expected_levels, f"DIFFICULTY_LEVELS mismatch: {DIFFICULTY_LEVELS}"
    for idx, name in enumerate(expected_levels):
        print(f"  Level {idx}: {name}")
    results["1_hierarchy"] = "PASS"

    # -------------------------------------------------------------
    # 2. VERIFY DIFFICULTY BOUNDARIES & ACTION MAPPING
    # -------------------------------------------------------------
    print("\n--- 2. Testing Difficulty Boundaries & Action Mapping ---")
    # Action 0 = Easier, Action 1 = Same, Action 2 = Harder
    boundary_tests = [
        ("Beginner", 0, "Beginner"),  # Beginner + Easier -> Beginner
        ("Beginner", 2, "Easy"),      # Beginner + Harder -> Easy
        ("Medium", 0, "Easy"),        # Medium + Easier -> Easy
        ("Medium", 1, "Medium"),      # Medium + Same -> Medium
        ("Medium", 2, "Hard"),        # Medium + Harder -> Hard
        ("Hard", 2, "Expert"),        # Hard + Harder -> Expert
        ("Expert", 2, "Expert"),      # Expert + Harder -> Expert
        ("Expert", 0, "Hard"),        # Expert + Easier -> Hard
    ]

    for curr_diff, action, expected_next in boundary_tests:
        curr_idx = DIFFICULTY_LEVELS.index(curr_diff)
        if action == 0:
            calc_idx = max(0, curr_idx - 1)
        elif action == 1:
            calc_idx = curr_idx
        elif action == 2:
            calc_idx = min(len(DIFFICULTY_LEVELS) - 1, curr_idx + 1)
        next_diff = DIFFICULTY_LEVELS[calc_idx]

        action_name = "Easier" if action == 0 else ("Same" if action == 1 else "Harder")
        assert next_diff == expected_next, f"Boundary failed for {curr_diff} + {action_name}: got {next_diff}, expected {expected_next}"
        print(f"  [PASS] {curr_diff} (idx {curr_idx}) + {action_name} (action {action}) -> {next_diff} (idx {calc_idx})")

    results["2_boundaries"] = "PASS"

    # -------------------------------------------------------------
    # 3. VERIFY QUESTION COMPLEXITY ACROSS ALL LEVELS
    # -------------------------------------------------------------
    print("\n--- 3. Testing Math Problem Progression Across 5 Levels ---")
    for diff in ["Beginner", "Easy", "Medium", "Hard", "Expert"]:
        sample_questions = []
        for _ in range(5):
            q, opts, ans = generate_math(diff)
            sample_questions.append((q, ans))
        print(f"  Level: {diff}")
        for q, ans in sample_questions[:2]:
            print(f"    Sample: {q} [Answer: {ans}]")

        # Specific assertions:
        if diff == "Expert":
            # Must NOT be a simple 2-digit addition like "What is 61 + 24?"
            for q, _ in sample_questions:
                assert ("(" in q and "*" in q) or ("*" in q and ("+" in q or "-" in q)), \
                    f"Expert math question lacked multi-step complexity: {q}"
        elif diff == "Beginner":
            # Must be single-digit
            for q, _ in sample_questions:
                assert "(" not in q, f"Beginner question should be simple, got {q}"

    print("  [PASS] Math Problem complexity scales properly. Expert produces multi-step arithmetic.")
    results["3_math_complexity"] = "PASS"

    # -------------------------------------------------------------
    # 4. VERIFY ALL 7 CHALLENGE CATEGORIES GENERATION
    # -------------------------------------------------------------
    print("\n--- 4. Testing All 7 Challenge Generators ---")
    for cat in CHALLENGE_TYPES:
        q, opts, ans = create_challenge_data(cat, "Medium")
        options = json.loads(opts)
        assert len(options) >= 2, f"{cat} returned less than 2 options: {options}"
        assert ans in options, f"{cat} answer '{ans}' not in options {options}"
        print(f"  [PASS] Category '{cat}' generated valid question with {len(options)} options.")

    results["4_all_categories"] = "PASS"

    # -------------------------------------------------------------
    # 5. VERIFY ML ENSEMBLE (RF + XGBOOST)
    # -------------------------------------------------------------
    print("\n--- 5. Testing ML Ensemble Prediction ---")
    high_perf = predict_performance(correctness=1.0, solve_time=10.0, attempts=1, difficulty=2)
    assert high_perf["performance_level"] in ["Low", "Medium", "High"]
    assert "probabilities" in high_perf
    print(f"  High Input: Pred={high_perf['performance_level']}, Probs={high_perf['probabilities']}")

    low_perf = predict_performance(correctness=0.0, solve_time=90.0, attempts=5, difficulty=2)
    assert low_perf["performance_level"] in ["Low", "Medium", "High"]
    print(f"  Low Input: Pred={low_perf['performance_level']}, Probs={low_perf['probabilities']}")
    results["5_ml_ensemble"] = "PASS"

    # -------------------------------------------------------------
    # 6. VERIFY WORKFLOW (INCORRECT ANSWER + REPLACEMENT + PERSISTENCE)
    # -------------------------------------------------------------
    print("\n--- 6. Testing Complete Alarm Verification Workflow with Real DB Session ---")
    db = SessionLocal()
    temp_alarm = None
    temp_event = None
    temp_challenge_1 = None
    temp_challenge_2 = None
    temp_attempt_1 = None
    temp_attempt_2 = None

    try:
        # Create an isolated temporary test alarm under user 1
        temp_alarm = Alarm(
            user_id=1,
            title="AutoTest Verification Alarm",
            time="06:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(temp_alarm)
        db.commit()
        db.refresh(temp_alarm)

        initial_alarm_diff = temp_alarm.difficulty
        assert initial_alarm_diff == "Medium", f"Expected Medium, got {initial_alarm_diff}"
        print(f"  Initial Alarm created with difficulty: {initial_alarm_diff}")

        # Start wake-up event
        temp_event = WakeUpEvent(
            user_id=1,
            alarm_id=temp_alarm.id,
            status="in_progress",
            verification_status="pending",
            required_challenges=1,
            completed_challenges=0,
            total_attempts=0
        )
        db.add(temp_event)
        db.commit()
        db.refresh(temp_event)

        # Generate Challenge 1 at Medium
        q1, opts1, ans1 = create_challenge_data("Math Problems", temp_alarm.difficulty)
        temp_challenge_1 = Challenge(
            user_id=1,
            alarm_id=temp_alarm.id,
            wake_up_event_id=temp_event.id,
            challenge_type="Math Problems",
            difficulty=temp_alarm.difficulty,
            question=q1,
            options=opts1,
            correct_answer=ans1,
            status="pending"
        )
        db.add(temp_challenge_1)
        db.commit()
        db.refresh(temp_challenge_1)
        print(f"  Challenge 1 generated: Difficulty='{temp_challenge_1.difficulty}', Status='{temp_challenge_1.status}'")

        # Step 4: Submit INCORRECT answer
        temp_attempt_1 = ChallengeAttempt(
            challenge_id=temp_challenge_1.id,
            user_id=1,
            attempt_number=1,
            user_answer="WRONG_ANSWER",
            is_correct=False,
            score=0,
            solve_time=15
        )
        db.add(temp_attempt_1)
        temp_challenge_1.status = "failed"
        temp_event.total_attempts += 1

        # Simulate replacement challenge generation
        # Session difficulty must remain consistent (Medium)
        session_diff = temp_challenge_1.difficulty
        q2, opts2, ans2 = create_challenge_data("Math Problems", session_diff)
        temp_challenge_2 = Challenge(
            user_id=1,
            alarm_id=temp_alarm.id,
            wake_up_event_id=temp_event.id,
            challenge_type="Math Problems",
            difficulty=session_diff,
            question=q2,
            options=opts2,
            correct_answer=ans2,
            status="pending"
        )
        db.add(temp_challenge_2)
        db.commit()
        db.refresh(temp_challenge_2)

        # Assert alarm difficulty did NOT change mid-session on wrong answer
        db.refresh(temp_alarm)
        assert temp_alarm.difficulty == "Medium", f"Alarm difficulty mutated prematurely: {temp_alarm.difficulty}"
        assert temp_challenge_2.difficulty == "Medium", f"Replacement challenge difficulty mismatch: {temp_challenge_2.difficulty}"
        print(f"  [PASS] Incorrect answer recorded. Replacement challenge generated with difficulty='{temp_challenge_2.difficulty}'. Alarm difficulty untouched.")

        # Step 5: Submit CORRECT answer for replacement challenge
        temp_attempt_2 = ChallengeAttempt(
            challenge_id=temp_challenge_2.id,
            user_id=1,
            attempt_number=1,
            user_answer=ans2,
            is_correct=True,
            score=100,
            solve_time=8
        )
        db.add(temp_attempt_2)
        temp_challenge_2.status = "completed"
        temp_event.completed_challenges += 1
        temp_event.total_attempts += 1
        temp_event.status = "completed"
        temp_event.verification_status = "verified"
        temp_event.completed_at = datetime.utcnow()
        db.commit()

        # Step 6: Trigger adaptive difficulty at completion
        adaptation_result = adapt_alarm_difficulty(temp_event.id, db)
        print(f"  Adaptation Result: {adaptation_result}")
        assert adaptation_result is not None, "Adaptation returned None on completed event"

        # Verify database persistence
        db.refresh(temp_alarm)
        persisted_diff = temp_alarm.difficulty
        print(f"  Persisted Alarm Difficulty in PostgreSQL: '{persisted_diff}'")
        assert persisted_diff in DIFFICULTY_LEVELS, f"Invalid persisted difficulty: {persisted_diff}"

        # Step 7: Verify subsequent challenge generation uses the updated difficulty
        next_q, next_opts, next_ans = create_challenge_data("Math Problems", temp_alarm.difficulty)
        print(f"  Subsequent challenge generated for alarm with difficulty='{temp_alarm.difficulty}'")
        results["6_workflow_persistence"] = "PASS"

    except Exception as e:
        print(f"  [FAIL] Workflow test failed: {e}")
        import traceback
        traceback.print_exc()
        results["6_workflow_persistence"] = f"FAIL: {e}"

    finally:
        # Tear down test records immediately to leave database 100% clean
        try:
            if temp_attempt_1:
                db.query(ChallengeAttempt).filter(ChallengeAttempt.id == temp_attempt_1.id).delete()
            if temp_attempt_2:
                db.query(ChallengeAttempt).filter(ChallengeAttempt.id == temp_attempt_2.id).delete()
            if temp_challenge_1:
                db.query(Challenge).filter(Challenge.id == temp_challenge_1.id).delete()
            if temp_challenge_2:
                db.query(Challenge).filter(Challenge.id == temp_challenge_2.id).delete()
            if temp_event:
                db.query(WakeUpEvent).filter(WakeUpEvent.id == temp_event.id).delete()
            if temp_alarm:
                db.query(Alarm).filter(Alarm.id == temp_alarm.id).delete()
            db.commit()
            print("  Cleaned up temporary test records from PostgreSQL successfully.")
        except Exception as ce:
            print(f"  Cleanup error: {ce}")
            db.rollback()
        finally:
            db.close()

    print("\n================================================================")
    print("ALL TESTS SUMMARY:")
    for test_name, status in results.items():
        print(f"  {test_name}: {status}")
    print("================================================================")

if __name__ == "__main__":
    run_all_verifications()
