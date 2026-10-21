from database import SessionLocal
from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent
from Models.user import User, UserProfile
from Models.alarm import Alarm
from Models.habit import Habit

db = SessionLocal()

print("--- Database Record Check ---")
print(f"Total Challenges Generated: {db.query(Challenge).count()}")
print(f"Total Challenge Attempts Logged: {db.query(ChallengeAttempt).count()}")
print(f"Total WakeUp Events Created: {db.query(WakeUpEvent).count()}")

# Fetch the last 3 attempts
recent_attempts = db.query(ChallengeAttempt).order_by(ChallengeAttempt.id.desc()).limit(3).all()
print("\nMost Recent 3 Attempts Logged in DB:")
for a in recent_attempts:
    print(f"- Attempt #{a.attempt_number} | Answer: '{a.user_answer}' | Correct: {a.is_correct} | Score: {a.score}")

db.close()
