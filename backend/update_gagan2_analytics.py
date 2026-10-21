import sys, os
from datetime import date, timedelta
sys.path.insert(0, os.getcwd())

import main
from database import SessionLocal
from Models.user import User
from Models.analytics import BehaviorProfile, SleepLog, Recommendation
from services.recommendation import generate_daily_recommendations

def update_gagan2_data():
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email="Gagan2@gmail.com").first()
        if not user:
            print("User Gagan2 not found!")
            return

        today = date.today()
        print(f"Updating Gagan2 (id={user.id}) data up to today: {today}")

        # Update or insert last 30 days of BehaviorProfiles
        for i in range(30):
            day = today - timedelta(days=(29 - i))
            wake_score = min(35, int(20 + i * 0.5))
            chall_rate = round(min(1.0, 0.7 + i * 0.01), 2)
            snoozes = max(0, int(2 - i // 12))
            sleep_score = min(20, int(14 + i * 0.2))
            # Total score
            tot = int(wake_score + chall_rate * 25 + max(0, 20 - snoozes * 5) + sleep_score)
            habit_score = min(100, tot)

            bp = db.query(BehaviorProfile).filter_by(user_id=user.id, date=day).first()
            if not bp:
                bp = BehaviorProfile(user_id=user.id, date=day)
                db.add(bp)
            bp.wake_up_consistency_score = wake_score
            bp.challenge_completion_rate = chall_rate
            bp.snooze_count = snoozes
            bp.sleep_adherence_score = sleep_score
            bp.habit_score = habit_score

            # Ensure SleepLog for each day
            sl = db.query(SleepLog).filter_by(user_id=user.id, date=day).first()
            if not sl:
                sl = SleepLog(
                    user_id=user.id,
                    date=day,
                    target_sleep_time="22:30",
                    actual_sleep_time="22:35" if i % 2 == 0 else "22:30",
                    target_wake_time="06:30",
                    actual_wake_time="06:30"
                )
                db.add(sl)

        db.commit()

        # Generate recommendations for today
        today_profile = db.query(BehaviorProfile).filter_by(user_id=user.id, date=today).first()
        if today_profile:
            generate_daily_recommendations(user.id, today_profile, db)

        print("[SUCCESS] Gagan2 BehaviorProfiles and SleepLogs updated with rich, non-zero values!")
    finally:
        db.close()

if __name__ == "__main__":
    update_gagan2_data()
