from database import SessionLocal
import main # Import main to ensure all models are loaded
from Models.user import User
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent, Challenge, ChallengeAttempt
from services.analytics import adapt_alarm_difficulty
import sys

def test_adaptive_difficulty():
    db = SessionLocal()
    try:
        print("--- Starting Adaptive Difficulty Test ---")
        # 1. Get or create a dummy user
        user = db.query(User).first()
        if not user:
            user = User(name="Test User", email="test@test.com", password_hash="hash")
            db.add(user)
            db.commit()
            db.refresh(user)

        # 2. Create an Alarm at Medium difficulty
        alarm = Alarm(
            user_id=user.id,
            title="Test Medium Alarm",
            time="07:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(alarm)
        db.commit()
        db.refresh(alarm)
        print(f"[+] Created Alarm ID: {alarm.id} | Initial Difficulty: {alarm.difficulty}")

        # 3. Simulate Wake-up event
        event = WakeUpEvent(
            user_id=user.id,
            alarm_id=alarm.id,
            status="in_progress",
            required_challenges=1,
            completed_challenges=0,
            total_attempts=0
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # 4. Simulate a perfect, fast challenge (User performs well)
        challenge = Challenge(
            user_id=user.id,
            alarm_id=alarm.id,
            wake_up_event_id=event.id,
            challenge_type="Math Problems",
            difficulty="Medium",
            question="1+1",
            correct_answer="2",
            status="completed"
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)

        attempt = ChallengeAttempt(
            challenge_id=challenge.id,
            user_id=user.id,
            attempt_number=1,
            is_correct=True,
            solve_time=10 # Fast!
        )
        db.add(attempt)
        db.commit()

        # Update event to completed
        event.completed_challenges = 1
        event.total_attempts = 1
        event.status = "completed"
        db.commit()

        # 5. Run Adaptive Engine
        print("\n[>] User performed well (1 attempt, 10s solve time). Running Adaptive Engine...")
        adapt_alarm_difficulty(event.id, db)
        db.refresh(alarm)
        
        print(f"[=] New Difficulty: {alarm.difficulty}")
        if alarm.difficulty == "Hard":
            print("[SUCCESS] Difficulty successfully upgraded to Hard!")
        else:
            print("[FAILED] Difficulty did not upgrade.")

        # --- Test Downscale ---
        print("\n--- Testing Downscale (Struggle) ---")
        
        # Reset event
        event2 = WakeUpEvent(
            user_id=user.id,
            alarm_id=alarm.id,
            status="in_progress",
            required_challenges=1,
            completed_challenges=0,
            total_attempts=0
        )
        db.add(event2)
        db.commit()
        db.refresh(event2)

        # Simulate struggle: 3 attempts, slow solve time
        challenge2 = Challenge(
            user_id=user.id,
            alarm_id=alarm.id,
            wake_up_event_id=event2.id,
            challenge_type="Math Problems",
            difficulty="Hard",
            question="10*10",
            correct_answer="100",
            status="completed"
        )
        db.add(challenge2)
        db.commit()
        db.refresh(challenge2)

        db.add(ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=1, is_correct=False, solve_time=30))
        db.add(ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=2, is_correct=False, solve_time=30))
        db.add(ChallengeAttempt(challenge_id=challenge2.id, user_id=user.id, attempt_number=3, is_correct=True, solve_time=40))
        db.commit()

        event2.completed_challenges = 1
        event2.total_attempts = 3
        event2.status = "completed"
        db.commit()

        print("[>] User struggled (3 attempts, slow solve time). Running Adaptive Engine...")
        adapt_alarm_difficulty(event2.id, db)
        db.refresh(alarm)

        print(f"[=] New Difficulty: {alarm.difficulty}")
        if alarm.difficulty == "Medium":
            print("[SUCCESS] Difficulty successfully downgraded back to Medium!")
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
    test_adaptive_difficulty()
