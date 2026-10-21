import os
import sys
from datetime import date, timedelta, datetime
import random

# Make sure we can import from backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import main # Ensure models load
from Models.user import User
from Models.analytics import BehaviorProfile, Recommendation
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent, Challenge
from services.recommendation import generate_daily_recommendations

def seed_dashboard_data():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("No users found in database.")
            return

        today = date.today()
        
        for user in users:
            print(f"Seeding data for user: {user.name} (ID: {user.id})")
            
            # 1. Ensure user has an alarm
            alarm = db.query(Alarm).filter(Alarm.user_id == user.id).first()
            if not alarm:
                alarm = Alarm(user_id=user.id, title="Morning Alarm", time="07:00", difficulty="Hard", challenge_type="Pattern Recognition")
                db.add(alarm)
                db.commit()
                db.refresh(alarm)
            else:
                alarm.difficulty = "Hard"
                db.commit()

            # Clear old mock data
            db.query(BehaviorProfile).filter(BehaviorProfile.user_id == user.id).delete()
            db.query(WakeUpEvent).filter(WakeUpEvent.user_id == user.id).delete()
            db.query(Recommendation).filter(Recommendation.user_id == user.id).delete()
            db.commit()

            # 2. Seed 7 days of BehaviorProfile (improving trend)
            for i in range(7):
                day = today - timedelta(days=(6-i))
                score = 60 + (i * 4) + random.randint(-5, 5) # Trending from 60s up to 80s
                
                profile = BehaviorProfile(
                    user_id=user.id,
                    date=day,
                    wake_up_consistency_score=min(35, 20 + i*2),
                    challenge_completion_rate=0.7 + (i*0.04),
                    snooze_count=max(0, 3 - i//2),
                    sleep_adherence_score=min(20, 10 + i),
                    habit_score=min(100, score)
                )
                db.add(profile)
            
            # 3. Seed WakeUpEvents
            for i in range(7):
                event_date = today - timedelta(days=(6-i))
                snoozes = max(0, 2 - i//2)
                started_at = datetime.combine(event_date, datetime.strptime("07:00", "%H:%M").time()) + timedelta(minutes=snoozes*5)
                
                event = WakeUpEvent(
                    alarm_id=alarm.id,
                    user_id=user.id,
                    snoozes=snoozes,
                    started_at=started_at
                )
                db.add(event)
                
            db.commit()
            
            # 4. Generate recommendations for today's profile
            current_profile = db.query(BehaviorProfile).filter(BehaviorProfile.user_id == user.id, BehaviorProfile.date == today).first()
            generate_daily_recommendations(user.id, current_profile, db)
            
        print("Successfully seeded dashboard data for all users!")
            
    finally:
        db.close()

if __name__ == "__main__":
    seed_dashboard_data()
