import os
import sys
from datetime import date, timedelta, datetime
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import main
from database import SessionLocal
from Models.user import User
from Models.analytics import BehaviorProfile, Recommendation
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent
from services.recommendation import generate_daily_recommendations
from services.habit_scoring import calculate_habit_score
def seed_gagan2_history():
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(name="Gagan2").first()
        if not user:
            print("User Gagan2 not found.")
            return

        alarm = db.query(Alarm).filter_by(user_id=user.id).first()
        if not alarm:
            print("User Gagan2 has no alarms.")
            return

        today = date.today()

        # Clear only history, don't delete alarms!
        db.query(BehaviorProfile).filter_by(user_id=user.id).delete()
        db.query(WakeUpEvent).filter_by(user_id=user.id).delete()
        db.query(Recommendation).filter_by(user_id=user.id).delete()
        db.commit()

        # Seed 30 days of improving history
        for i in range(30):
            day = today - timedelta(days=(29-i))
            
            wake_score = min(35, 10 + i * 0.8)
            challenge_rate = min(1.0, 0.5 + (i * 0.02))
            snoozes = max(0, 4 - i // 7)
            sleep_score = min(20, 10 + i // 3)
            
            habit_score = calculate_habit_score(
                wake_up_consistency_score=wake_score,
                challenge_completion_rate=challenge_rate,
                snooze_count=snoozes,
                sleep_adherence_score=sleep_score
            )
            
            profile = BehaviorProfile(
                user_id=user.id,
                date=day,
                wake_up_consistency_score=wake_score,
                challenge_completion_rate=challenge_rate,
                snooze_count=snoozes,
                sleep_adherence_score=sleep_score,
                habit_score=habit_score
            )
            db.add(profile)

            # Wake up event for that day
            event_date = day
            snoozes = max(0, 4 - i//7)
            # Use alarm time if available
            time_str = alarm.time if alarm.time else "07:00"
            base_time = datetime.strptime(time_str, "%H:%M").time()
            started_at = datetime.combine(event_date, base_time) + timedelta(minutes=snoozes*5)
            
            event = WakeUpEvent(
                alarm_id=alarm.id,
                user_id=user.id,
                snoozes=snoozes,
                started_at=started_at
            )
            db.add(event)
            
        db.commit()
        
        # Generate recommendations for today
        current_profile = db.query(BehaviorProfile).filter_by(user_id=user.id, date=today).first()
        generate_daily_recommendations(user.id, current_profile, db)
        print("Analytics data perfectly seeded for Gagan2 using their existing alarm.")
        
    finally:
        db.close()

if __name__ == "__main__":
    seed_gagan2_history()
