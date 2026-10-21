import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine
from Models.user import User
from Models.habit import Habit
from Models.alarm import Alarm
from Models.challenge import Challenge, ChallengeAttempt

def seed_data():
    with Session(engine) as db:
        user = db.query(User).filter(User.email == "Gagan2@gmail.com").first()
        if not user:
            print("User Gagan2@gmail.com not found. Please run seed_users.py first.")
            return

        # Add Habits
        habits = [
            Habit(user_id=user.id, name="Morning Walk", description="Walk 10,000 steps", priority="High", time_of_day="Morning", is_enabled=True),
            Habit(user_id=user.id, name="Read 20 Pages", description="Read a self-improvement book", priority="Medium", time_of_day="Evening", is_enabled=True),
            Habit(user_id=user.id, name="Drink Water", description="Drink 2L of water", priority="High", time_of_day="All Day", is_enabled=True)
        ]
        db.add_all(habits)

        # Add Alarms
        alarms = [
            Alarm(user_id=user.id, title="Wake Up - Morning Routine", time="06:30", is_active=True, days_of_week="Mon,Tue,Wed,Thu,Fri", challenge_type="Math Problems", difficulty="Medium", snooze_limit=2, sound_tone="Gentle Chimes"),
            Alarm(user_id=user.id, title="Workout Reminder", time="18:00", is_active=True, days_of_week="Mon,Wed,Fri", challenge_type="Logic Puzzles", difficulty="Hard", snooze_limit=1, sound_tone="Loud Beep")
        ]
        db.add_all(alarms)
        db.commit()

        # Add Challenges & Attempts
        print("Dummy data successfully seeded for Gagan2@gmail.com!")

if __name__ == "__main__":
    seed_data()
