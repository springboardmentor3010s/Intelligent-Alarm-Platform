import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
from database import SessionLocal
import Models.user
import Models.alarm
import Models.challenge
import Models.analytics
from Models.user import User
from Models.alarm import Alarm
from Models.challenge import WakeUpEvent
from services.analytics import analyze_behavior_trend
from datetime import datetime, date, timedelta

def test_behavior_trend():
    db = SessionLocal()
    try:
        print("--- Testing Phase 2 (Behavioral Analytics TF LSTM) ---")
        user = db.query(User).first()
        if not user:
            print("No user found. Run other tests first.")
            return

        alarm = db.query(Alarm).filter(Alarm.user_id == user.id).first()
        if not alarm:
            alarm = Alarm(user_id=user.id, title="Test", time="07:00", difficulty="Medium", challenge_type="Math Problems")
            db.add(alarm)
            db.commit()
            db.refresh(alarm)

        # Create a sequence of 5 events getting WORSE (Declining)
        print("\n[>] Simulating a user whose snoozes increase over 5 days...")
        db.query(WakeUpEvent).filter(WakeUpEvent.user_id == user.id).delete()
        today = date.today()
        
        events = []
        for i in range(5):
            # i=0 is 4 days ago, i=4 is today
            event_date = today - timedelta(days=(4-i))
            event_time = datetime.strptime(f"{event_date} 07:{10 + (i*5)}", "%Y-%m-%d %H:%M") # delay increases
            events.append(
                WakeUpEvent(
                    alarm_id=alarm.id, user_id=user.id,
                    snoozes=i+1, # snoozes increase: 1, 2, 3, 4, 5
                    started_at=event_time
                )
            )
        db.add_all(events)
        db.commit()

        trend = analyze_behavior_trend(user.id, db)
        print(f"[=] TensorFlow LSTM Predicted Trend: {trend}")
        if trend == "Declining":
            print("[SUCCESS] TF Model correctly identified a Declining trend!")
        else:
            print("[FAILED] Expected Declining, got", trend)

    finally:
        # Cleanup
        db.query(WakeUpEvent).filter(WakeUpEvent.user_id == user.id).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_behavior_trend()
