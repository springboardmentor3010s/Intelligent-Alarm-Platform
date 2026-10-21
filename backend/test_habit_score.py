from database import SessionLocal
import main # Ensure models are loaded
from Models.user import User
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent, Challenge, ChallengeAttempt
from Models.analytics import BehaviorProfile, Recommendation, SleepLog
from Models.habit import Habit
from services.analytics import calculate_daily_habit_score
from datetime import datetime, date
import sys

def test_habit_scoring():
    db = SessionLocal()
    try:
        print("--- Starting Habit Scoring Test ---")
        user = db.query(User).first()
        if not user:
            user = User(name="Test Score", email="score@test.com", password_hash="hash")
            db.add(user)
            db.commit()
            db.refresh(user)

        # 1. Create an Alarm at 07:00
        alarm = Alarm(
            user_id=user.id,
            title="Score Test Alarm",
            time="07:00",
            difficulty="Medium",
            challenge_type="Math Problems"
        )
        db.add(alarm)
        db.commit()
        db.refresh(alarm)

        today = date.today()
        
        # 1.1 Create a perfect SleepLog
        sleep_log = SleepLog(
            user_id=user.id,
            date=today,
            target_sleep_time="23:00",
            actual_sleep_time="23:00",
            target_wake_time="07:00",
            actual_wake_time="07:00"
        )
        db.add(sleep_log)
        db.commit()

        # 1.5 Create some habits
        habit1 = Habit(user_id=user.id, name="Read", is_enabled=True, completed=True)
        habit2 = Habit(user_id=user.id, name="Run", is_enabled=True, completed=False)
        db.add(habit1)
        db.add(habit2)
        db.commit()
        db.refresh(alarm)

        # 2. Simulate Wake-up event starting exactly at 07:00 (perfect consistency)
        today = date.today()
        perfect_time = datetime(today.year, today.month, today.day, 7, 0, 0)
        
        event = WakeUpEvent(
            user_id=user.id,
            alarm_id=alarm.id,
            status="completed",
            required_challenges=1,
            completed_challenges=1,
            total_attempts=1, # Perfect completion
            snoozes=0, # No snoozes
            started_at=perfect_time
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # 3. Calculate Score
        print("\n[>] User woke up perfectly on time, 0 snoozes, 1 attempt. Running Habit Scorer...")
        profile = calculate_daily_habit_score(user.id, event.id, db)
        
        print(f"[-] Wake-up Consistency Score: {profile.wake_up_consistency_score} / 35")
        print(f"[-] Challenge Completion Rate: {profile.challenge_completion_rate * 100}% (Score: {int(profile.challenge_completion_rate * 25)} / 25)")
        print(f"[-] Snooze Score: {profile.snooze_count} snoozes (Score: {max(0, 20 - profile.snooze_count * 5)} / 20)")
        print(f"[=] TOTAL HABIT SCORE: {profile.habit_score} / 100")

        if profile.habit_score == 100:
            print("[SUCCESS] Scored 100 on perfect wake-up!")
        else:
            print("[FAILED] Score was not 100 on perfect wake-up.")

        # --- Test Bad Score ---
        print("\n--- Testing Bad Score (Late, Snoozes, Mistakes) ---")
        
        late_time = datetime(today.year, today.month, today.day, 7, 10, 0) # 10 mins late
        event2 = WakeUpEvent(
            user_id=user.id,
            alarm_id=alarm.id,
            status="completed",
            required_challenges=1,
            completed_challenges=1,
            total_attempts=2, # 50% completion rate
            snoozes=3, # 3 snoozes (-15 pts)
            started_at=late_time
        )
        db.add(event2)
        db.commit()
        db.refresh(event2)

        print("[>] User was 10 mins late, 3 snoozes, 2 attempts. Running Habit Scorer...")
        profile2 = calculate_daily_habit_score(user.id, event2.id, db)
        
        print(f"[-] Wake-up Consistency Score: {profile2.wake_up_consistency_score} / 35")
        print(f"[-] Challenge Completion Rate: {profile2.challenge_completion_rate * 100}% (Score: {int(profile2.challenge_completion_rate * 25)} / 25)")
        print(f"[-] Snooze Score: {profile2.snooze_count} snoozes (Score: {max(0, 20 - profile2.snooze_count * 5)} / 20)")
        print(f"[-] Sleep Score: {profile2.sleep_adherence_score} / 20")
        print(f"[=] TOTAL HABIT SCORE: {profile2.habit_score} / 100")

    finally:
        # Cleanup
        db.query(BehaviorProfile).filter(BehaviorProfile.user_id == user.id).delete()
        db.query(WakeUpEvent).filter(WakeUpEvent.user_id == user.id).delete()
        db.query(Alarm).filter(Alarm.id == alarm.id).delete()
        db.query(Habit).filter(Habit.user_id == user.id).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_habit_scoring()
