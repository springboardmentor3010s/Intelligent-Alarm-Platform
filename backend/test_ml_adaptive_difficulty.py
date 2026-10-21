from database import SessionLocal
from Models.user import User
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent, Challenge, ChallengeAttempt
from services.analytics import adapt_alarm_difficulty, DIFFICULTIES
from datetime import datetime

def test_ml_adaptive():
    db = SessionLocal()
    try:
        print("--- Testing ML Adaptive Difficulty Engine ---")
        user = db.query(User).first()
        if not user:
            user = User(name="Test User", email="test@test.com", password_hash="hash")
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create Alarm at "Medium" difficulty
        alarm = Alarm(user_id=user.id, title="ML Test", time="07:00", difficulty="Medium", challenge_type="Math Problems")
        db.add(alarm)
        db.commit()
        db.refresh(alarm)

        print(f"\n[+] Created Alarm ID: {alarm.id} | Initial Difficulty: {alarm.difficulty}")

        # Simulate PERFECT performance -> ML should classify as "High" (2) and scale up to "Hard"
        event = WakeUpEvent(user_id=user.id, alarm_id=alarm.id, status="completed", required_challenges=1, completed_challenges=1, total_attempts=1)
        db.add(event)
        db.commit()
        db.refresh(event)

        challenge = Challenge(user_id=user.id, alarm_id=alarm.id, wake_up_event_id=event.id, difficulty="Medium", challenge_type="Math Problems", question="1+1", correct_answer="2")
        db.add(challenge)
        db.commit()
        db.refresh(challenge)

        attempt = ChallengeAttempt(challenge_id=challenge.id, user_id=user.id, attempt_number=1, user_answer="2", is_correct=True, solve_time=10.0) # 10 seconds (fast)
        db.add(attempt)
        db.commit()

        print("\n[>] User performed well (1 attempt, 10s solve time). Running ML Engine...")
        adapt_alarm_difficulty(event.id, db)
        
        db.refresh(alarm)
        print(f"[=] New Difficulty Predicted: {alarm.difficulty}")
        if alarm.difficulty == "Hard":
            print("[SUCCESS] Difficulty successfully upgraded to Hard by Random Forest!")
        else:
            print("[FAILED] Difficulty did not upgrade.")

        # Simulate TERRIBLE performance -> ML should classify as "Low" (0) and scale down to "Medium"
        event2 = WakeUpEvent(user_id=user.id, alarm_id=alarm.id, status="completed", required_challenges=1, completed_challenges=1, total_attempts=4)
        db.add(event2)
        db.commit()
        db.refresh(event2)

        challenge2 = Challenge(user_id=user.id, alarm_id=alarm.id, wake_up_event_id=event2.id, difficulty="Hard", challenge_type="Math Problems", question="1+1", correct_answer="2")
        db.add(challenge2)
        db.commit()
        db.refresh(challenge2)

        # 4 attempts, user fails 3 times, takes a long time
        attempt2 = ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=1, user_answer="2", is_correct=False, solve_time=50.0)
        attempt3 = ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=2, user_answer="4", is_correct=False, solve_time=45.0)
        attempt4 = ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=3, user_answer="1", is_correct=False, solve_time=30.0)
        attempt5 = ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=4, user_answer="2", is_correct=True, solve_time=35.0) # Total 80 seconds
        db.add_all([attempt2, attempt3, attempt4, attempt5])
        db.commit()

        print("\n[>] User struggled (4 attempts, slow solve time). Running ML Engine...")
        adapt_alarm_difficulty(event2.id, db)
        
        db.refresh(alarm)
        print(f"[=] New Difficulty Predicted: {alarm.difficulty}")
        if alarm.difficulty == "Medium":
            print("[SUCCESS] Difficulty successfully downgraded to Medium by Random Forest!")
        else:
            print("[FAILED] Difficulty did not downgrade.")

    finally:
        # Cleanup
        db.query(ChallengeAttempt).filter(ChallengeAttempt.challenge_id.in_([challenge.id, challenge2.id])).delete()
        db.query(Challenge).filter(Challenge.id.in_([challenge.id, challenge2.id])).delete()
        db.query(WakeUpEvent).filter(WakeUpEvent.id.in_([event.id, event2.id])).delete()
        db.query(Alarm).filter(Alarm.id == alarm.id).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_ml_adaptive()
